-- El enlace de Google es opcional al comprar la tarjeta para reseñas.
-- review_link_pending = true cuando el cliente no lo envió y hay que pedírselo.
alter table public.order_items
  add column if not exists review_link_pending boolean not null default false;

-- Vista con el pendiente visible
drop view if exists public.order_overview;
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
  (select string_agg(i.customer_notes, ' · ' order by i.position) from public.order_items i where i.order_id = o.id and i.customer_notes is not null) as customer_notes,
  exists (select 1 from public.order_items i where i.order_id = o.id and (i.review_link_pending or i.logo_pending)) as needs_customer_info,
  o.paid_at,
  o.created_at,
  o.id
from public.orders o
order by o.created_at desc;

revoke all on public.order_overview from anon, authenticated;
