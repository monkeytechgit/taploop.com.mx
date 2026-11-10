// Catálogo de la tienda TapLoop con los precios e IDs de Stripe.
// Es la única fuente de verdad para cobrar: el navegador solo envía qué producto,
// cuántas piezas y los datos de personalización.

export type CardProductId = 'pvc' | 'metal';
export type ProductId = CardProductId | 'google';
export type CardTier = 'single' | 'multi' | 'bulk';

interface CardProduct {
  id: CardProductId;
  name: string;
  stripeProductId: string;
  compareAt: number;
  tiers: Record<CardTier, { price: number; stripePriceId: string }>;
}

interface PackProduct {
  id: 'google';
  name: string;
  stripeProductId: string;
  packs: Record<number, { price: number; compareAt: number; stripePriceId: string }>;
}

export const CARD_PRODUCTS: Record<CardProductId, CardProduct> = {
  pvc: {
    id: 'pvc',
    name: 'Tarjeta NFC de PVC',
    stripeProductId: 'prod_V5husXEJstRstm',
    compareAt: 1149,
    tiers: {
      single: { price: 799, stripePriceId: 'price_1Ua6cX8jI41ivumOZCjzysBC' },
      multi: { price: 649, stripePriceId: 'price_1Ua6cj8jI41ivumOCc50Slkl' },
      bulk: { price: 549, stripePriceId: 'price_1Ua6cv8jI41ivumObFJuiutb' },
    },
  },
  metal: {
    id: 'metal',
    name: 'Tarjeta NFC metálica',
    stripeProductId: 'prod_V5hvqp3gTdRYP4',
    compareAt: 1599,
    tiers: {
      single: { price: 1099, stripePriceId: 'price_1Ua6Zu8jI41ivumOmjJ3IHc5' },
      multi: { price: 849, stripePriceId: 'price_1Ua6aC8jI41ivumOWH86iioI' },
      bulk: { price: 749, stripePriceId: 'price_1Ua6aQ8jI41ivumOlpUBgaWv' },
    },
  },
};

export const GOOGLE_PRODUCT: PackProduct = {
  id: 'google',
  name: 'Tarjeta NFC para reseñas de Google',
  stripeProductId: 'prod_V8Lw75ldJOXvZw',
  packs: {
    1: { price: 549, compareAt: 899, stripePriceId: 'price_1Ua6jD8jI41ivumOWCopaeSa' },
    2: { price: 749, compareAt: 1098, stripePriceId: 'price_1Ua6jN8jI41ivumO1ztgU1G7' },
    5: { price: 1299, compareAt: 2745, stripePriceId: 'price_1Ua6jb8jI41ivumOjxZdfcMx' },
    10: { price: 1999, compareAt: 5490, stripePriceId: 'price_1Ua6jo8jI41ivumO47gr7szb' },
  },
};

// Tarjetas de presentación: el precio por pieza depende del total de esa tarjeta en el pedido.
// 10 o más piezas se atienden con cotización para equipos.
export const MAX_CARDS_PER_PRODUCT = 9;

export const cardTier = (totalQty: number): CardTier => {
  if (totalQty >= 5) return 'bulk';
  if (totalQty >= 2) return 'multi';
  return 'single';
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILES_BUCKET = 'order-files';
