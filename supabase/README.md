# Supabase de TapLoop

El sitio es estático (GitHub Pages) y ya **no vende en línea**: todos los productos se
solicitan por cotización. El formulario de cotización (`script.js`) guarda cada solicitud
en la tabla `quote_requests` y envía un aviso por EmailJS.

## Tienda anterior (Stripe) — retirada

La compra con Stripe se eliminó del sitio. Las Edge Functions `create-checkout-session` y
`stripe-webhook` se borraron del repositorio, pero si siguen publicadas en Supabase hay que
retirarlas a mano:

```bash
supabase functions delete create-checkout-session --project-ref ejhkjyofrazyxtxkohfo
supabase functions delete stripe-webhook --project-ref ejhkjyofrazyxtxkohfo
```

Y en Stripe → Developers → Webhooks, desactiva o elimina el endpoint
`https://ejhkjyofrazyxtxkohfo.supabase.co/functions/v1/stripe-webhook`.

Las tablas de pedidos (`orders`, `order_items`, `order_files`, …) de las migraciones en
`migrations/` se conservan con el historial de pedidos anteriores.
