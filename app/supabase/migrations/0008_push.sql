-- Avisos push: cada teléfono que los activa guarda aquí su suscripción (Web Push).
-- Solo los miembros del negocio pueden suscribirse o leer las suscripciones de su negocio
-- (las lee la función del servidor api/push.ts con la sesión de quien manda el aviso).

create table if not exists push_subscription (
  endpoint text primary key,
  business_id uuid not null,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  -- Quién usa ese teléfono dentro de la app (empleado o dueño), para no avisarle de lo que él mismo hizo.
  employee_id text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscription_business on push_subscription (business_id);
alter table push_subscription enable row level security;
revoke all on push_subscription from anon, authenticated;

create or replace function push_is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_member where business_id = p_business and user_id = auth.uid())
$$;

create or replace function push_subscribe(p_business uuid, p_endpoint text, p_p256dh text, p_auth text, p_employee text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not push_is_member(p_business) then raise exception 'sin permiso'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000 then raise exception 'suscripción no válida'; end if;
  insert into push_subscription (endpoint, business_id, user_id, p256dh, auth, employee_id)
  values (p_endpoint, p_business, auth.uid(), p_p256dh, p_auth, nullif(p_employee, ''))
  on conflict (endpoint) do update set business_id = excluded.business_id, user_id = excluded.user_id,
    p256dh = excluded.p256dh, auth = excluded.auth, employee_id = excluded.employee_id;
end $$;

create or replace function push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscription s where s.endpoint = p_endpoint and push_is_member(s.business_id)
$$;

create or replace function push_targets(p_business uuid)
returns table (endpoint text, p256dh text, auth text, employee_id text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not push_is_member(p_business) then raise exception 'sin permiso'; end if;
  return query select s.endpoint, s.p256dh, s.auth, s.employee_id from push_subscription s where s.business_id = p_business;
end $$;

revoke all on function push_is_member(uuid), push_subscribe(uuid, text, text, text, text), push_unsubscribe(text), push_targets(uuid) from public, anon;
grant execute on function push_subscribe(uuid, text, text, text, text), push_unsubscribe(text), push_targets(uuid) to authenticated;
