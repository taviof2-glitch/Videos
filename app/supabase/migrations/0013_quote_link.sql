-- Cotización por enlace (/c/<código>): el cliente la ve con las opciones y los datos de pago, y puede aceptarla.
-- Solo existe si el negocio compartió el enlace (quote.shareToken).
create index if not exists sync_row_share on sync_row ((data->>'shareToken')) where data ? 'shareToken';

create or replace function public_quote(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_row sync_row; v_b jsonb; v_c text;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;
  select * into v_row from sync_row where tbl = 'quote' and deleted_at is null and data->>'shareToken' = p_token limit 1;
  if v_row is null then return null; end if;
  select data into v_b from sync_row where business_id = v_row.business_id and tbl = 'business' and id = v_row.business_id;
  select split_part(data->>'name', ' ', 1) into v_c from sync_row where business_id = v_row.business_id and tbl = 'contact' and id::text = v_row.data->>'contactId';
  return jsonb_strip_nulls(jsonb_build_object(
    'business', jsonb_build_object('name', v_b->>'name', 'phone', v_b->>'phone', 'country', v_b->>'country', 'logo', v_b->>'logo', 'currency', coalesce(v_b->>'currency', 'MXN'), 'payInfo', v_b->'payInfo'),
    'customer', v_c,
    'number', v_row.data->'number', 'title', v_row.data->>'title', 'status', v_row.data->>'status',
    'validUntil', v_row.data->>'validUntil', 'totalCents', v_row.data->'totalCents', 'taxCents', v_row.data->'taxCents', 'taxRate', v_row.data->'taxRate',
    'advanceCents', v_row.data->'advanceCents', 'notes', v_row.data->>'notes',
    'options', v_row.data->'options', 'chosenOption', v_row.data->'chosenOption', 'acceptedOnline', v_row.data->>'acceptedOnline',
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.data->>'name', 'quantity', i.data->'quantity', 'unit', i.data->>'unit', 'unitPriceCents', i.data->'unitPriceCents') order by (i.data->>'position')::int), '[]'::jsonb)
              from sync_row i where i.business_id = v_row.business_id and i.tbl = 'quoteItem' and i.parent_id = v_row.id and i.deleted_at is null)
  ));
end $$;

-- El cliente acepta (con la opción que eligió). Solo cotizaciones pendientes y vigentes.
create or replace function public_accept_quote(p_token text, p_option int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row sync_row; v_now text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;
  select * into v_row from sync_row where tbl = 'quote' and deleted_at is null and data->>'shareToken' = p_token limit 1;
  if v_row is null then return null; end if;
  if v_row.data->>'status' <> 'pending' then return jsonb_build_object('ok', false, 'status', v_row.data->>'status'); end if;
  if p_option is not null and (p_option < 0 or p_option >= coalesce(jsonb_array_length(v_row.data->'options'), 0)) then p_option := null; end if;
  update sync_row set data = data || jsonb_strip_nulls(jsonb_build_object('status', 'accepted', 'acceptedOnline', v_now, 'chosenOption', p_option, 'updatedAt', v_now))
   where business_id = v_row.business_id and tbl = 'quote' and id = v_row.id;
  return jsonb_build_object('ok', true, 'business', v_row.business_id, 'title', v_row.data->>'title', 'number', v_row.data->'number');
end $$;

-- Para avisar al negocio que el cliente aceptó (lo usa api/cotizacion.ts con la clave de DIGEST_KEY).
create or replace function push_subs_for_business(p_key text, p_business uuid)
returns table (endpoint text, p256dh text, auth text) language plpgsql stable security definer set search_path = public, extensions as $$
declare v_ok boolean;
begin
  select encode(digest(coalesce(p_key, ''), 'sha256'), 'hex') = key_hash into v_ok from digest_key where id = 1;
  if not coalesce(v_ok, false) then raise exception 'sin permiso'; end if;
  return query select s.endpoint, s.p256dh, s.auth from push_subscription s where s.business_id = p_business;
end $$;

revoke all on function public_quote(text), public_accept_quote(text, int), push_subs_for_business(text, uuid) from public;
grant execute on function public_quote(text), public_accept_quote(text, int), push_subs_for_business(text, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
