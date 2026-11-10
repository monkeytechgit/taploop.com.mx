# Tienda TapLoop: Stripe + Supabase

El sitio es estático (GitHub Pages). El cobro pasa por dos Edge Functions del proyecto
de Supabase de TapLoop (`ejhkjyofrazyxtxkohfo`):

| Función | Qué hace |
|---|---|
| `create-checkout-session` | Valida el carrito, calcula precios con `_shared/catalog.ts`, guarda el pedido, genera URLs firmadas para subir logos y crea la sesión de Stripe Checkout. |
| `stripe-webhook` | Recibe los avisos de Stripe: marca el pedido como pagado y guarda cliente, dirección, importes y la sesión completa. Revisa qué archivos sí se subieron. |

## Tablas (migración `20261109000000_tienda_pedidos.sql`)

- `orders`: un renglón por pedido (`order_number` empieza en 1001). Estado, importes, cliente, envío, datos de Stripe, página de origen, UTM y el carrito original.
- `order_items`: cada producto del pedido, con precio, escalón, diseño (`taploop` / `custom`), paquete y estado de producción.
- `order_files`: logos y diseños, enlazados al producto (`order_item_id`) y guardados en el bucket privado `order-files`.
- `order_review_links`: enlaces de reseñas de Google de cada producto.
- `order_events`: historial (creación, pago, cambios de estado, reembolsos).
- `stripe_events`: cada webhook recibido (evita procesarlo dos veces).
- Vista `order_overview`: resumen legible de cada pedido.

Todas tienen RLS activado sin políticas públicas: solo las funciones (service role) escriben.

## Publicar (una sola vez)

```bash
# 1. Inicia sesión con la cuenta dueña del proyecto de TapLoop
supabase login
supabase link --project-ref ejhkjyofrazyxtxkohfo

# 2. Crear tablas y bucket (o pega el .sql en el SQL Editor de Supabase)
supabase db push

# 3. Llaves (Stripe → Developers → API keys)
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx SITE_URL=https://www.taploop.com.mx

# 4. Funciones
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

5. En Stripe → Developers → Webhooks → **Add endpoint**:
   - URL: `https://ejhkjyofrazyxtxkohfo.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
6. Copia el *Signing secret* del webhook:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Cambiar precios

Los precios viven en dos lugares y deben coincidir:

- `supabase/functions/_shared/catalog.ts` (lo que se cobra; vuelve a publicar `create-checkout-session`).
- `tienda.js` → `PRODUCTS` (lo que se muestra).

## Ver los archivos de un pedido

Supabase → Storage → `order-files` → `orders/<número>-<id>/`. La ruta exacta de cada archivo está en `order_files.storage_path`.
