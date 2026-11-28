-- Resumen de la semana (domingo): push_digest_data manda también las ventas y gastos de los últimos 8 días.
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
                 -- Para el resumen del domingo: todas las ventas y gastos de los últimos 8 días.
                 or (r.tbl = 'txn' and r.data->>'date' >= to_char(now() - interval '8 days', 'YYYY-MM-DD'))
               ))
    ))
    from (select distinct business_id from push_subscription) b
  ), '[]'::jsonb);
end $$;

notify pgrst, 'reload schema';
