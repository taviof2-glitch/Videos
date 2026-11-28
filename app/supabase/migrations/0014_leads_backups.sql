-- 1) Cotizador en línea (/cotiza/<código>): el cliente calcula un precio aproximado y deja sus datos; llega como pedido.
create or replace function public_estimator(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_b jsonb;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;
  select data into v_b from sync_row where tbl = 'business' and deleted_at is null and data->>'leadToken' = p_token limit 1;
  if v_b is null then return null; end if;
  return jsonb_strip_nulls(jsonb_build_object('name', v_b->>'name', 'phone', v_b->>'phone', 'logo', v_b->>'logo', 'currency', coalesce(v_b->>'currency', 'MXN'), 'prices', v_b->'leadPrices', 'galleryToken', v_b->>'galleryToken'));
end $$;

create or replace function public_lead(p_token text, p_name text, p_phone text, p_what text, p_notes text, p_estimate bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid; v_ip text; v_id uuid := gen_random_uuid(); v_number bigint;
  v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception 'not_found'; end if;
  select business_id into v_biz from sync_row where tbl = 'business' and deleted_at is null and data->>'leadToken' = p_token limit 1;
  if v_biz is null then raise exception 'not_found'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 10 then raise exception 'bad_contact'; end if;
  v_ip := coalesce(nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ''), ',', 1), ''), 'unknown');
  delete from order_throttle where at < now() - interval '1 day';
  if (select count(*) from order_throttle where ip = v_ip and at > now() - interval '10 minutes') >= 5
     or (select count(*) from order_throttle where business_id = v_biz) >= 200 then raise exception 'rate_limited'; end if;
  insert into order_throttle (business_id, ip) values (v_biz, v_ip);
  perform pg_advisory_xact_lock(hashtextextended(v_biz::text, 0));
  v_number := sync_apply_row(v_biz, 'order', jsonb_build_object(
    'id', v_id, 'businessId', v_biz, 'number', 0, 'numberPending', true,
    'customerName', left(trim(p_name), 60) || ' · ' || left(regexp_replace(p_phone, '[^\d+ ]', '', 'g'), 20),
    'notes', left('Desde el cotizador en línea. ' || trim(coalesce(p_notes, '')), 400),
    'status', 'pending', 'totalCents', greatest(0, least(coalesce(p_estimate, 0), 100000000)), 'source', 'web', 'createdAt', v_now, 'updatedAt', v_now));
  perform sync_apply_children(v_biz, 'orderItem', v_id, jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid(), 'orderId', v_id, 'position', 0, 'name', left(trim(coalesce(p_what, 'Mueble a la medida')), 120),
    'quantity', 1, 'unitPriceCents', greatest(0, least(coalesce(p_estimate, 0), 100000000)))));
  return jsonb_build_object('ok', true, 'business', v_biz, 'number', v_number);
end $$;

-- 2) Respaldo semanal en la nube: una foto de todos los datos de cada negocio (se guardan las últimas 8).
create table if not exists business_backup (
  id bigserial primary key,
  business_id uuid not null,
  created_at timestamptz not null default now(),
  rows int not null,
  data jsonb not null
);
create index if not exists business_backup_biz on business_backup (business_id, created_at desc);
alter table business_backup enable row level security;
revoke all on business_backup from anon, authenticated;

create or replace function make_weekly_backups(p_key text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_ok boolean; v_n int := 0; v_biz uuid;
begin
  select encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') = key_hash into v_ok from digest_key where id = 1;
  if not coalesce(v_ok, false) then raise exception 'sin permiso'; end if;
  for v_biz in select distinct business_id from business_member loop
    if exists (select 1 from business_backup where business_id = v_biz and created_at > now() - interval '6 days') then continue; end if;
    insert into business_backup (business_id, rows, data)
      select v_biz, count(*), coalesce(jsonb_agg(jsonb_build_object('tbl', tbl, 'id', id, 'parentId', parent_id, 'data', data)), '[]'::jsonb)
      from sync_row where business_id = v_biz and deleted_at is null;
    delete from business_backup where business_id = v_biz and id not in (select id from business_backup where business_id = v_biz order by created_at desc limit 8);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function list_backups(p_business uuid) returns table (id bigint, created_at timestamptz, rows int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from business_member where business_id = p_business and user_id = auth.uid()) then raise exception 'sin permiso'; end if;
  return query select b.id, b.created_at, b.rows from business_backup b where b.business_id = p_business order by b.created_at desc;
end $$;

create or replace function get_backup(p_business uuid, p_id bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from business_member where business_id = p_business and user_id = auth.uid()) then raise exception 'sin permiso'; end if;
  return (select data from business_backup where business_id = p_business and id = p_id);
end $$;

revoke all on function public_estimator(text), public_lead(text, text, text, text, text, bigint), make_weekly_backups(text), list_backups(uuid), get_backup(uuid, bigint) from public;
grant execute on function public_estimator(text), public_lead(text, text, text, text, text, bigint), make_weekly_backups(text) to anon, authenticated;
grant execute on function list_backups(uuid), get_backup(uuid, bigint) to authenticated;
notify pgrst, 'reload schema';
