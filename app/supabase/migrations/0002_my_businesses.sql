-- T15 paso 3: negocios de quien inició sesión, para que un aparato nuevo elija cuál descargar.
create or replace function sync_my_businesses()
returns table (business_id uuid, name text, role text)
language sql stable security definer set search_path = public as $$
  select m.business_id, coalesce(r.data->>'name', ''), m.role
  from business_member m
  left join sync_row r on r.business_id = m.business_id and r.tbl = 'business' and r.id = m.business_id
  where m.user_id = auth.uid()
  order by m.created_at
$$;

revoke all on function sync_my_businesses() from public, anon;
grant execute on function sync_my_businesses() to authenticated;
