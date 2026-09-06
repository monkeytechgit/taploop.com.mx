(() => {
  const config = window.TaploeEcommerce || {};
  const pathname = window.location.pathname.toLowerCase();
  const market = config.market || document.documentElement.dataset.market || (pathname.includes('/us/') ? 'us' : 'mx');
  const locale = config.locale || document.documentElement.dataset.locale || (market === 'us' ? 'en-US' : 'es-MX');
  const currency = config.currency || (market === 'us' ? 'USD' : 'MXN');
  const cartKey = config.cartStorageKey || `taploeCart:${market}`;
  const pendingCheckoutKey = config.pendingCheckoutStorageKey || `taploePendingCheckout:${market}`;
  const copy = market === 'us'
    ? {
        processing: 'Confirming payment and saving your order...',
        saved: 'Order saved. We received your purchase and will continue with production.',
        missing: 'Payment was received, but this browser no longer has the cart configuration. Contact Taploe with your Stripe receipt.',
        error: 'Payment was received, but we could not save the order configuration. Contact Taploe with your Stripe receipt.'
      }
    : {
        processing: 'Confirmando pago y guardando tu orden...',
        saved: 'Orden guardada. Recibimos tu compra y continuaremos con la producción.',
        missing: 'El pago fue recibido, pero este navegador ya no tiene la configuración del carrito. Contacta a Taploe con tu recibo de Stripe.',
        error: 'El pago fue recibido, pero no pudimos guardar la configuración de la orden. Contacta a Taploe con tu recibo de Stripe.'
      };
  const status = document.querySelector('[data-checkout-save-status]');
  const setStatus = (message) => {
    if (status) status.textContent = message;
  };
  const supabaseBaseUrl = () => (config.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const supabaseReady = () => config.supabaseUrl && config.supabaseAnonKey && supabaseBaseUrl();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const checkoutRef = params.get('ref');

  const openLogoDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('taploe-ecommerce', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('logos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const getLogoFile = async (id) => {
    const db = await openLogoDb();
    const file = await new Promise((resolve, reject) => {
      const tx = db.transaction('logos', 'readonly');
      const request = tx.objectStore('logos').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return file;
  };

  const uploadLogo = async (item) => {
    if (!item.logo || !supabaseReady()) return item.logo || null;
    const file = await getLogoFile(item.id);
    if (!file) return item.logo;
    const safeName = item.logo.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${checkoutRef}/${item.id}/${safeName}`;
    const response = await fetch(`${supabaseBaseUrl()}/storage/v1/object/order-assets/${path}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: file
    });
    if (!response.ok) return item.logo;
    return {
      ...item.logo,
      storage_bucket: 'order-assets',
      storage_path: path,
      public_url: `${supabaseBaseUrl()}/storage/v1/object/public/order-assets/${path}`
    };
  };

  const complete = async () => {
    if (!sessionId || !checkoutRef || !supabaseReady()) return;
    const pending = JSON.parse(localStorage.getItem(pendingCheckoutKey) || 'null');
    if (!pending || pending.checkoutRef !== checkoutRef || !Array.isArray(pending.cart)) {
      setStatus(copy.missing);
      return;
    }

    setStatus(copy.processing);
    try {
      const cart = await Promise.all(pending.cart.map(async (item) => ({
        ...item,
        logo: await uploadLogo(item)
      })));
      const response = await fetch(`${supabaseBaseUrl()}/functions/v1/${config.webCartCompleteFunction || 'complete-checkout-order'}`, {
        method: 'POST',
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          checkout_ref: checkoutRef,
          market,
          locale,
          currency,
          cart,
          source_url: pending.sourceUrl || ''
        })
      });
      if (!response.ok) throw new Error(await response.text());
      localStorage.removeItem(cartKey);
      localStorage.removeItem(pendingCheckoutKey);
      window.dispatchEvent(new CustomEvent('taploe:cart-updated'));
      setStatus(copy.saved);
    } catch (error) {
      setStatus(copy.error);
    }
  };

  complete();
})();
