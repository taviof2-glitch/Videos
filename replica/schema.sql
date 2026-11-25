-- Esquema Postgres (Supabase) para la sincronización de T13/T15.
-- La app arranca local-first con Dexie; este esquema refleja las mismas tablas.
-- Dinero en centavos (bigint). Fechas en timestamptz (UTC). Acceso por RLS.

create table business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  country text not null default 'MX',
  currency text not null default 'MXN',
  timezone text not null default 'America/Mexico_City',
  phone text,
  address text,
  opening_hours text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table membership (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references business(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','employee')),
  permissions jsonb not null default '{}',
  primary key (user_id, business_id)
);
create index on membership (business_id);

create table contact (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  type text not null check (type in ('customer','supplier')),
  name text not null,
  phone text,
  document_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on contact (business_id, type, name);

create table category (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  kind text not null check (kind in ('product','expense')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on category (business_id, kind);

create table product (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  category_id uuid references category(id) on delete set null,
  name text not null,
  barcode text,
  price_cents bigint not null default 0 check (price_cents >= 0),
  cost_cents bigint not null default 0 check (cost_cents >= 0),
  stock numeric not null default 0,
  min_stock numeric not null default 0,
  visible_in_catalog boolean not null default false,
  photo_paths text[] not null default '{}', -- rutas en Supabase Storage (máx. 3)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on product (business_id, name);
create index on product (business_id, barcode);
create index on product (category_id);

create table transaction_ (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id) on delete cascade,
  type text not null check (type in ('sale','expense')),
  amount_cents bigint not null check (amount_cents >= 0),
  concept text,
  occurred_at timestamptz not null default now(),
  payment_method text check (payment_method in ('cash','transfer','card','other')),
  status text not null default 'paid' check (status in ('paid','credit')),
  contact_id uuid references contact(id) on delete set null,
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  source text not null default 'app' check (source in ('app','web','catalog')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on transaction_ (business_id, occurred_at);
create index on transaction_ (business_id, type);
create index on transaction_ (contact_id);

create table transaction_item (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transaction_(id) on delete cascade,
  product_id uuid references product(id) on delete set null,
  quantity numeric not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  unit_cost_cents bigint not null default 0 check (unit_cost_cents >= 0)
);
create index on transaction_item (transaction_id);
create index on transaction_item (product_id);

create table payment (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transaction_(id) on delete cascade,
  contact_id uuid references contact(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  method text check (method in ('cash','transfer','card','other')),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on payment (transaction_id);
create index on payment (contact_id);

create table stock_movement (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references product(id) on delete cascade,
  transaction_id uuid references transaction_(id) on delete set null,
  delta numeric not null,
  reason text not null check (reason in ('sale','purchase','adjust','order','void')),
  created_at timestamptz not null default now()
);
create index on stock_movement (product_id, created_at);
create index on stock_movement (transaction_id);

-- Tablas de T8-T12 (quote, purchase, "order", product_variant) se añaden en sus tareas.

-- RLS: un usuario solo ve filas de negocios donde tiene membresía.
alter table business enable row level security;
alter table membership enable row level security;
alter table contact enable row level security;
alter table category enable row level security;
alter table product enable row level security;
alter table transaction_ enable row level security;
alter table transaction_item enable row level security;
alter table payment enable row level security;
alter table stock_movement enable row level security;
-- Política tipo (repetir por tabla con business_id):
--   create policy "miembros" on contact using (
--     business_id in (select business_id from membership where user_id = auth.uid()));
