-- Tienda TapLoop: pedidos pagados con Stripe Checkout.
-- Todas las tablas tienen RLS activado y ninguna política pública: solo las
-- Edge Functions (service role) pueden leer y escribir. Consulta los pedidos
-- desde el panel de Supabase (Table editor) o con la vista public.order_overview.

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001) unique,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'payment_failed', 'expired', 'in_design',
                      'in_production', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status text,                        -- payment_status de Stripe (paid, unpaid, no_payment_required)
  currency text not null default 'mxn',

  -- Importes en pesos MXN calculados por el servidor al crear el pedido
  subtotal numeric(10, 2) not null,
  shipping_amount numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  -- Importes confirmados por Stripe al pagar
  amount_subtotal_paid numeric(10, 2),
  amount_total_paid numeric(10, 2),
  amount_tax_paid numeric(10, 2),

  -- Cliente (lo captura Stripe Checkout)
  customer_email text,
  customer_name text,
  customer_phone text,
  customer_tax_ids jsonb,

  -- Envío (lo captura Stripe Checkout)
  shipping_name text,
  shipping_phone text,
  shipping_line1 text,
  shipping_line2 text,
  shipping_city text,
  shipping_state text,
  shipping_postal_code text,
  shipping_country text,
  shipping_method text default 'Envío gratis',
  billing_address jsonb,

  -- Stripe
  stripe_checkout_session_id text unique,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_payment_method_types text[],
  stripe_livemode boolean,
  stripe_session_raw jsonb,                   -- objeto completo de la sesión de Checkout

  -- Contexto de la compra
  source_page text,
  referrer text,
  utm jsonb,
  user_agent text,
  locale text default 'es-MX',
  client_cart jsonb,                          -- carrito tal como lo envió el navegador
  internal_notes text,

  -- Seguimiento
  tracking_carrier text,
  tracking_number text,
  paid_at timestamptz,
  expired_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_customer_email_idx on public.orders (lower(customer_email));
create index orders_payment_intent_idx on public.orders (stripe_payment_intent_id);

-- ---------------------------------------------------------------------------
-- Productos de cada pedido
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  position integer not null,                  -- orden dentro del carrito
  product_id text not null check (product_id in ('pvc', 'metal', 'google')),
  product_name text not null,
  stripe_product_id text not null,
  stripe_price_id text not null,
  pricing_tier text not null,                 -- single | multi | bulk | pack_1 | pack_2 | pack_5 | pack_10
  pack_size integer,                          -- tarjetas por paquete (reseñas de Google)
  quantity integer not null check (quantity > 0),   -- unidades del precio de Stripe (tarjetas o paquetes)
  cards_count integer not null check (cards_count > 0), -- tarjetas físicas a producir
  unit_price numeric(10, 2) not null,         -- precio por unidad (tarjeta o paquete)
  compare_at_unit_price numeric(10, 2),       -- precio de lista mostrado tachado
  line_total numeric(10, 2) not null,
  design text check (design in ('taploop', 'custom')),  -- solo tarjetas de presentación
  logo_pending boolean not null default false,          -- diseño personalizado sin archivo: lo envían después
  customer_notes text,
  production_status text not null default 'pending'
    check (production_status in ('pending', 'design_sent', 'design_approved', 'in_production', 'ready', 'shipped')),
  design_approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Archivos (logos y diseños) subidos con cada producto
-- ---------------------------------------------------------------------------
create table public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  bucket text not null default 'order-files',
  storage_path text not null unique,
  original_name text not null,
  content_type text,
  size_bytes bigint,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'missing')),
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create index order_files_order_id_idx on public.order_files (order_id);

-- ---------------------------------------------------------------------------
-- Enlaces de reseñas de Google (tarjeta para reseñas)
-- ---------------------------------------------------------------------------
create table public.order_review_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  position integer not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index order_review_links_order_id_idx on public.order_review_links (order_id);

-- ---------------------------------------------------------------------------
-- Historial de cada pedido (creación, pago, envío, etc.)
-- ---------------------------------------------------------------------------
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  data jsonb,
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Eventos recibidos de Stripe (evita procesar dos veces el mismo webhook)
-- ---------------------------------------------------------------------------
create table public.stripe_events (
  id text primary key,                        -- id del evento de Stripe (evt_...)
  type text not null,
  livemode boolean,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at automático y registro de cambios de estado
-- ---------------------------------------------------------------------------
create or replace function public.orders_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.order_events (order_id, event_type, from_status, to_status)
    values (new.id, 'status_changed', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger orders_touch
before update on public.orders
for each row execute function public.orders_touch();

-- ---------------------------------------------------------------------------
-- Vista para revisar pedidos de un vistazo
-- ---------------------------------------------------------------------------
create view public.order_overview
with (security_invoker = true) as
select
  o.order_number,
  o.status,
  o.total,
  o.customer_name,
  o.customer_email,
  o.customer_phone,
  concat_ws(', ', o.shipping_line1, o.shipping_line2, o.shipping_city, o.shipping_state, o.shipping_postal_code) as shipping_address,
  (select string_agg(
      i.cards_count || ' × ' || i.product_name
        || coalesce(' (' || case i.design when 'taploop' then 'diseño TapLoop' when 'custom' then 'diseño personalizado' end || ')', ''),
      ' · ' order by i.position)
   from public.order_items i where i.order_id = o.id) as items,
  (select count(*) from public.order_files f where f.order_id = o.id and f.upload_status = 'uploaded') as files_uploaded,
  (select string_agg(l.url, ' , ' order by l.position) from public.order_review_links l where l.order_id = o.id) as review_links,
  o.paid_at,
  o.created_at,
  o.id
from public.orders o
order by o.created_at desc;

-- ---------------------------------------------------------------------------
-- Seguridad: RLS sin políticas públicas (solo service role)
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_files enable row level security;
alter table public.order_review_links enable row level security;
alter table public.order_events enable row level security;
alter table public.stripe_events enable row level security;

revoke all on public.order_overview from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Almacenamiento privado para logos y diseños
-- (las subidas usan URLs firmadas que genera la Edge Function)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-files',
  'order-files',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'application/postscript', 'application/illustrator',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;
