-- T13: la tabla `employee` (dueño con PIN y empleados) se sincroniza como una entidad más.
create or replace function sync_table_kind(p_tbl text) returns text
language sql immutable as $$
  select case
    when p_tbl in ('stockMovement', 'payment') then 'ledger'
    when p_tbl in ('txnItem', 'quoteItem', 'orderItem', 'purchaseItem') then 'child'
    when p_tbl in ('business', 'contact', 'category', 'product', 'productVariant', 'txn', 'quote', 'order', 'purchase', 'employee') then 'row'
    else null
  end
$$;
