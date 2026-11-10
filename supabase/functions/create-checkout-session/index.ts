// Crea el pedido en la base de datos y la sesión de Stripe Checkout.
// POST { items: CartItem[], context?: {...} }
// Responde { orderId, orderNumber, checkoutUrl, uploads: [{ position, signedUrl }] }
// El navegador sube cada logo/diseño a su URL firmada y después redirige a checkoutUrl.

import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  CARD_PRODUCTS,
  GOOGLE_PRODUCT,
  MAX_CARDS_PER_PRODUCT,
  MAX_FILE_BYTES,
  FILES_BUCKET,
  cardTier,
  type CardProductId,
} from '../_shared/catalog.ts';
import { corsHeaders, json, siteUrl } from '../_shared/http.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2025-02-24.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

interface IncomingFile { name?: unknown; size?: unknown; type?: unknown }
interface IncomingItem {
  product?: unknown;
  qty?: unknown;
  design?: unknown;
  file?: IncomingFile | null;
  pack?: unknown;
  reviewLinks?: unknown;
  notes?: unknown;
}

class CheckoutError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const isInt = (value: unknown, min: number, max: number): value is number => (
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
);

const cleanText = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const safeFileName = (name: string) => {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return base.slice(-120) || 'archivo';
};

const validReviewLink = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const toCents = (pesos: number) => Math.round(pesos * 100);

interface PreparedItem {
  position: number;
  productId: 'pvc' | 'metal' | 'google';
  productName: string;
  stripeProductId: string;
  stripePriceId: string;
  pricingTier: string;
  packSize: number | null;
  quantity: number;
  cardsCount: number;
  unitPrice: number;
  compareAt: number;
  lineTotal: number;
  design: 'taploop' | 'custom' | null;
  file: { name: string; size: number; type: string } | null;
  reviewLinks: string[];
  notes: string;
}

const prepareItems = (rawItems: unknown): PreparedItem[] => {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 30) {
    throw new CheckoutError('INVALID_CART', 'El carrito está vacío o tiene demasiados productos.');
  }

  // Totales por tarjeta de presentación para elegir el precio por volumen.
  const cardTotals: Record<CardProductId, number> = { pvc: 0, metal: 0 };
  for (const raw of rawItems as IncomingItem[]) {
    if ((raw.product === 'pvc' || raw.product === 'metal') && isInt(raw.qty, 1, MAX_CARDS_PER_PRODUCT)) {
      cardTotals[raw.product] += raw.qty;
    }
  }
  for (const [productId, total] of Object.entries(cardTotals)) {
    if (total > MAX_CARDS_PER_PRODUCT) {
      throw new CheckoutError('TEAM_QUOTE', `Para 10 o más ${CARD_PRODUCTS[productId as CardProductId].name.toLowerCase()} solicita una cotización de equipo.`);
    }
  }

  return (rawItems as IncomingItem[]).map((raw, index) => {
    const position = index + 1;
    const notes = cleanText(raw.notes, 1000);

    if (raw.product === 'pvc' || raw.product === 'metal') {
      if (!isInt(raw.qty, 1, MAX_CARDS_PER_PRODUCT)) throw new CheckoutError('INVALID_QTY', 'Cantidad no válida.');
      const design = raw.design === 'taploop' ? 'taploop' : 'custom';
      const product = CARD_PRODUCTS[raw.product];
      const tier = cardTier(cardTotals[raw.product]);
      const { price, stripePriceId } = product.tiers[tier];

      let file: PreparedItem['file'] = null;
      if (design === 'custom' && raw.file && typeof raw.file === 'object') {
        const name = cleanText(raw.file.name, 200);
        const size = Number(raw.file.size);
        if (name && Number.isFinite(size) && size > 0) {
          if (size > MAX_FILE_BYTES) throw new CheckoutError('FILE_TOO_LARGE', `El archivo ${name} pesa más de 10 MB.`);
          file = { name, size, type: cleanText(raw.file.type, 100) || 'application/octet-stream' };
        }
      }

      return {
        position,
        productId: raw.product,
        productName: product.name,
        stripeProductId: product.stripeProductId,
        stripePriceId,
        pricingTier: tier,
        packSize: null,
        quantity: raw.qty,
        cardsCount: raw.qty,
        unitPrice: price,
        compareAt: product.compareAt,
        lineTotal: price * raw.qty,
        design,
        file,
        reviewLinks: [],
        notes,
      };
    }

    if (raw.product === 'google') {
      const pack = GOOGLE_PRODUCT.packs[Number(raw.pack)];
      if (!pack) throw new CheckoutError('INVALID_PACK', 'Paquete no válido.');
      if (!isInt(raw.qty, 1, 10)) throw new CheckoutError('INVALID_QTY', 'Cantidad no válida.');
      // El enlace es opcional: si no viene, el pedido queda con review_link_pending para pedirlo después.
      const links = (Array.isArray(raw.reviewLinks) ? raw.reviewLinks.map(validReviewLink).filter(Boolean) as string[] : []).slice(0, 10);
      return {
        position,
        productId: 'google',
        productName: GOOGLE_PRODUCT.name,
        stripeProductId: GOOGLE_PRODUCT.stripeProductId,
        stripePriceId: pack.stripePriceId,
        pricingTier: `pack_${raw.pack}`,
        packSize: Number(raw.pack),
        quantity: raw.qty,
        cardsCount: Number(raw.pack) * raw.qty,
        unitPrice: pack.price,
        compareAt: pack.compareAt,
        lineTotal: pack.price * raw.qty,
        design: null,
        file: null,
        reviewLinks: links,
        notes,
      };
    }

    throw new CheckoutError('INVALID_PRODUCT', 'Producto no válido.');
  });
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido.' }, 405);

  let orderId: string | null = null;
  try {
    const body = await request.json().catch(() => null);
    const items = prepareItems(body?.items);
    const context = body?.context && typeof body.context === 'object' ? body.context : {};
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    // 1. Pedido
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      subtotal: total,
      total,
      shipping_amount: 0,
      source_page: cleanText(context.page, 500) || null,
      referrer: cleanText(context.referrer, 500) || null,
      utm: context.utm && typeof context.utm === 'object' ? context.utm : null,
      user_agent: cleanText(request.headers.get('user-agent'), 500) || null,
      client_cart: body.items,
    }).select('id, order_number').single();
    if (orderError) throw orderError;
    orderId = order.id;

    // 2. Productos
    const { data: savedItems, error: itemsError } = await supabase.from('order_items').insert(items.map((item) => ({
      order_id: order.id,
      position: item.position,
      product_id: item.productId,
      product_name: item.productName,
      stripe_product_id: item.stripeProductId,
      stripe_price_id: item.stripePriceId,
      pricing_tier: item.pricingTier,
      pack_size: item.packSize,
      quantity: item.quantity,
      cards_count: item.cardsCount,
      unit_price: item.unitPrice,
      compare_at_unit_price: item.compareAt,
      line_total: item.lineTotal,
      design: item.design,
      logo_pending: item.design === 'custom' && !item.file,
      review_link_pending: item.productId === 'google' && item.reviewLinks.length === 0,
      customer_notes: item.notes || null,
    }))).select('id, position');
    if (itemsError) throw itemsError;
    const itemIdByPosition = new Map(savedItems.map((row) => [row.position, row.id]));

    // 3. Enlaces de reseñas de Google
    const links = items.flatMap((item) => item.reviewLinks.map((url, index) => ({
      order_id: order.id,
      order_item_id: itemIdByPosition.get(item.position),
      position: index + 1,
      url,
    })));
    if (links.length) {
      const { error } = await supabase.from('order_review_links').insert(links);
      if (error) throw error;
    }

    // 4. Archivos: registro + URL firmada para que el navegador los suba
    const uploads: { position: number; signedUrl: string; path: string }[] = [];
    for (const item of items) {
      if (!item.file) continue;
      const path = `orders/${order.order_number}-${order.id}/${item.position}-${safeFileName(item.file.name)}`;
      const { error: fileError } = await supabase.from('order_files').insert({
        order_id: order.id,
        order_item_id: itemIdByPosition.get(item.position),
        bucket: FILES_BUCKET,
        storage_path: path,
        original_name: item.file.name,
        content_type: item.file.type,
        size_bytes: item.file.size,
      });
      if (fileError) throw fileError;
      const { data: signed, error: signError } = await supabase.storage.from(FILES_BUCKET).createSignedUploadUrl(path);
      if (signError) throw signError;
      uploads.push({ position: item.position, signedUrl: signed.signedUrl, path });
    }

    // 5. Sesión de Stripe Checkout (un renglón por precio de Stripe)
    const lineItems = new Map<string, number>();
    for (const item of items) lineItems.set(item.stripePriceId, (lineItems.get(item.stripePriceId) || 0) + item.quantity);

    const site = siteUrl();
    const returnPage = cleanText(context.page, 300);
    const cancelUrl = returnPage.startsWith(site) ? returnPage : `${site}/tarjetas-nfc.html`;
    const metadata = { order_id: order.id, order_number: String(order.order_number) };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'es',
      line_items: [...lineItems].map(([price, quantity]) => ({ price, quantity })),
      client_reference_id: order.id,
      metadata,
      payment_intent_data: { metadata, description: `Pedido TapLoop #${order.order_number}` },
      customer_creation: 'always',
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ['MX'] },
      shipping_options: [{
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: 'Envío gratis',
          fixed_amount: { amount: 0, currency: 'mxn' },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 5 },
          },
        },
      }],
      success_url: `${site}/compra-exitosa.html?pedido=${order.order_number}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}pago=cancelado`,
    });

    if (session.amount_total !== toCents(total)) {
      console.warn(`Total distinto: pedido ${total} MXN, Stripe ${session.amount_total} centavos`);
    }

    await supabase.from('orders').update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
      stripe_livemode: session.livemode,
    }).eq('id', order.id);
    await supabase.from('order_events').insert({
      order_id: order.id,
      event_type: 'checkout_session_created',
      data: { session_id: session.id, amount_total: session.amount_total, line_items: [...lineItems] },
    });

    return json(request, {
      orderId: order.id,
      orderNumber: order.order_number,
      checkoutUrl: session.url,
      uploads,
    });
  } catch (error) {
    const isKnown = error instanceof CheckoutError;
    console.error('create-checkout-session', error);
    if (orderId) {
      await supabase.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', orderId);
      await supabase.from('order_events').insert({
        order_id: orderId,
        event_type: 'checkout_error',
        data: { message: error instanceof Error ? error.message : String(error) },
      });
    }
    return json(
      request,
      {
        error: isKnown ? error.message : 'No pudimos preparar el pago. Intenta de nuevo en unos minutos.',
        code: isKnown ? error.code : 'CHECKOUT_FAILED',
      },
      isKnown ? 400 : 500,
    );
  }
});
