/* Tienda TapLoop: barra de anuncios, catálogo, carrito y compra en páginas de producto.
   El pago se hace con Stripe Checkout a través de la Edge Function create-checkout-session
   (supabase/functions). Los logos se guardan en IndexedDB hasta que se suben al pagar. */
(() => {
  const PRODUCTS = {
    pvc: {
      id: 'pvc',
      name: 'Tarjeta NFC de PVC',
      url: 'tarjeta-digital-nfc-taploop.html',
      image: 'assets/image/productos/producto1pvc.webp',
      hoverImage: 'assets/image/productos/tumarcapvc.webp',
      single: 799,
      multi: 649,
      bulk: 549,
      compare: 1149,
      menuTitle: 'Tarjeta NFC',
      menuText: 'A todo color, con tu marca y perfil digital.',
      reviews: '825 reseñas',
      tagline: 'Ligera e impresa a todo color. Ideal para ventas, eventos y equipos.'
    },
    metal: {
      id: 'metal',
      name: 'Tarjeta NFC metálica',
      url: 'tarjeta-digital-nfc-metalica-taploop.html',
      image: 'assets/image/productos/producto1metal.webp',
      hoverImage: 'assets/image/productos/tumarcametal.webp',
      single: 1099,
      multi: 849,
      bulk: 749,
      compare: 1599,
      menuTitle: 'Tarjeta NFC metálica',
      menuText: 'Negro mate con grabado, acabado premium.',
      reviews: '1,037 reseñas',
      tagline: 'Negro mate con grabado personalizado. Una presentación premium.'
    },
    google: {
      id: 'google',
      kind: 'pack',
      name: 'Tarjeta NFC para reseñas de Google',
      url: 'tarjeta-nfc-resenas-google.html',
      image: 'assets/image/productos/google-nfc.webp',
      menuTitle: 'Tarjeta para reseñas de Google',
      menuText: 'Tus clientes te califican con un toque.',
      tagline: 'Tus clientes te califican en Google con un toque o escaneando el QR.',
      packs: {
        1: { price: 549, compare: 899 },
        2: { price: 749, compare: 1098 },
        5: { price: 1299, compare: 2745 },
        10: { price: 1999, compare: 5490 }
      }
    }
  };
  const isPack = (product) => product?.kind === 'pack';
  const CARD_PRODUCTS = Object.values(PRODUCTS).filter((product) => !isPack(product));

  const TEAM_MIN = 10;
  const MAX_QTY = TEAM_MIN - 1;
  const CART_KEY = 'taploopCart:v1';
  const MAX_LOGO_BYTES = 10 * 1024 * 1024;
  const MAX_STORED_LOGO_BYTES = 1.5 * 1024 * 1024;
  const WHATSAPP_NUMBER = '526643053834';
  const MAX_PACKS = 10;
  const PENDING_ORDER_KEY = 'taploopPendingOrder';

  // Supabase de TapLoop (la llave anon es pública; las tablas solo las escribe la Edge Function).
  const SUPABASE_URL = 'https://ejhkjyofrazyxtxkohfo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaGtqeW9mcmF6eXh0eGtvaGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3Mjg1MjMsImV4cCI6MjA4NzMwNDUyM30.MsYH7bPlJdjJelexsJn_4mLvWu3NMUCTt6mcgn08dZ8';
  const CHECKOUT_ENDPOINT = `${SUPABASE_URL}/functions/v1/create-checkout-session`;

  const ANNOUNCEMENTS = [
    ['fa-truck-fast', 'Envío gratis a todo México'],
    ['fa-receipt', 'Pago único, sin mensualidades'],
    ['fa-gift', 'Diseño con tu logo sin costo'],
    ['fa-mobile-screen-button', 'Compatible con iPhone y Android'],
    ['fa-id-card', 'Uso de la plataforma gratis'],
    ['fa-tags', 'Precio especial desde 2 tarjetas'],
    ['fa-users', 'Equipos de 10 o más: cotización personalizada']
  ];

  const money = (value) => `$${Number(value).toLocaleString('es-MX')} MXN`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
  const clampQty = (value) => Math.min(Math.max(parseInt(value, 10) || 1, 1), MAX_QTY);
  const BULK_MIN = 5;
  // Precio por pieza según el total de esa tarjeta: 1 · 2 a 4 · 5 a 9 (10+ es cotización).
  const unitPrice = (product, totalQty) => {
    if (totalQty >= BULK_MIN) return product.bulk;
    return totalQty >= 2 ? product.multi : product.single;
  };

  /* ---------- Archivos del carrito (IndexedDB) ---------- */

  const FILE_DB = 'taploopCartFiles';
  const FILE_STORE = 'files';
  let fileDbPromise = null;
  const openFileDb = () => {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB no disponible'));
    fileDbPromise = fileDbPromise || new Promise((resolve, reject) => {
      const request = indexedDB.open(FILE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return fileDbPromise;
  };
  const fileStore = async (mode, action) => {
    const db = await openFileDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, mode);
      const request = action(tx.objectStore(FILE_STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    });
  };
  const saveFile = (id, file) => fileStore('readwrite', (store) => store.put(file, id)).catch(() => null);
  const loadFile = (id) => fileStore('readonly', (store) => store.get(id)).catch(() => null);
  const deleteFile = (id) => fileStore('readwrite', (store) => store.delete(id)).catch(() => null);
  const clearFiles = () => fileStore('readwrite', (store) => store.clear()).catch(() => null);

  /* ---------- Carrito (localStorage) ---------- */

  const readCart = () => {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items) ? items.filter((item) => PRODUCTS[item.product]) : [];
    } catch {
      return [];
    }
  };

  const writeCart = (items) => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // Sin espacio: guardamos el carrito sin las vistas previas de los logos.
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(items.map((item) => (
          item.logo ? { ...item, logo: { ...item.logo, dataUrl: null } } : item
        ))));
      } catch {
        /* almacenamiento no disponible */
      }
    }
    renderCart();
  };

  // Total de piezas por tarjeta de presentación (define el precio por volumen).
  const qtyByProduct = (items) => items.reduce((totals, item) => {
    if (isPack(PRODUCTS[item.product])) return totals;
    totals[item.product] = (totals[item.product] || 0) + item.qty;
    return totals;
  }, {});

  const cartSummary = (items = readCart()) => {
    const totals = qtyByProduct(items);
    const lines = items.map((item) => {
      const product = PRODUCTS[item.product];
      const unit = isPack(product) ? product.packs[item.pack]?.price || 0 : unitPrice(product, totals[item.product]);
      return { ...item, productData: product, unit, lineTotal: unit * item.qty };
    });
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return { lines, totals, count, total };
  };

  const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

  /* ---------- Meta Pixel (eventos de venta) ---------- */

  const trackMeta = (event, params = {}, options) => {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', event, { currency: 'MXN', ...params }, options);
    } catch { /* el píxel nunca debe romper la tienda */ }
  };

  // id de Meta por producto: pvc, metal, google-1, google-10…
  const metaContentId = (item) => (isPack(PRODUCTS[item.product]) ? `${item.product}-${item.pack}` : item.product);

  const metaCartData = (summary = cartSummary()) => ({
    value: summary.total,
    num_items: summary.count,
    content_type: 'product',
    content_ids: summary.lines.map(metaContentId),
    contents: summary.lines.map((line) => ({ id: metaContentId(line), quantity: line.qty, item_price: line.unit }))
  });

  // Tarjetas de presentación. file (opcional) es el archivo real del logo o diseño.
  const addToCart = async (productId, qty, logo = null, design = 'custom', file = null) => {
    const items = readCart();
    const logoName = logo?.name || '';
    const existing = items.find((item) => (
      item.product === productId && (item.design || 'custom') === design && (item.logo?.name || '') === logoName
    ));
    if (existing) {
      existing.qty += qty;
    } else {
      const id = newId();
      if (file) await saveFile(id, file);
      items.push({ id, product: productId, qty, logo, design });
    }
    writeCart(items);
    bumpCartBadge();
    const product = PRODUCTS[productId];
    const unit = unitPrice(product, qtyByProduct(items)[productId] || qty);
    trackMeta('AddToCart', {
      value: unit * qty,
      content_name: product.name,
      content_type: 'product',
      content_ids: [productId],
      contents: [{ id: productId, quantity: qty, item_price: unit }]
    });
  };

  // Tarjeta para reseñas de Google: paquetes de 1, 2, 5 o 10 tarjetas.
  const addPackToCart = (productId, pack, qty, reviewLinks = [], reviewNote = '') => {
    const items = readCart();
    const key = `${reviewLinks.join(',')}|${reviewNote}`;
    const existing = items.find((item) => (
      item.product === productId && item.pack === pack && `${(item.reviewLinks || []).join(',')}|${item.reviewNote || ''}` === key
    ));
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, MAX_PACKS);
    } else {
      items.push({ id: newId(), product: productId, pack, qty, reviewLinks, reviewNote });
    }
    writeCart(items);
    bumpCartBadge();
    const product = PRODUCTS[productId];
    const price = product.packs[pack].price;
    trackMeta('AddToCart', {
      value: price * qty,
      content_name: `${product.name} (paquete de ${pack})`,
      content_type: 'product',
      content_ids: [`${productId}-${pack}`],
      contents: [{ id: `${productId}-${pack}`, quantity: qty, item_price: price }]
    });
  };

  const updateQty = (id, delta) => {
    const items = readCart();
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    item.qty = Math.min(Math.max(1, item.qty + delta), isPack(PRODUCTS[item.product]) ? MAX_PACKS : 99);
    writeCart(items);
  };

  const removeItem = (id) => {
    deleteFile(id);
    writeCart(readCart().filter((item) => item.id !== id));
  };

  /* ---------- Barra de anuncios y navbar ---------- */

  const header = document.querySelector('.site-header');

  const buildAnnouncementBar = () => {
    if (!header || header.querySelector('.announce-bar')) return;
    const items = ANNOUNCEMENTS.map(([icon, text]) => (
      `<span class="announce-bar__item"><i aria-hidden="true" class="fa-solid ${icon}"></i>${text}</span>`
    )).join('');
    const bar = document.createElement('div');
    bar.className = 'announce-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Beneficios de comprar en TapLoop');
    bar.innerHTML = `
      <div class="announce-bar__track">
        <div class="announce-bar__group">${items}</div>
        <div class="announce-bar__group" aria-hidden="true">${items}</div>
      </div>`;
    header.append(bar);
    header.classList.add('site-header--with-marquee');
  };

  const buildNavCart = () => {
    const navWrap = header?.querySelector('.nav-wrap');
    if (!navWrap || navWrap.querySelector('.nav-cart')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-cart';
    button.setAttribute('data-cart-open', '');
    button.setAttribute('aria-label', 'Abrir carrito');
    button.innerHTML = '<i aria-hidden="true" class="fa-solid fa-cart-shopping"></i><span class="nav-cart__count" data-cart-count hidden>0</span>';
    navWrap.append(button);

    const nav = navWrap.querySelector('.main-nav');
    if (nav && !nav.querySelector('.main-nav__buy')) {
      const buy = document.createElement('a');
      buy.className = 'main-nav__buy';
      buy.href = 'tarjetas-nfc.html';
      buy.innerHTML = 'Comprar ahora <i aria-hidden="true" class="fa-solid fa-bag-shopping"></i>';
      nav.append(buy);
    }
  };

  const watchHeaderScroll = () => {
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
  };

  /* ---------- Capas (catálogo, carrito, lightbox) ---------- */

  let lastFocus = null;

  const openLayer = (layer) => {
    lastFocus = document.activeElement;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add('is-open'));
    document.body.classList.add('store-layer-open');
    window.setTimeout(() => layer.querySelector('[data-layer-focus]')?.focus({ preventScroll: true }), 60);
  };

  const closeLayer = (layer) => {
    if (!layer || layer.hidden) return;
    layer.classList.remove('is-open');
    window.setTimeout(() => {
      layer.hidden = true;
      if (!document.querySelector('.store-layer.is-open')) document.body.classList.remove('store-layer-open');
    }, 320);
    layer.querySelectorAll('video').forEach((video) => video.pause());
    lastFocus?.focus?.({ preventScroll: true });
  };

  const createLayer = (className, html) => {
    const layer = document.createElement('div');
    layer.className = `store-layer ${className}`;
    layer.hidden = true;
    layer.innerHTML = html;
    document.body.append(layer);
    return layer;
  };

  /* ---------- Catálogo ---------- */

  let catalog = null;

  const catalogCard = (product) => `
    <article class="catalog-card">
      <a class="catalog-card__media" href="${product.url}">
        <img src="${product.image}" alt="${product.name} TapLoop" loading="lazy" decoding="async">
        <img class="catalog-card__media-hover" src="${product.hoverImage}" alt="" loading="lazy" decoding="async">
        <span class="catalog-card__badge"><i aria-hidden="true" class="fa-solid fa-truck-fast"></i> Envío gratis</span>
      </a>
      <div class="catalog-card__body">
        <h3>${product.name}</h3>
        <p class="catalog-card__rating"><span aria-hidden="true">★★★★★</span> 5.0 · ${product.reviews}</p>
        <p class="catalog-card__tagline">${product.tagline}</p>
        <p class="catalog-card__price"><strong>${money(product.single)}</strong><s>${money(product.compare)}</s></p>
        <div class="catalog-card__actions">
          <button class="btn btn-primary" type="button" data-quick-add="${product.id}">Agregar al carrito <i aria-hidden="true" class="fa-solid fa-cart-plus"></i></button>
          <a class="btn btn-product-view" href="${product.url}">Ver detalles <i aria-hidden="true" class="fa-solid fa-arrow-right"></i></a>
        </div>
      </div>
    </article>`;

  const openCatalog = () => {
    if (!catalog) {
      catalog = createLayer('catalog-modal', `
        <div class="store-layer__backdrop" data-layer-close></div>
        <div class="catalog-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
          <button class="store-layer__close" type="button" data-layer-close aria-label="Cerrar catálogo" data-layer-focus><i aria-hidden="true" class="fa-solid fa-xmark"></i></button>
          <div class="catalog-modal__head">
            <p class="eyebrow">Tienda TapLoop</p>
            <h2 id="catalog-title">Elige tu tarjeta NFC</h2>
            <p>Pago único · Perfil digital incluido · Uso de la plataforma gratis</p>
          </div>
          <div class="catalog-modal__grid">${CARD_PRODUCTS.map(catalogCard).join('')}</div>
          <a class="catalog-extra" href="${PRODUCTS.google.url}">
            <img src="${PRODUCTS.google.image}" alt="" loading="lazy" decoding="async">
            <span><small>También para tu negocio</small><strong>${PRODUCTS.google.name}</strong><em>${PRODUCTS.google.tagline}</em></span>
            <span class="catalog-extra__price">${money(PRODUCTS.google.packs[1].price)} <s>${money(PRODUCTS.google.packs[1].compare)}</s> <i aria-hidden="true" class="fa-solid fa-arrow-right"></i></span>
          </a>
          <p class="catalog-modal__team"><i aria-hidden="true" class="fa-solid fa-users"></i> ¿Equipo de ${TEAM_MIN} o más colaboradores? <button type="button" data-team-quote>Solicita cotización personalizada</button></p>
        </div>`);
    }
    closeLayer(cartDrawer);
    openLayer(catalog);
  };

  /* ---------- Carrito lateral ---------- */

  let cartDrawer = null;

  const buildCartDrawer = () => {
    if (cartDrawer) return;
    cartDrawer = createLayer('cart-panel', `
      <div class="store-layer__backdrop" data-layer-close></div>
      <aside class="cart-panel__dialog" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header class="cart-panel__head">
          <h2 id="cart-title">Tu carrito <span data-cart-head-count></span></h2>
          <button class="store-layer__close" type="button" data-layer-close aria-label="Cerrar carrito" data-layer-focus><i aria-hidden="true" class="fa-solid fa-xmark"></i></button>
        </header>
        <p class="cart-panel__shipping"><i aria-hidden="true" class="fa-solid fa-truck-fast"></i> Tu envío es <strong>gratis</strong> a cualquier parte de México</p>
        <div class="cart-panel__body" data-cart-lines></div>
        <footer class="cart-panel__foot" data-cart-foot>
          <div class="cart-panel__row"><span>Subtotal</span><strong data-cart-subtotal></strong></div>
          <div class="cart-panel__row"><span>Envío</span><strong class="cart-panel__free">Gratis</strong></div>
          <div class="cart-panel__row cart-panel__row--total"><span>Total</span><strong data-cart-total></strong></div>
          <p class="cart-panel__note">Pago único. Sin costos adicionales: el uso de la plataforma TapLoop es gratuito.</p>
          <button class="btn btn-primary cart-panel__checkout" type="button" data-checkout><i aria-hidden="true" class="fa-solid fa-lock"></i> Finalizar compra</button>
          <p class="cart-panel__secure"><i aria-hidden="true" class="fa-solid fa-shield-halved"></i> Pago seguro con Stripe. Capturas tu dirección de envío en el siguiente paso.</p>
          <div class="cart-panel__notice" data-checkout-notice hidden role="alert">
            <p data-checkout-message></p>
            <a class="btn cart-panel__whatsapp" data-checkout-whatsapp target="_blank" rel="noopener"><i aria-hidden="true" class="fa-brands fa-whatsapp"></i> Enviar pedido por WhatsApp</a>
          </div>
          <button class="cart-panel__continue" type="button" data-layer-close>Seguir comprando</button>
        </footer>
      </aside>`);
    renderCart();
  };

  const lineMarkup = (line, summary) => {
    const product = line.productData;
    if (isPack(product)) return packLineMarkup(line);
    const logo = line.logo;
    const designLabel = line.design === 'taploop'
      ? '<span class="cart-line__design">Diseño TapLoop</span>'
      : '<span class="cart-line__design">Diseño personalizado</span>';
    const logoLabel = line.design === 'taploop'
      ? ''
      : logo?.name
        ? `<span class="cart-line__logo">${logo.dataUrl ? `<img src="${logo.dataUrl}" alt="">` : '<i aria-hidden="true" class="fa-solid fa-image"></i>'}${escapeHtml(logo.name)}</span>`
        : '<span class="cart-line__logo cart-line__logo--pending"><i aria-hidden="true" class="fa-regular fa-clock"></i> Logo: lo envías después</span>';
    const tierNote = summary.totals[line.product] >= 2 ? `${money(line.unit)} c/u · precio por volumen` : `${money(line.unit)} c/u`;
    return `
      <article class="cart-line">
        <a class="cart-line__media" href="${product.url}"><img src="${product.image}" alt="${product.name}"></a>
        <div class="cart-line__info">
          <h3>${product.name}</h3>
          ${designLabel}
          ${logoLabel}
          <span class="cart-line__unit">${tierNote}</span>
          <div class="cart-line__controls">
            <div class="qty-stepper qty-stepper--small">
              <button type="button" data-line-minus="${line.id}" aria-label="Quitar una">−</button>
              <span>${line.qty}</span>
              <button type="button" data-line-plus="${line.id}" aria-label="Agregar una">+</button>
            </div>
            <button class="cart-line__remove" type="button" data-line-remove="${line.id}">Quitar</button>
          </div>
        </div>
        <strong class="cart-line__total">${money(line.lineTotal)}</strong>
      </article>`;
  };

  const packLineMarkup = (line) => {
    const product = line.productData;
    const pack = Number(line.pack);
    let links = (line.reviewLinks || []).map((url) => `<span class="cart-line__link" title="${escapeHtml(url)}"><i aria-hidden="true" class="fa-brands fa-google"></i>${escapeHtml(url.replace(/^https?:\/\//, ''))}</span>`).join('');
    if (line.reviewNote) links += `<span class="cart-line__link"><i aria-hidden="true" class="fa-solid fa-store"></i>${escapeHtml(line.reviewNote)}</span>`;
    if (!links) links = '<span class="cart-line__logo cart-line__logo--pending"><i aria-hidden="true" class="fa-regular fa-clock"></i> Enlace: lo envías después</span>';
    return `
      <article class="cart-line">
        <a class="cart-line__media" href="${product.url}"><img src="${product.image}" alt="${product.name}"></a>
        <div class="cart-line__info">
          <h3>${product.name}</h3>
          <span class="cart-line__design">Paquete de ${pack} ${pack === 1 ? 'tarjeta' : 'tarjetas'}</span>
          ${links}
          <span class="cart-line__unit">${money(line.unit)} por paquete</span>
          <div class="cart-line__controls">
            <div class="qty-stepper qty-stepper--small">
              <button type="button" data-line-minus="${line.id}" aria-label="Quitar un paquete">−</button>
              <span>${line.qty}</span>
              <button type="button" data-line-plus="${line.id}" aria-label="Agregar un paquete">+</button>
            </div>
            <button class="cart-line__remove" type="button" data-line-remove="${line.id}">Quitar</button>
          </div>
        </div>
        <strong class="cart-line__total">${money(line.lineTotal)}</strong>
      </article>`;
  };

  const upsellMarkup = (summary) => CARD_PRODUCTS
    .filter((product) => summary.totals[product.id] && summary.totals[product.id] < BULK_MIN)
    .map((product) => {
      const qty = summary.totals[product.id];
      const name = product.name.replace('Tarjeta ', 'tarjeta ');
      const message = qty === 1
        ? `Agrega otra ${name} y cada una queda en <strong>${money(product.multi)}</strong>.`
        : `Agrega ${BULK_MIN - qty} más y cada ${name} queda en <strong>${money(product.bulk)}</strong>.`;
      return `<p class="cart-panel__upsell"><i aria-hidden="true" class="fa-solid fa-tags"></i> ${message}</p>`;
    }).join('');

  const teamMarkup = (summary) => (Object.values(summary.totals).some((qty) => qty >= TEAM_MIN)
    ? `<p class="cart-panel__team"><i aria-hidden="true" class="fa-solid fa-users"></i> Para ${TEAM_MIN} o más tarjetas tenemos precio de equipo. <button type="button" data-team-quote>Solicita cotización personalizada</button></p>`
    : '');

  const renderCart = () => {
    const summary = cartSummary();
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.textContent = summary.count;
      badge.hidden = summary.count === 0;
    });
    if (!cartDrawer) return;
    const linesRoot = cartDrawer.querySelector('[data-cart-lines]');
    const foot = cartDrawer.querySelector('[data-cart-foot]');
    cartDrawer.querySelector('[data-cart-head-count]').textContent = summary.count ? `(${summary.count})` : '';
    if (!summary.lines.length) {
      linesRoot.innerHTML = `
        <div class="cart-panel__empty">
          <i aria-hidden="true" class="fa-solid fa-cart-shopping"></i>
          <p>Tu carrito está vacío.</p>
          <button class="btn btn-primary" type="button" data-catalog-open>Ver tarjetas NFC</button>
        </div>`;
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    linesRoot.innerHTML = summary.lines.map((line) => lineMarkup(line, summary)).join('') + upsellMarkup(summary) + teamMarkup(summary);
    cartDrawer.querySelector('[data-cart-subtotal]').textContent = money(summary.total);
    cartDrawer.querySelector('[data-cart-total]').textContent = money(summary.total);
    cartDrawer.querySelector('[data-checkout-notice]').hidden = true;
  };

  const openCart = () => {
    buildCartDrawer();
    closeLayer(catalog);
    renderCart();
    openLayer(cartDrawer);
  };

  const bumpCartBadge = () => {
    document.querySelectorAll('.nav-cart').forEach((button) => {
      button.classList.remove('is-bumped');
      void button.offsetWidth;
      button.classList.add('is-bumped');
    });
  };

  const whatsappOrderUrl = () => {
    const summary = cartSummary();
    const lines = summary.lines.map((line) => (isPack(line.productData)
      ? `• ${line.qty} × ${line.productData.name}, paquete de ${line.pack} (${money(line.unit)}) — enlace: ${[...(line.reviewLinks || []), line.reviewNote].filter(Boolean).join(', ') || 'lo envío después'}`
      : `• ${line.qty} × ${line.productData.name} (${money(line.unit)} c/u) — ${line.design === 'taploop' ? 'diseño TapLoop' : `diseño personalizado, logo: ${line.logo?.name || 'lo envío después'}`}`
    ));
    const text = ['Hola, quiero hacer este pedido en TapLoop:', ...lines, `Total: ${money(summary.total)} · Envío gratis`].join('\n');
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  };

  const showCheckoutNotice = (message) => {
    const notice = cartDrawer.querySelector('[data-checkout-notice]');
    cartDrawer.querySelector('[data-checkout-message]').innerHTML = message;
    cartDrawer.querySelector('[data-checkout-whatsapp]').href = whatsappOrderUrl();
    notice.hidden = false;
    notice.classList.remove('is-shown');
    void notice.offsetWidth;
    notice.classList.add('is-shown');
  };

  const utmParams = () => {
    const params = new URLSearchParams(window.location.search);
    const utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((key) => {
      if (params.get(key)) utm[key] = params.get(key);
    });
    return Object.keys(utm).length ? utm : null;
  };

  // Crea el pedido y la sesión de Stripe, sube los archivos y redirige al pago.
  let checkingOut = false;
  const handleCheckout = async () => {
    if (checkingOut) return;
    const summary = cartSummary();
    if (!summary.lines.length) return;
    if (Object.values(summary.totals).some((qty) => qty >= TEAM_MIN)) {
      showCheckoutNotice(`<strong>Para ${TEAM_MIN} o más tarjetas de presentación</strong> tenemos precio de equipo. Ajusta la cantidad a ${MAX_QTY} o menos, o solicita tu cotización personalizada.`);
      return;
    }

    const button = cartDrawer.querySelector('[data-checkout]');
    const buttonHtml = button.innerHTML;
    checkingOut = true;
    button.disabled = true;
    const metaData = metaCartData(summary);
    trackMeta('InitiateCheckout', metaData);
    button.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Preparando pago seguro…';
    cartDrawer.querySelector('[data-checkout-notice]').hidden = true;

    try {
      const items = readCart();
      const files = await Promise.all(items.map((item) => (item.design === 'custom' && item.logo?.name ? loadFile(item.id) : null)));
      const payload = {
        items: items.map((item, index) => (isPack(PRODUCTS[item.product])
          ? { product: item.product, pack: Number(item.pack), qty: item.qty, reviewLinks: item.reviewLinks || [], notes: item.reviewNote || '' }
          : {
            product: item.product,
            qty: item.qty,
            design: item.design || 'custom',
            file: files[index] ? { name: item.logo.name, size: files[index].size, type: files[index].type || 'application/octet-stream' } : null
          })),
        context: { page: window.location.href.split('#')[0], referrer: document.referrer || null, utm: utmParams() }
      };

      const response = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || 'No pudimos preparar el pago.');
      }

      // Subir logos y diseños a sus URLs firmadas (position = índice + 1 en el carrito).
      button.innerHTML = '<i aria-hidden="true" class="fa-solid fa-spinner fa-spin"></i> Subiendo tus archivos…';
      await Promise.all((result.uploads || []).map(async (upload) => {
        const file = files[upload.position - 1];
        if (!file) return;
        const uploadResponse = await fetch(upload.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
          body: file
        });
        if (!uploadResponse.ok) console.warn('No se pudo subir', upload.path);
      }));

      try {
        localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ orderId: result.orderId, orderNumber: result.orderNumber, at: Date.now(), meta: metaData }));
      } catch { /* sin almacenamiento */ }
      button.innerHTML = '<i aria-hidden="true" class="fa-solid fa-lock"></i> Abriendo pago seguro…';
      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error(error);
      checkingOut = false;
      button.disabled = false;
      button.innerHTML = buttonHtml;
      showCheckoutNotice(`<strong>${escapeHtml(error.message || 'No pudimos preparar el pago.')}</strong> Intenta de nuevo o envíanos tu pedido por WhatsApp y te lo confirmamos.`);
    }
  };

  /* ---------- Toast ---------- */

  let toastTimer = null;
  const showToast = (message) => {
    let toast = document.querySelector('.store-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'store-toast';
      toast.setAttribute('role', 'status');
      document.body.append(toast);
    }
    toast.innerHTML = `<i aria-hidden="true" class="fa-solid fa-circle-check"></i> ${message}`;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  /* ---------- Página de producto ---------- */

  const setupBuyBox = (root) => {
    const product = PRODUCTS[root.dataset.pdp];
    if (!product) return;
    const qtyInput = root.querySelector('[data-qty-input]');
    const priceEl = root.querySelector('[data-price]');
    const wasEl = root.querySelector('[data-price-was]');
    const saveEl = root.querySelector('[data-price-save]');
    const addLabel = root.querySelector('[data-add-label]');
    const teamHint = root.querySelector('[data-team-hint]');
    const options = root.querySelectorAll('[data-qty-option]');
    let logo = null;

    const update = () => {
      const qty = clampQty(qtyInput.value);
      qtyInput.value = qty;
      const unit = unitPrice(product, qty);
      priceEl.textContent = qty >= 2 ? `${money(unit)} c/u` : money(unit);
      wasEl.textContent = money(product.compare);
      saveEl.querySelector('span').textContent = `Ahorra ${Math.round((1 - unit / product.compare) * 100)}%`;
      addLabel.textContent = money(unit * qty);
      options.forEach((option) => {
        const selected = Number(option.value) === qty;
        option.checked = selected;
        option.closest('.pdp-option').classList.toggle('is-active', selected);
      });
      [priceEl, saveEl].forEach((element) => {
        element.classList.remove('is-updating');
        void element.offsetWidth;
        element.classList.add('is-updating');
      });
    };

    root.querySelector('[data-qty-minus]').addEventListener('click', () => {
      qtyInput.value = clampQty(qtyInput.value) - 1;
      teamHint.hidden = true;
      update();
    });
    root.querySelector('[data-qty-plus]').addEventListener('click', () => {
      const current = clampQty(qtyInput.value);
      teamHint.hidden = current < MAX_QTY;
      qtyInput.value = current + 1;
      update();
    });
    qtyInput.addEventListener('change', () => {
      teamHint.hidden = (parseInt(qtyInput.value, 10) || 1) < TEAM_MIN;
      update();
    });
    options.forEach((option) => option.addEventListener('change', () => {
      qtyInput.value = option.value;
      teamHint.hidden = true;
      update();
    }));

    // Logo: arrastrar y soltar o seleccionar archivo.
    const dropzone = root.querySelector('[data-dropzone]');
    const fileInput = root.querySelector('[data-logo-input]');
    const preview = root.querySelector('[data-logo-preview]');
    const errorEl = root.querySelector('[data-logo-error]');

    const showLogo = () => {
      dropzone.hidden = Boolean(logo);
      preview.hidden = !logo;
      if (!logo) return;
      preview.querySelector('[data-logo-name]').textContent = logo.name;
      const thumb = preview.querySelector('[data-logo-thumb]');
      thumb.innerHTML = logo.dataUrl ? `<img src="${logo.dataUrl}" alt="Vista previa de tu logo">` : '<i aria-hidden="true" class="fa-solid fa-file-image"></i>';
    };

    const acceptFile = (file) => {
      errorEl.hidden = true;
      if (!file) return;
      if (file.size > MAX_LOGO_BYTES) {
        errorEl.textContent = 'El archivo pesa más de 10 MB. Prueba con una versión más ligera.';
        errorEl.hidden = false;
        return;
      }
      logo = { name: file.name, size: file.size, type: file.type, dataUrl: null, file };
      const isPreviewable = /^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type);
      if (isPreviewable && file.size <= MAX_STORED_LOGO_BYTES) {
        const reader = new FileReader();
        reader.onload = () => {
          logo.dataUrl = String(reader.result);
          showLogo();
        };
        reader.readAsDataURL(file);
      }
      showLogo();
    };

    fileInput.addEventListener('change', () => acceptFile(fileInput.files[0]));
    ['dragenter', 'dragover'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragging');
    }));
    ['dragleave', 'drop'].forEach((type) => dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragging');
    }));
    dropzone.addEventListener('drop', (event) => acceptFile(event.dataTransfer?.files?.[0]));
    // Diseño: TapLoop o personalizado (muestra la carga de logo).
    let design = root.querySelector('[data-design-option]:checked')?.value || 'taploop';
    const logoWrap = root.querySelector('[data-logo-wrap]');
    const taploopNote = root.querySelector('[data-design-note-taploop]');
    const showDesign = () => {
      root.querySelectorAll('[data-design-option]').forEach((option) => {
        option.closest('.pdp-design').classList.toggle('is-active', option.checked);
      });
      logoWrap.hidden = design !== 'custom';
      taploopNote.hidden = design === 'custom';
    };
    root.querySelectorAll('[data-design-option]').forEach((option) => option.addEventListener('change', () => {
      design = option.value;
      showDesign();
    }));
    showDesign();

    root.querySelector('[data-logo-remove]').addEventListener('click', () => {
      logo = null;
      fileInput.value = '';
      showLogo();
    });

    const add = () => {
      const isCustom = design === 'custom';
      const { file, ...logoInfo } = logo || {};
      const added = addToCart(product.id, clampQty(qtyInput.value), isCustom && logo ? logoInfo : null, design, isCustom ? file : null);
      logo = null;
      fileInput.value = '';
      showLogo();
      qtyInput.value = 1;
      update();
      return added;
    };

    root.querySelector('[data-add-to-cart]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      await add();
      button.classList.add('is-added');
      window.setTimeout(() => button.classList.remove('is-added'), 900);
      showToast(`${product.name} agregada al carrito`);
      openCart();
    });
    root.querySelector('[data-buy-now]').addEventListener('click', async () => {
      await add();
      openCart();
      handleCheckout();
    });

    update();
    trackMeta('ViewContent', {
      value: product.single,
      content_name: product.name,
      content_type: 'product',
      content_ids: [product.id]
    });
  };

  /* ---------- Página de la tarjeta para reseñas de Google (paquetes) ---------- */

  const setupPackBox = (root) => {
    const product = PRODUCTS[root.dataset.pdpPack];
    if (!product) return;
    const qtyInput = root.querySelector('[data-qty-input]');
    const priceEl = root.querySelector('[data-price]');
    const wasEl = root.querySelector('[data-price-was]');
    const saveEl = root.querySelector('[data-price-save]');
    const noteEl = root.querySelector('[data-pack-note]');
    const addLabel = root.querySelector('[data-add-label]');
    const options = root.querySelectorAll('[data-pack-option]');
    const linksInput = root.querySelector('[data-review-links]');
    const clampPacks = (value) => Math.min(Math.max(parseInt(value, 10) || 1, 1), MAX_PACKS);
    const selectedPack = () => Number(root.querySelector('[data-pack-option]:checked')?.value || 5);

    const update = () => {
      const pack = selectedPack();
      const { price, compare } = product.packs[pack];
      const qty = clampPacks(qtyInput.value);
      qtyInput.value = qty;
      priceEl.textContent = money(price);
      wasEl.textContent = money(compare);
      saveEl.querySelector('span').textContent = `Ahorra ${Math.round((1 - price / compare) * 100)}%`;
      noteEl.textContent = pack === 1
        ? 'Precio por tarjeta · envío gratis incluido'
        : `${money(Math.round(price / pack))} por tarjeta · envío gratis incluido`;
      addLabel.textContent = money(price * qty);
      options.forEach((option) => option.closest('.pdp-option').classList.toggle('is-active', option.checked));
      [priceEl, saveEl].forEach((element) => {
        element.classList.remove('is-updating');
        void element.offsetWidth;
        element.classList.add('is-updating');
      });
    };

    // Opcional: separa los enlaces (Google Maps, g.page…) del texto libre, que se guarda como nota.
    const readLinks = () => {
      const links = [];
      const notes = [];
      linksInput.value.split(',').map((value) => value.trim()).filter(Boolean).forEach((value) => {
        try {
          if (/\s/.test(value)) throw new Error('texto');
          const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
          if (!url.hostname.includes('.')) throw new Error('texto');
          links.push(url.toString());
        } catch {
          notes.push(value);
        }
      });
      return { links: links.slice(0, 10), note: notes.join(', ').slice(0, 300) };
    };

    options.forEach((option) => option.addEventListener('change', update));
    root.querySelector('[data-qty-minus]').addEventListener('click', () => { qtyInput.value = clampPacks(qtyInput.value) - 1; update(); });
    root.querySelector('[data-qty-plus]').addEventListener('click', () => { qtyInput.value = clampPacks(qtyInput.value) + 1; update(); });
    qtyInput.addEventListener('change', update);
    const add = () => {
      const { links, note } = readLinks();
      addPackToCart(product.id, selectedPack(), clampPacks(qtyInput.value), links, note);
      return true;
    };

    root.querySelector('[data-add-to-cart]').addEventListener('click', () => {
      if (!add()) return;
      showToast('Tarjetas para reseñas agregadas al carrito');
      openCart();
    });
    root.querySelector('[data-buy-now]').addEventListener('click', () => {
      if (!add()) return;
      openCart();
      handleCheckout();
    });

    update();
    trackMeta('ViewContent', {
      value: product.packs[1].price,
      content_name: product.name,
      content_type: 'product',
      content_ids: Object.keys(product.packs).map((pack) => `${product.id}-${pack}`)
    });
  };

  /* ---------- Barra fija "Agregar al carrito" en celular ---------- */

  // Aparece abajo mientras el botón principal no está a la vista y usa las opciones ya elegidas.
  const setupStickyBuy = (root) => {
    const actions = root.querySelector('.pdp-actions');
    const addButton = root.querySelector('[data-add-to-cart]');
    const priceEl = root.querySelector('[data-price]');
    const wasEl = root.querySelector('[data-price-was]');
    if (!actions || !addButton || !priceEl || document.querySelector('.pdp-sticky')) return;

    const bar = document.createElement('div');
    bar.className = 'pdp-sticky';
    bar.innerHTML = `
      <div class="pdp-sticky__price">
        <strong data-sticky-price></strong>
        <span><s data-sticky-was></s> · Envío gratis</span>
      </div>
      <button class="btn btn-primary pdp-sticky__add" type="button"><i aria-hidden="true" class="fa-solid fa-cart-shopping"></i> Agregar al carrito</button>`;
    document.body.append(bar);

    const sync = () => {
      bar.querySelector('[data-sticky-price]').textContent = priceEl.textContent;
      bar.querySelector('[data-sticky-was]').textContent = wasEl?.textContent || '';
    };
    sync();
    new MutationObserver(sync).observe(priceEl, { childList: true, characterData: true, subtree: true });
    bar.querySelector('.pdp-sticky__add').addEventListener('click', () => addButton.click());

    const setVisible = (visible) => {
      bar.classList.toggle('is-visible', visible);
      document.body.classList.toggle('has-sticky-buy', visible);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 }).observe(actions);
    } else {
      setVisible(true);
    }
  };

  /* ---------- Galería del producto ---------- */

  let lightbox = null;

  const openLightbox = (media) => {
    if (!lightbox) {
      lightbox = createLayer('media-lightbox', `
        <div class="store-layer__backdrop" data-layer-close></div>
        <div class="media-lightbox__stage" role="dialog" aria-modal="true" aria-label="Vista ampliada">
          <button class="store-layer__close" type="button" data-layer-close aria-label="Cerrar vista ampliada" data-layer-focus><i aria-hidden="true" class="fa-solid fa-xmark"></i></button>
          <div class="media-lightbox__content" data-lightbox-content></div>
        </div>`);
    }
    const content = lightbox.querySelector('[data-lightbox-content]');
    content.replaceChildren();
    const source = media.querySelector('img, video');
    if (!source) return;
    if (source.tagName === 'VIDEO') {
      const video = document.createElement('video');
      video.src = source.currentSrc || source.src;
      if (source.poster) video.poster = source.poster;
      video.currentTime = source.currentTime || 0;
      video.controls = true;
      video.playsInline = true;
      video.autoplay = true;
      content.append(video);
      source.pause();
    } else {
      const image = document.createElement('img');
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      content.append(image);
    }
    openLayer(lightbox);
  };

  const setupGallery = (gallery) => {
    const mainMedia = gallery.querySelector('[data-product-main-media]');
    const thumbs = Array.from(gallery.querySelectorAll('[data-product-media]'));
    if (!mainMedia || gallery.querySelector('.pdp-stage')) return;
    if (thumbs.length < 2) {
      const single = document.createElement('div');
      single.className = 'pdp-stage pdp-stage--single';
      mainMedia.before(single);
      single.append(mainMedia);
      single.insertAdjacentHTML('beforeend', '<button class="pdp-stage__expand" type="button" aria-label="Ver en grande"><i aria-hidden="true" class="fa-solid fa-up-right-and-down-left-from-center"></i></button>');
      single.querySelector('.pdp-stage__expand').addEventListener('click', () => openLightbox(mainMedia));
      return;
    }

    const stage = document.createElement('div');
    stage.className = 'pdp-stage';
    mainMedia.before(stage);
    stage.append(mainMedia);
    stage.insertAdjacentHTML('beforeend', `
      <button class="pdp-stage__arrow pdp-stage__arrow--prev" type="button" aria-label="Contenido anterior"><i aria-hidden="true" class="fa-solid fa-arrow-left"></i></button>
      <button class="pdp-stage__arrow pdp-stage__arrow--next" type="button" aria-label="Contenido siguiente"><i aria-hidden="true" class="fa-solid fa-arrow-right"></i></button>
      <button class="pdp-stage__expand" type="button" aria-label="Ver en grande"><i aria-hidden="true" class="fa-solid fa-up-right-and-down-left-from-center"></i></button>`);

    const activeIndex = () => Math.max(0, thumbs.findIndex((thumb) => thumb.classList.contains('is-active')));
    const go = (step) => {
      const next = thumbs[(activeIndex() + step + thumbs.length) % thumbs.length];
      next.click();
      next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    stage.querySelector('.pdp-stage__arrow--prev').addEventListener('click', () => go(-1));
    stage.querySelector('.pdp-stage__arrow--next').addEventListener('click', () => go(1));
    stage.querySelector('.pdp-stage__expand').addEventListener('click', () => openLightbox(mainMedia));
    mainMedia.addEventListener('dblclick', () => openLightbox(mainMedia));

    let touchX = null;
    stage.addEventListener('touchstart', (event) => { touchX = event.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', (event) => {
      if (touchX === null) return;
      const delta = event.changedTouches[0].clientX - touchX;
      if (Math.abs(delta) > 45) go(delta < 0 ? 1 : -1);
      touchX = null;
    });

    gallery.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    });
  };

  /* ---------- "Comprar ahora" según el producto ---------- */

  const productByUrl = (url = '') => Object.values(PRODUCTS).find((product) => url.endsWith(product.url));

  // Devuelve el id del producto al que pertenece el botón, 'page' si está dentro de una
  // página de producto (fuera del navbar) o null si es un botón genérico (abre el catálogo).
  const productFromContext = (trigger) => {
    if (trigger.dataset.product && PRODUCTS[trigger.dataset.product]) return trigger.dataset.product;
    const card = trigger.closest('[data-card-link]');
    if (card) return productByUrl(card.dataset.cardLink)?.id || null;
    if (!trigger.closest('.site-header') && document.querySelector('[data-pdp] [data-buy-now], [data-pdp-pack] [data-buy-now]')) return 'page';
    return null;
  };

  const quickAddProduct = (productId) => {
    const product = PRODUCTS[productId];
    if (!product) return;
    if (isPack(product)) {
      // Necesita el enlace de reseñas: se configura en su página.
      window.location.href = product.url;
      return;
    }
    closeLayer(catalog);
    addToCart(product.id, 1);
    showToast(`${product.name} agregada al carrito`);
    openCart();
  };

  /* ---------- Menú desplegable "Tarjetas NFC" ---------- */

  const buildNavDropdown = () => {
    const link = header?.querySelector('.main-nav > a[href="tarjetas-nfc.html"]');
    if (!link || link.closest('.nav-dropdown')) return;
    const wrap = document.createElement('div');
    wrap.className = 'nav-dropdown';
    link.before(wrap);
    wrap.append(link);
    const menuItem = (product) => `
      <a class="nav-dropdown__item" href="${product.url}" role="menuitem">
        <span class="nav-dropdown__thumb"><img src="${product.image}" alt="" loading="lazy" decoding="async"></span>
        <span class="nav-dropdown__text">
          <strong>${product.menuTitle}</strong>
          <small>${product.menuText}</small>
          <em>${isPack(product)
            ? `${money(product.packs[1].price)} <s>${money(product.packs[1].compare)}</s>`
            : `${money(product.single)} <s>${money(product.compare)}</s>`}</em>
        </span>
        <i aria-hidden="true" class="fa-solid fa-arrow-right nav-dropdown__arrow"></i>
      </a>`;
    const items = `${CARD_PRODUCTS.map(menuItem).join('')}
          <p class="nav-dropdown__label nav-dropdown__label--sub">Para tu negocio</p>
          ${menuItem(PRODUCTS.google)}`;
    wrap.insertAdjacentHTML('beforeend', `
      <button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-label="Ver tarjetas NFC"><i aria-hidden="true" class="fa-solid fa-chevron-down"></i></button>
      <div class="nav-dropdown__panel" role="menu">
        <div class="nav-dropdown__list">
          <p class="nav-dropdown__label">Elige tu tarjeta</p>
          ${items}
        </div>
        <aside class="nav-dropdown__promo">
          <p class="nav-dropdown__label">Comprar en TapLoop</p>
          <ul>
            <li><i aria-hidden="true" class="fa-solid fa-truck-fast"></i> Envío gratis a todo México</li>
            <li><i aria-hidden="true" class="fa-solid fa-receipt"></i> Pago único, sin mensualidades</li>
            <li><i aria-hidden="true" class="fa-solid fa-gift"></i> Diseño con tu logo sin costo</li>
          </ul>
          <a class="nav-dropdown__cta" href="tarjetas-nfc.html">Ver catálogo <i aria-hidden="true" class="fa-solid fa-arrow-right"></i></a>
        </aside>
      </div>`);
    const toggle = wrap.querySelector('.nav-dropdown__toggle');
    const setOpen = (open) => {
      wrap.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!wrap.classList.contains('is-open'));
    });
    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        link.focus();
      }
    });
  };

  /* ---------- Eventos globales ---------- */

  document.addEventListener('click', (event) => {
    const catalogTrigger = event.target.closest('[data-catalog-open]');
    if (catalogTrigger) {
      event.preventDefault();
      const contextProduct = productFromContext(catalogTrigger);
      if (contextProduct === 'page') {
        document.querySelector('[data-pdp] [data-buy-now], [data-pdp-pack] [data-buy-now]').click();
      } else if (contextProduct) {
        quickAddProduct(contextProduct);
      } else {
        openCatalog();
      }
      return;
    }
    if (event.target.closest('[data-cart-open]')) {
      openCart();
      return;
    }
    const quickAdd = event.target.closest('[data-quick-add]');
    if (quickAdd) {
      quickAddProduct(quickAdd.dataset.quickAdd);
      return;
    }
    const teamQuote = event.target.closest('[data-team-quote]');
    if (teamQuote) {
      event.preventDefault();
      document.querySelectorAll('.store-layer.is-open').forEach(closeLayer);
      if (typeof openProposalModal === 'function') {
        openProposalModal(teamQuote);
      } else {
        window.location.href = 'para-equipos.html';
      }
      return;
    }
    if (event.target.closest('[data-layer-close]')) {
      closeLayer(event.target.closest('.store-layer'));
      return;
    }
    const minus = event.target.closest('[data-line-minus]');
    if (minus) return updateQty(minus.dataset.lineMinus, -1);
    const plus = event.target.closest('[data-line-plus]');
    if (plus) return updateQty(plus.dataset.linePlus, 1);
    const remove = event.target.closest('[data-line-remove]');
    if (remove) return removeItem(remove.dataset.lineRemove);
    if (event.target.closest('[data-checkout]')) handleCheckout();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.store-layer.is-open').forEach(closeLayer);
  });

  window.addEventListener('storage', (event) => {
    if (event.key === CART_KEY) renderCart();
  });

  /* ---------- Imágenes: aparición suave al cargar ---------- */

  const fadeInLazyImages = () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((image) => {
      if (image.complete || image.classList.contains('reveal-on-scroll') || image.closest('.reveal-on-scroll:not(.is-visible)')) return;
      image.classList.add('img-fade');
      const done = () => image.classList.add('is-loaded');
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
    });
  };

  /* ---------- Inicio ---------- */

  buildAnnouncementBar();
  buildNavCart();
  buildNavDropdown();
  watchHeaderScroll();
  document.querySelectorAll('[data-pdp]').forEach(setupBuyBox);
  document.querySelectorAll('[data-pdp-pack]').forEach(setupPackBox);
  document.querySelectorAll('[data-pdp], [data-pdp-pack]').forEach(setupStickyBuy);
  document.querySelectorAll('.product-media').forEach(setupGallery);
  renderCart();
  fadeInLazyImages();

  // Regreso de Stripe con pago completado: vaciar el carrito y mostrar el número de pedido.
  if (document.body.hasAttribute('data-checkout-success')) {
    const orderNumber = new URLSearchParams(window.location.search).get('pedido');
    const numberEl = document.querySelector('[data-order-number]');
    if (orderNumber && /^\d+$/.test(orderNumber) && numberEl) {
      numberEl.querySelector('strong').textContent = `#${orderNumber}`;
      numberEl.hidden = false;
    }
    try {
      const pending = JSON.parse(localStorage.getItem(PENDING_ORDER_KEY) || 'null');
      const trackedKey = `taploopPurchaseTracked:${orderNumber}`;
      if (pending?.meta && String(pending.orderNumber) === orderNumber && !localStorage.getItem(trackedKey)) {
        // eventID permite deduplicar si después se conecta la API de Conversiones de Meta.
        trackMeta('Purchase', pending.meta, { eventID: `pedido-${orderNumber}` });
        localStorage.setItem(trackedKey, '1');
      }
      localStorage.removeItem(PENDING_ORDER_KEY);
    } catch { /* sin almacenamiento */ }
    clearFiles();
    writeCart([]);
  }

  if (new URLSearchParams(window.location.search).get('pago') === 'cancelado' && readCart().length) {
    showToast('Pago cancelado. Tu carrito sigue guardado.');
    openCart();
  }
})();
