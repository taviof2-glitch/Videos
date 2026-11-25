-- T15: réplica en el servidor de los datos de Conta (ver replica/sync-design.md).
--
-- Una sola tabla guarda todas las filas de Dexie tal cual (`data` jsonb, con los nombres de campo
-- de app/src/data/types.ts). Así un campo nuevo en la app no necesita migración del servidor.
-- El navegador nunca escribe en las tablas: solo a través de las funciones de abajo, que validan
-- que quien llama es miembro del negocio y aplican las reglas de unión.

create table if not exists business_member (
  business_id uuid not null,
  user_id uuid not null,
  role text not null default 'owner' check (role in ('owner', 'employee')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_member_user on business_member (user_id);

create sequence if not exists sync_rev;

create table if not exists sync_row (
  business_id uuid not null,
  tbl text not null,
  id uuid not null,
  -- Para las líneas de un documento (txnItem, quoteItem…): id del documento.
  parent_id uuid,
  data jsonb not null,
  -- Fila borrada: en entidades y documentos coincide con data.deletedAt; en líneas, la línea ya no existe.
  deleted_at timestamptz,
  -- Orden global de escritura; los dispositivos descargan "rev > cursor".
  rev bigint not null default nextval('sync_rev'),
  updated_at timestamptz not null default now(),
  primary key (business_id, tbl, id)
);
create index if not exists sync_row_rev on sync_row (business_id, rev);
create index if not exists sync_row_parent on sync_row (business_id, tbl, parent_id) where parent_id is not null;

create or replace function sync_row_touch() returns trigger language plpgsql as $$
begin
  new.rev := nextval('sync_rev');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists sync_row_touch on sync_row;
create trigger sync_row_touch before insert or update on sync_row for each row execute function sync_row_touch();

-- Consecutivos por negocio (cotizaciones, pedidos). Los asigna el servidor al subir.
create table if not exists business_counter (
  business_id uuid not null,
  name text not null,
  last_value bigint not null default 0,
  primary key (business_id, name)
);

alter table business_member enable row level security;
alter table sync_row enable row level security;
alter table business_counter enable row level security;

-- Solo lectura de las propias membresías; nada más se lee ni se escribe directamente.
drop policy if exists business_member_self on business_member;
create policy business_member_self on business_member for select to authenticated using (user_id = auth.uid());
revoke all on sync_row, business_counter from anon, authenticated;
revoke all on business_member from anon;
revoke insert, update, delete on business_member from authenticated;
grant select on business_member to authenticated;

create or replace function sync_is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_member where business_id = p_business and user_id = auth.uid())
$$;

-- Tablas que la app puede subir y cómo se unen.
--   ledger: solo se añade; lo único que puede cambiar después es poner deletedAt (anular).
--   child: líneas de un documento; viajan siempre con su padre y se reemplazan en bloque.
--   (el resto): entidad o documento; gana la última escritura que llega, pero el borrado gana.
create or replace function sync_table_kind(p_tbl text) returns text
language sql immutable as $$
  select case
    when p_tbl in ('stockMovement', 'payment') then 'ledger'
    when p_tbl in ('txnItem', 'quoteItem', 'orderItem', 'purchaseItem') then 'child'
    when p_tbl in ('business', 'contact', 'category', 'product', 'productVariant', 'txn', 'quote', 'order', 'purchase') then 'row'
    else null
  end
$$;

create or replace function sync_child_parent(p_tbl text) returns text
language sql immutable as $$
  select case p_tbl when 'txnItem' then 'txn' when 'quoteItem' then 'quote' when 'orderItem' then 'order' when 'purchaseItem' then 'purchase' end
$$;

-- Estado del negocio para quien llama: 'member', 'unclaimed' (nadie lo ha subido) o 'forbidden'.
create or replace function sync_business_status(p_business uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when sync_is_member(p_business) then 'member'
    when not exists (select 1 from business_member where business_id = p_business) then 'unclaimed'
    else 'forbidden'
  end
$$;

-- Primer inicio de sesión: quien sube un negocio que nadie tiene queda como dueño.
create or replace function sync_claim_business(p_business uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));
  if sync_is_member(p_business) then return 'member'; end if;
  if exists (select 1 from business_member where business_id = p_business) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into business_member (business_id, user_id, role) values (p_business, auth.uid(), 'owner');
  return 'member';
end $$;

-- Aplica una fila (no línea) con las reglas de unión. Devuelve el folio asignado si lo hubo.
create or replace function sync_apply_row(p_business uuid, p_tbl text, p_data jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := (p_data->>'id')::uuid;
  v_kind text := sync_table_kind(p_tbl);
  v_old sync_row;
  v_data jsonb := p_data;
  v_number bigint;
  v_counter text;
begin
  if v_kind is null or v_kind = 'child' then raise exception 'bad_table %', p_tbl using errcode = '22023'; end if;
  if p_tbl = 'business' then
    if v_id <> p_business then raise exception 'bad_business' using errcode = '22023'; end if;
  elsif (p_data->>'businessId') is distinct from p_business::text then
    raise exception 'bad_business' using errcode = '22023';
  end if;

  select * into v_old from sync_row where business_id = p_business and tbl = p_tbl and id = v_id for update;

  if v_kind = 'ledger' then
    if not found then
      insert into sync_row (business_id, tbl, id, data, deleted_at)
      values (p_business, p_tbl, v_id, v_data, (v_data->>'deletedAt')::timestamptz);
    elsif v_old.deleted_at is null and (v_data->>'deletedAt') is not null then
      update sync_row set data = v_old.data || jsonb_build_object('deletedAt', v_data->'deletedAt'),
        deleted_at = (v_data->>'deletedAt')::timestamptz
      where business_id = p_business and tbl = p_tbl and id = v_id;
    end if;
    return null;
  end if;

  -- El borrado gana: una edición que llega después de borrar se descarta.
  if found and v_old.deleted_at is not null then return null; end if;

  -- Folios: la app marca con numberPending los creados sin conexión.
  v_counter := case p_tbl when 'quote' then 'quote' when 'order' then 'order' end;
  if v_counter is not null then
    if found and (v_old.data ? 'number') and not coalesce((v_old.data->>'numberPending')::boolean, false) then
      -- Ya tiene folio definitivo: nunca cambia.
      v_data := (v_data - 'numberPending') || jsonb_build_object('number', v_old.data->'number');
    elsif coalesce((v_data->>'numberPending')::boolean, false) then
      insert into business_counter (business_id, name, last_value) values (p_business, v_counter, 1)
      on conflict (business_id, name) do update set last_value = business_counter.last_value + 1
      returning last_value into v_number;
      v_data := (v_data - 'numberPending') || jsonb_build_object('number', v_number);
    elsif (v_data->>'number') is not null then
      -- Folio que ya traía el dispositivo (datos anteriores a la sincronización): el contador no baja de él.
      insert into business_counter (business_id, name, last_value) values (p_business, v_counter, (v_data->>'number')::bigint)
      on conflict (business_id, name) do update set last_value = greatest(business_counter.last_value, excluded.last_value);
    end if;
  end if;

  insert into sync_row (business_id, tbl, id, data, deleted_at)
  values (p_business, p_tbl, v_id, v_data, (v_data->>'deletedAt')::timestamptz)
  on conflict (business_id, tbl, id) do update set data = excluded.data, deleted_at = excluded.deleted_at;
  return v_number;
end $$;

-- Reemplaza el juego de líneas de un documento: las que no vienen quedan borradas.
create or replace function sync_apply_children(p_business uuid, p_tbl text, p_parent uuid, p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_parent_tbl text := sync_child_parent(p_tbl);
  v_parent sync_row;
  v_row jsonb;
  v_ids uuid[];
begin
  if v_parent_tbl is null then raise exception 'bad_table %', p_tbl using errcode = '22023'; end if;
  select * into v_parent from sync_row where business_id = p_business and tbl = v_parent_tbl and id = p_parent;
  if not found then raise exception 'missing_parent % %', v_parent_tbl, p_parent using errcode = '23503'; end if;
  -- Si el documento está borrado en el servidor, sus líneas se quedan como estaban (el borrado gana).
  if v_parent.deleted_at is not null then return; end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}') into v_ids from jsonb_array_elements(p_rows) r;
  update sync_row set deleted_at = now()
  where business_id = p_business and tbl = p_tbl and parent_id = p_parent and deleted_at is null and not (id = any (v_ids));

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into sync_row (business_id, tbl, id, parent_id, data)
    values (p_business, p_tbl, (v_row->>'id')::uuid, p_parent, v_row)
    on conflict (business_id, tbl, id) do update
      set data = excluded.data, parent_id = excluded.parent_id, deleted_at = null
      where sync_row.data is distinct from excluded.data or sync_row.deleted_at is not null;
  end loop;
end $$;

-- Sube un lote de cambios de un negocio, todo o nada.
-- p_changes: [{ "tbl": "contact", "row": {...} }, { "tbl": "txnItem", "parentId": "…", "rows": [{...}] }, …]
-- Las filas van antes que sus líneas. Devuelve los folios asignados: [{ "tbl", "id", "number" }].
create or replace function sync_push(p_business uuid, p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_change jsonb;
  v_number bigint;
  v_assigned jsonb := '[]';
begin
  if not sync_is_member(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'bad_changes' using errcode = '22023'; end if;
  -- Un solo envío a la vez por negocio: así los rev de un negocio siguen el orden de confirmación
  -- y una descarga nunca se salta una fila que se confirma después.
  perform pg_advisory_xact_lock(hashtextextended(p_business::text, 0));

  for v_change in select * from jsonb_array_elements(p_changes) loop
    if v_change ? 'rows' then
      perform sync_apply_children(p_business, v_change->>'tbl', (v_change->>'parentId')::uuid, v_change->'rows');
    else
      v_number := sync_apply_row(p_business, v_change->>'tbl', v_change->'row');
      if v_number is not null then
        v_assigned := v_assigned || jsonb_build_object('tbl', v_change->>'tbl', 'id', v_change->'row'->>'id', 'number', v_number);
      end if;
    end if;
  end loop;
  return v_assigned;
end $$;

-- Descarga lo que cambió después de `p_after`, en orden. El dispositivo guarda el último rev como cursor.
create or replace function sync_pull(p_business uuid, p_after bigint, p_limit int default 500)
returns table (tbl text, id uuid, parent_id uuid, data jsonb, deleted_at timestamptz, rev bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not sync_is_member(p_business) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select s.tbl, s.id, s.parent_id, s.data, s.deleted_at, s.rev from sync_row s
    where s.business_id = p_business and s.rev > p_after
    order by s.rev
    limit least(greatest(p_limit, 1), 1000);
end $$;

revoke all on function sync_is_member(uuid), sync_apply_row(uuid, text, jsonb), sync_apply_children(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function sync_business_status(uuid), sync_claim_business(uuid), sync_push(uuid, jsonb), sync_pull(uuid, bigint, int) from public, anon;
grant execute on function sync_business_status(uuid), sync_claim_business(uuid), sync_push(uuid, jsonb), sync_pull(uuid, bigint, int) to authenticated;
