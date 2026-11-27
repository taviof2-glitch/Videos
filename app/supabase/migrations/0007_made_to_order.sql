-- Productos sobre pedido: el catálogo público nunca los marca agotados (se fabrican al pedirlos).
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
      'soldOut', case when coalesce((p.data->>'madeToOrder')::boolean, false) then false
        when coalesce((p.data->>'hasVariants')::boolean, false)
        then not exists (select 1 from sync_row v where v.business_id = v_biz and v.tbl = 'productVariant' and v.data->>'productId' = p.id::text and v.deleted_at is null and (v.data->>'stock')::numeric > 0)
        else coalesce((p.data->>'stock')::numeric, 0) <= 0 end,
      'variants', case when coalesce((p.data->>'hasVariants')::boolean, false) then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', left(v.id::text, 8), 'name', v.data->>'name',
          'priceCents', coalesce((v.data->>'priceCents')::bigint, (p.data->>'priceCents')::bigint),
          'soldOut', not coalesce((p.data->>'madeToOrder')::boolean, false) and coalesce((v.data->>'stock')::numeric, 0) <= 0) order by (v.data->>'position')::int), '[]')
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
