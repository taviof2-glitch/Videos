-- Resumen del día: la función programada (api/daily.ts, cron de Vercel) lee lo necesario de cada negocio
-- que tenga teléfonos con avisos. No hay sesión de usuario: se autoriza con una clave cuyo hash vive aquí.

create table if not exists digest_key (id int primary key default 1 check (id = 1), key_hash text not null);
alter table digest_key enable row level security;
revoke all on digest_key from anon, authenticated;

create extension if not exists pgcrypto;

create or replace function push_digest_data(p_key text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_ok boolean;
begin
  select encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') = key_hash into v_ok from digest_key where id = 1;
  if not coalesce(v_ok, false) then raise exception 'sin permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'businessId', b.business_id,
      'subs', (select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from push_subscription s where s.business_id = b.business_id),
      'rows', (select coalesce(jsonb_agg(jsonb_build_object('tbl', r.tbl, 'data', r.data)), '[]') from sync_row r
               where r.business_id = b.business_id and r.deleted_at is null and (
                 r.tbl in ('business', 'appointment', 'payment')
                 or (r.tbl = 'contact' and r.data->>'type' = 'customer')
                 or (r.tbl = 'quote' and (r.data->>'status' in ('pending', 'accepted') or r.data ? 'job'))
                 or (r.tbl = 'txn' and r.data->>'type' = 'sale' and (r.data->>'status' = 'credit' or r.data ? 'job'))
               ))
    ))
    from (select distinct business_id from push_subscription) b
  ), '[]'::jsonb);
end $$;

revoke all on function push_digest_data(text) from public, anon, authenticated;
grant execute on function push_digest_data(text) to anon;
