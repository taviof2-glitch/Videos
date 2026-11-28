-- Galería pública: también la foto de antes (antes y después).
create or replace function public_gallery(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_biz uuid;
  v_b jsonb;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;
  select business_id, data into v_biz, v_b from sync_row where tbl = 'business' and deleted_at is null and data->>'galleryToken' = p_token limit 1;
  if v_biz is null then return null; end if;
  return jsonb_build_object(
    'business', jsonb_strip_nulls(jsonb_build_object('name', v_b->>'name', 'phone', v_b->>'phone', 'country', v_b->>'country', 'logo', v_b->>'logo')),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('title', coalesce(nullif(r.data->>'title', ''), nullif(r.data->>'concept', ''), 'Mueble a la medida'), 'photos', r.data->'job'->'photos', 'before', r.data->'job'->'before', 'date', coalesce(r.data->'job'->>'deliveredAt', left(r.data->'job'->>'startedAt', 10))) order by coalesce(r.data->'job'->>'deliveredAt', r.data->'job'->>'startedAt') desc)
      from sync_row r
      where r.business_id = v_biz and r.tbl in ('quote', 'txn') and r.deleted_at is null and (r.data->'job'->>'gallery')::boolean is true and jsonb_array_length(coalesce(r.data->'job'->'photos', '[]'::jsonb)) > 0
    ), '[]'::jsonb)
  );
end $$;

notify pgrst, 'reload schema';
