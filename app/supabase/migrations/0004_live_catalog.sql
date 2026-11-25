-- T15 paso 6: catálogo en vivo y pedidos automáticos.
-- El negocio publica una página con un nombre corto (slug). Cualquiera la lee con public_catalog(slug) y deja un pedido
-- con place_order(slug, …). Nunca se exponen costos ni existencias: solo nombre, descripción, precio, foto y si está agotado.

create table if not exists catalog_page (
  business_id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
-- Para frenar abusos de place_order (límite por IP y por negocio).
create table if not exists order_throttle (
  id bigserial primary key,
  business_id uuid not null,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists order_throttle_ip on order_throttle (ip, at);
create index if not exists order_throttle_business on order_throttle (business_id, at);

alter table catalog_page enable row level security;
alter table order_throttle enable row level security;
revoke all on catalog_page, order_throttle from anon, authenticated;

-- El dueño elige (o cambia) el nombre de su página y la enciende o apaga.
create or replace function sync_set_catalog(p_business uuid, p_slug text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  if not sync_is_member(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'bad_slug' using errcode = '22023'; end if;
  begin
    insert into catalog_page (business_id, slug, enabled) values (p_business, v_slug, coalesce(p_enabled, true))
    on conflict (business_id) do update set slug = excluded.slug, enabled = excluded.enabled, updated_at = now();
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;
  return jsonb_build_object('slug', v_slug, 'enabled', coalesce(p_enabled, true));
end $$;

create or replace function sync_get_catalog(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not sync_is_member(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select jsonb_build_object('slug', slug, 'enabled', enabled) from catalog_page where business_id = p_business);
end $$;

-- El catálogo público, con la misma forma que CatalogData (src/data/catalogFormat.ts). Null si no existe o está apagado.
create or replace function public_catalog(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_biz uuid;
  v_b jsonb;
  v_products jsonb;
  v_categories jsonb;
begin
  select c.business_id into v_biz from catalog_page c where c.slug = lower(coalesce(p_slug, '')) and c.enabled;
  if v_biz is null then return null; end if;
  select data into v_b from sync_row where business_id = v_biz and tbl = 'business' and id = v_biz and deleted_at is null;
  if v_b is null then return null; end if;

  select coalesce(jsonb_agg(x.item order by x.name), '[]') into v_products from (
    select lower(p.data->>'name') as name, jsonb_strip_nulls(jsonb_build_object(
      'id', left(p.id::text, 8),
      'name', p.data->>'name',
      'description', coalesce(p.data->>'description', ''),
      'category', coalesce((select c.data->>'name' from sync_row c where c.business_id = v_biz and c.tbl = 'category' and c.id::text = p.data->>'categoryId' and c.deleted_at is null), ''),
      'priceCents', (p.data->>'priceCents')::bigint,
      'photoPath', p.data->'photoPaths'->>0,
      'soldOut', case when coalesce((p.data->>'hasVariants')::boolean, false)
        then not exists (select 1 from sync_row v where v.business_id = v_biz and v.tbl = 'productVariant' and v.data->>'productId' = p.id::text and v.deleted_at is null and (v.data->>'stock')::numeric > 0)
        else coalesce((p.data->>'stock')::numeric, 0) <= 0 end,
      'variants', case when coalesce((p.data->>'hasVariants')::boolean, false) then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', left(v.id::text, 8), 'name', v.data->>'name',
          'priceCents', coalesce((v.data->>'priceCents')::bigint, (p.data->>'priceCents')::bigint),
          'soldOut', coalesce((v.data->>'stock')::numeric, 0) <= 0) order by (v.data->>'position')::int), '[]')
        from sync_row v where v.business_id = v_biz and v.tbl = 'productVariant' and v.data->>'productId' = p.id::text and v.deleted_at is null) end
    )) as item
    from sync_row p
    where p.business_id = v_biz and p.tbl = 'product' and p.deleted_at is null and coalesce((p.data->>'visibleInCatalog')::boolean, false)
    limit 500
  ) x;

  select coalesce(jsonb_agg(distinct i->>'category'), '[]') into v_categories from jsonb_array_elements(v_products) i where i->>'category' <> '';

  return jsonb_build_object(
    'v', 1, 'generatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'business', jsonb_build_object(
      'name', coalesce(v_b->>'name', ''), 'phone', coalesce(v_b->>'phone', ''), 'country', coalesce(v_b->>'country', 'MX'),
      'address', coalesce(v_b->>'address', ''), 'openingHours', coalesce(v_b->>'openingHours', ''),
      'currency', coalesce(v_b->>'currency', 'MXN'), 'note', coalesce(v_b->>'catalogNote', '')),
    'categories', v_categories,
    'products', v_products);
end $$;

-- Un cliente deja su pedido. Los precios los pone el servidor (no lo que mande la página) y el folio es el consecutivo real.
-- p_items: [{ "p": "id corto del producto", "v": "id corto de la variante (si tiene)", "q": cantidad }]
create or replace function place_order(p_slug text, p_customer text, p_notes text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
  v_ip text;
  v_id uuid := gen_random_uuid();
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_item jsonb;
  v_prod sync_row;
  v_var sync_row;
  v_qty numeric;
  v_price bigint;
  v_total bigint := 0;
  v_lines jsonb := '[]';
  v_pos int := 0;
  v_number bigint;
begin
  select c.business_id into v_biz from catalog_page c where c.slug = lower(coalesce(p_slug, '')) and c.enabled;
  if v_biz is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'bad_items' using errcode = '22023';
  end if;

  -- Límite: 5 pedidos cada 10 minutos por IP y 200 al día por negocio.
  v_ip := coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  delete from order_throttle where at < now() - interval '1 day';
  if (select count(*) from order_throttle where ip = v_ip and at > now() - interval '10 minutes') >= 5
     or (select count(*) from order_throttle where business_id = v_biz) >= 200 then
    raise exception 'rate_limited' using errcode = '53400';
  end if;
  insert into order_throttle (business_id, ip) values (v_biz, v_ip);

  -- Mismo candado que sync_push: los rev del negocio siguen el orden de confirmación.
  perform pg_advisory_xact_lock(hashtextextended(v_biz::text, 0));

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'q')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 1000 then raise exception 'bad_quantity' using errcode = '22023'; end if;
    select * into v_prod from sync_row where business_id = v_biz and tbl = 'product' and left(id::text, 8) = v_item->>'p'
      and deleted_at is null and coalesce((data->>'visibleInCatalog')::boolean, false) limit 1;
    if not found then raise exception 'product_unavailable' using errcode = '22023'; end if;
    v_price := (v_prod.data->>'priceCents')::bigint;
    v_var := null;
    if coalesce((v_prod.data->>'hasVariants')::boolean, false) then
      select * into v_var from sync_row where business_id = v_biz and tbl = 'productVariant' and left(id::text, 8) = v_item->>'v'
        and data->>'productId' = v_prod.id::text and deleted_at is null limit 1;
      if not found then raise exception 'product_unavailable' using errcode = '22023'; end if;
      v_price := coalesce((v_var.data->>'priceCents')::bigint, v_price);
    end if;
    v_total := v_total + round(v_qty * v_price);
    v_lines := v_lines || jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid(), 'orderId', v_id, 'position', v_pos, 'productId', v_prod.id, 'variantId', v_var.id,
      'name', case when v_var.id is null then v_prod.data->>'name' else (v_prod.data->>'name') || ' (' || (v_var.data->>'name') || ')' end,
      'quantity', v_qty, 'unitPriceCents', v_price));
    v_pos := v_pos + 1;
  end loop;

  v_number := sync_apply_row(v_biz, 'order', jsonb_build_object(
    'id', v_id, 'businessId', v_biz, 'number', 0, 'numberPending', true,
    'customerName', left(trim(coalesce(p_customer, '')), 80), 'notes', left(trim(coalesce(p_notes, '')), 400),
    'status', 'pending', 'totalCents', v_total, 'source', 'catalog', 'createdAt', v_now, 'updatedAt', v_now));
  perform sync_apply_children(v_biz, 'orderItem', v_id, v_lines);
  return jsonb_build_object('number', v_number, 'totalCents', v_total);
end $$;

-- Las fotos de los productos visibles de un catálogo encendido las puede bajar cualquiera (solo la primera de cada producto).
create or replace function sync_photo_public(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1 from sync_row p join catalog_page c on c.business_id = p.business_id and c.enabled
      where p.business_id = split_part(p_name, '/', 1)::uuid and p.tbl = 'product' and p.id = split_part(p_name, '/', 2)::uuid
        and p.deleted_at is null and coalesce((p.data->>'visibleInCatalog')::boolean, false)
        and p.data->'photoPaths'->>0 = p_name)
    else false end
$$;

revoke all on function sync_set_catalog(uuid, text, boolean), sync_get_catalog(uuid) from public, anon;
grant execute on function sync_set_catalog(uuid, text, boolean), sync_get_catalog(uuid) to authenticated;
revoke all on function public_catalog(text), place_order(text, text, text, jsonb), sync_photo_public(text) from public;
grant execute on function public_catalog(text), place_order(text, text, text, jsonb) to anon, authenticated;
grant execute on function sync_photo_public(text) to anon, authenticated;

do $$
begin
  if to_regclass('storage.objects') is null then return; end if;
  drop policy if exists product_photos_public on storage.objects;
  create policy product_photos_public on storage.objects for select to anon
    using (bucket_id = 'product-photos' and public.sync_photo_public(name));
end $$;
