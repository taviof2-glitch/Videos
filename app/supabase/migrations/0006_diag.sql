-- Diagnóstico: la app avisa qué versión corre y en qué paso falla la sincronización.
-- Solo se puede escribir por la función (cualquiera con la clave pública); nadie puede leer desde la app.
create table if not exists app_diag (
  id bigserial primary key,
  at timestamptz not null default now(),
  build text,
  origin text,
  info jsonb
);
alter table app_diag enable row level security;

create or replace function app_diag_report(p_build text, p_origin text, p_info jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_info::text, '')) > 4000 then return; end if;
  insert into app_diag (build, origin, info) values (left(p_build, 40), left(p_origin, 120), p_info);
  delete from app_diag where id <= (select max(id) from app_diag) - 500 or at < now() - interval '14 days';
end $$;
revoke all on function app_diag_report(text, text, jsonb) from public;
grant execute on function app_diag_report(text, text, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
