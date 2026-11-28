-- Seguimiento de una obra para el cliente: solo con el código secreto de esa obra (job.trackToken), que el
-- negocio genera y comparte a mano cuando el cliente lo pide. Muestra etapa, entrega, fotos y saldo; nada más.
create index if not exists sync_row_track on sync_row ((data->'job'->>'trackToken')) where data->'job' ? 'trackToken';

create or replace function public_job_status(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_row sync_row;
  v_b jsonb;
  v_contact text;
  v_total bigint;
  v_paid bigint := 0;
  v_sale uuid;
  v_job jsonb;
begin
  if coalesce(p_token, '') !~ '^[A-Za-z0-9_-]{16,64}$' then return null; end if;
  select * into v_row from sync_row r
   where r.tbl in ('quote', 'txn') and r.deleted_at is null and r.data->'job'->>'trackToken' = p_token limit 1;
  if v_row is null then return null; end if;
  v_job := v_row.data->'job';
  select data into v_b from sync_row where business_id = v_row.business_id and tbl = 'business' and id = v_row.business_id;
  select split_part(data->>'name', ' ', 1) into v_contact from sync_row
   where business_id = v_row.business_id and tbl = 'contact' and id::text = v_row.data->>'contactId';

  v_total := coalesce((v_row.data->>(case when v_row.tbl = 'quote' then 'totalCents' else 'amountCents' end))::bigint, 0);
  v_sale := case when v_row.tbl = 'txn' then v_row.id else nullif(v_row.data->>'transactionId', '')::uuid end;
  if v_sale is not null then
    select coalesce(sum((p.data->>'amountCents')::bigint), 0) into v_paid from sync_row p
     where p.business_id = v_row.business_id and p.tbl = 'payment' and p.deleted_at is null and p.data->>'transactionId' = v_sale::text;
    -- Venta de contado: ya está pagada.
    if v_row.tbl = 'txn' and v_row.data->>'status' = 'paid' then v_paid := v_total; end if;
    if v_row.tbl = 'quote' and exists (select 1 from sync_row t where t.business_id = v_row.business_id and t.tbl = 'txn' and t.id = v_sale and t.data->>'status' = 'paid') then v_paid := v_total; end if;
  elsif v_row.tbl = 'quote' then
    v_paid := coalesce((v_row.data->>'advanceCents')::bigint, 0);
  end if;
  if coalesce((v_job->>'paid')::boolean, false) or v_job->>'stage' = 'liquidado' then v_paid := v_total; end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'business', jsonb_build_object('name', v_b->>'name', 'phone', v_b->>'phone', 'country', v_b->>'country', 'logo', v_b->>'logo', 'currency', coalesce(v_b->>'currency', 'MXN')),
    'customer', v_contact,
    'title', coalesce(nullif(v_row.data->>'title', ''), nullif(v_row.data->>'concept', ''), 'Tu mueble'),
    'stage', v_job->>'stage',
    'deliveryDate', v_job->>'deliveryDate',
    'deliveredAt', v_job->>'deliveredAt',
    'photos', coalesce(v_job->'photos', '[]'::jsonb),
    'totalCents', v_total,
    'paidCents', least(v_paid, v_total),
    'updatedAt', v_row.updated_at
  ));
end $$;

revoke all on function public_job_status(text) from public;
grant execute on function public_job_status(text) to anon, authenticated;
