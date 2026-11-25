-- T15 paso 5: fotos de productos en Storage (bucket privado `product-photos`).
-- Ruta de cada foto: {businessId}/{productId}/{huella}.jpg. Solo los miembros del negocio leen y escriben las suyas.
create or replace function sync_photo_access(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then sync_is_member(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;

revoke all on function sync_photo_access(text) from public, anon;
grant execute on function sync_photo_access(text) to authenticated;

-- Storage solo existe en Supabase (en el Postgres local de las pruebas se salta).
do $$
begin
  if to_regclass('storage.objects') is null then return; end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('product-photos', 'product-photos', false, 1048576, array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

  drop policy if exists product_photos_select on storage.objects;
  drop policy if exists product_photos_insert on storage.objects;
  drop policy if exists product_photos_update on storage.objects;
  drop policy if exists product_photos_delete on storage.objects;
  create policy product_photos_select on storage.objects for select to authenticated
    using (bucket_id = 'product-photos' and public.sync_photo_access(name));
  create policy product_photos_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'product-photos' and public.sync_photo_access(name));
  create policy product_photos_update on storage.objects for update to authenticated
    using (bucket_id = 'product-photos' and public.sync_photo_access(name))
    with check (bucket_id = 'product-photos' and public.sync_photo_access(name));
  create policy product_photos_delete on storage.objects for delete to authenticated
    using (bucket_id = 'product-photos' and public.sync_photo_access(name));
end $$;
