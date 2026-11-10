// Webhook de Stripe: confirma pagos y guarda todos los datos del cliente y del envío.
// Se publica con --no-verify-jwt; la seguridad la da la firma de Stripe (STRIPE_WEBHOOK_SECRET).
// Eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.

import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { FILES_BUCKET } from '../_shared/catalog.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-02-24.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

const pesos = (cents: number | null | undefined) => (typeof cents === 'number' ? cents / 100 : null);
const now = () => new Date().toISOString();

const orderIdFromSession = (session: Stripe.Checkout.Session) => session.metadata?.order_id || session.client_reference_id || null;

const logEvent = (orderId: string, eventType: string, data: unknown) => (
  supabase.from('order_events').insert({ order_id: orderId, event_type: eventType, data })
);

// Revisa en Storage qué archivos sí se subieron y actualiza su estado.
const verifyFiles = async (orderId: string) => {
  const { data: files } = await supabase.from('order_files').select('id, storage_path').eq('order_id', orderId);
  for (const file of files ?? []) {
    const slash = file.storage_path.lastIndexOf('/');
    const folder = file.storage_path.slice(0, slash);
    const name = file.storage_path.slice(slash + 1);
    const { data: found } = await supabase.storage.from(FILES_BUCKET).list(folder, { search: name, limit: 1 });
    const uploaded = Boolean(found?.some((object) => object.name === name));
    await supabase.from('order_files').update({
      upload_status: uploaded ? 'uploaded' : 'missing',
      uploaded_at: uploaded ? now() : null,
    }).eq('id', file.id);
  }
};

const saveSession = async (sessionId: string, statusOverride?: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items', 'payment_intent'] });
  const orderId = orderIdFromSession(session);
  if (!orderId) return null;

  const details = session.customer_details;
  // Según la versión de la API, el envío llega en collected_information o en shipping_details.
  const shipping = (session as unknown as { collected_information?: { shipping_details?: Stripe.Checkout.Session.ShippingDetails } })
    .collected_information?.shipping_details ?? session.shipping_details ?? null;
  const paymentIntent = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';

  const { error } = await supabase.from('orders').update({
    status: statusOverride ?? (paid ? 'paid' : 'pending_payment'),
    payment_status: session.payment_status,
    amount_subtotal_paid: pesos(session.amount_subtotal),
    amount_total_paid: pesos(session.amount_total),
    amount_tax_paid: pesos(session.total_details?.amount_tax),
    discount_amount: pesos(session.total_details?.amount_discount) ?? 0,
    shipping_amount: pesos(session.total_details?.amount_shipping) ?? 0,
    customer_email: details?.email ?? null,
    customer_name: details?.name ?? null,
    customer_phone: details?.phone ?? null,
    customer_tax_ids: details?.tax_ids?.length ? details.tax_ids : null,
    billing_address: details?.address ?? null,
    shipping_name: shipping?.name ?? null,
    shipping_phone: details?.phone ?? null,
    shipping_line1: shipping?.address?.line1 ?? null,
    shipping_line2: shipping?.address?.line2 ?? null,
    shipping_city: shipping?.address?.city ?? null,
    shipping_state: shipping?.address?.state ?? null,
    shipping_postal_code: shipping?.address?.postal_code ?? null,
    shipping_country: shipping?.address?.country ?? null,
    stripe_payment_intent_id: paymentIntent?.id ?? (typeof session.payment_intent === 'string' ? session.payment_intent : null),
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    stripe_payment_method_types: paymentIntent?.payment_method_types ?? session.payment_method_types ?? null,
    stripe_livemode: session.livemode,
    stripe_session_raw: session,
    paid_at: paid ? now() : null,
  }).eq('id', orderId);
  if (error) throw error;

  await verifyFiles(orderId);
  return orderId;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error('Firma de Stripe no válida', error);
    return new Response('Firma no válida', { status: 400 });
  }

  // Idempotencia: Stripe puede reenviar el mismo evento.
  const { data: existing } = await supabase.from('stripe_events').select('processed_at').eq('id', event.id).maybeSingle();
  if (existing?.processed_at) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  if (!existing) {
    await supabase.from('stripe_events').insert({ id: event.id, type: event.type, livemode: event.livemode, payload: event });
  }

  let orderId: string | null = null;
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId = await saveSession(session.id);
        if (orderId) await logEvent(orderId, 'checkout_completed', { session_id: session.id, payment_status: session.payment_status });
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId = await saveSession(session.id, 'paid');
        if (orderId) await logEvent(orderId, 'async_payment_succeeded', { session_id: session.id });
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId = await saveSession(session.id, 'payment_failed');
        if (orderId) await logEvent(orderId, 'async_payment_failed', { session_id: session.id });
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        orderId = orderIdFromSession(session);
        if (orderId) {
          await supabase.from('orders').update({ status: 'expired', expired_at: now() })
            .eq('id', orderId).eq('status', 'pending_payment');
          await logEvent(orderId, 'checkout_expired', { session_id: session.id });
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        const { data: order } = await supabase.from('orders').select('id').eq('stripe_payment_intent_id', paymentIntentId ?? '').maybeSingle();
        if (order) {
          orderId = order.id;
          const fullyRefunded = charge.amount_refunded >= charge.amount;
          if (fullyRefunded) await supabase.from('orders').update({ status: 'refunded', refunded_at: now() }).eq('id', order.id);
          await logEvent(order.id, fullyRefunded ? 'refunded' : 'partially_refunded', {
            amount_refunded: pesos(charge.amount_refunded),
            charge_id: charge.id,
          });
        }
        break;
      }
      default:
        break;
    }

    await supabase.from('stripe_events').update({ processed_at: now(), order_id: orderId, error: null }).eq('id', event.id);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('stripe-webhook', event.type, error);
    await supabase.from('stripe_events').update({ error: error instanceof Error ? error.message : String(error), order_id: orderId }).eq('id', event.id);
    // 500 para que Stripe reintente más tarde.
    return new Response('Error al procesar el evento', { status: 500 });
  }
});
