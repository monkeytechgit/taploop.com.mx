/* TapLoop: barra de anuncios, menú de productos, galería y botones de cotización.
   Ya no hay carrito ni pagos en línea: todos los productos se venden por cotización.
   Los botones con [data-quote] abren el formulario de cotización (script.js). */
(() => {
  const PRODUCTS = {
    pvc: {
      id: 'pvc',
      quote: 'pvc',
      name: 'Tarjeta NFC de PVC',
      url: 'tarjeta-digital-nfc-taploop.html',
      image: 'assets/image/productos/producto1pvc.webp',
      menuTitle: 'Tarjeta NFC',
      menuText: 'A todo color, con tu marca y perfil digital.'
    },
    metal: {
      id: 'metal',
      quote: 'metalica',
      name: 'Tarjeta NFC metálica',
      url: 'tarjeta-digital-nfc-metalica-taploop.html',
      image: 'assets/image/productos/producto1metal.webp',
      menuTitle: 'Tarjeta NFC metálica',
      menuText: 'Negro mate con grabado, acabado premium.'
    },
    google: {
      id: 'google',
      quote: 'google',
      name: 'Tarjeta NFC para reseñas de Google',
      url: 'tarjeta-nfc-resenas-google.html',
      image: 'assets/image/productos/google-nfc.webp',
      menuTitle: 'Tarjeta para reseñas de Google',
      menuText: 'Tus clientes te califican con un toque.'
    }
  };

  const ANNOUNCEMENTS = [
    ['fa-truck-fast', 'Envío gratis a todo México'],
    ['fa-receipt', 'Sin mensualidades'],
    ['fa-gift', 'Diseño con tu logo sin costo'],
    ['fa-mobile-screen-button', 'Compatible con iPhone y Android'],
    ['fa-id-card', 'Uso de la plataforma gratis'],
    ['fa-file-invoice', 'Cotización sin compromiso'],
    ['fa-users', 'Precios especiales para equipos']
  ];

  const QUOTE_ICON = '<i aria-hidden="true" class="fa-solid fa-file-invoice"></i>';

  const trackMeta = (event, params = {}) => {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', event, params);
    } catch { /* el píxel nunca debe romper la página */ }
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
    bar.setAttribute('aria-label', 'Beneficios de TapLoop');
    bar.innerHTML = `
      <div class="announce-bar__track">
        <div class="announce-bar__group">${items}</div>
        <div class="announce-bar__group" aria-hidden="true">${items}</div>
      </div>`;
    header.append(bar);
    header.classList.add('site-header--with-marquee');
  };

  // Botón "Solicitar cotización" dentro del menú móvil.
  const buildNavQuote = () => {
    const nav = header?.querySelector('.main-nav');
    if (!nav || nav.querySelector('.main-nav__buy')) return;
    const quote = document.createElement('a');
    quote.className = 'main-nav__buy';
    quote.href = 'contacto-redes.html';
    quote.setAttribute('data-quote', '');
    quote.innerHTML = `Solicitar cotización ${QUOTE_ICON}`;
    nav.append(quote);
  };

  const watchHeaderScroll = () => {
    if (!header) return;
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
  };

  /* ---------- Capas (lightbox) ---------- */

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

  /* ---------- Barra fija "Solicitar cotización" en celular ---------- */

  // Aparece abajo mientras el botón principal de cotización no está a la vista.
  const setupStickyQuote = (root) => {
    const block = root.querySelector('.pdp-quote');
    const button = block?.querySelector('[data-quote]');
    if (!button || document.querySelector('.pdp-sticky')) return;

    const bar = document.createElement('div');
    bar.className = 'pdp-sticky';
    bar.innerHTML = `
      <div class="pdp-sticky__price">
        <strong>Cotización sin compromiso</strong>
        <span>Envío gratis a todo México</span>
      </div>
      <button class="btn btn-primary pdp-sticky__add" type="button">${QUOTE_ICON} Solicitar cotización</button>`;
    document.body.append(bar);
    bar.querySelector('.pdp-sticky__add').addEventListener('click', () => button.click());

    const setVisible = (visible) => {
      bar.classList.toggle('is-visible', visible);
      document.body.classList.toggle('has-sticky-buy', visible);
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { threshold: 0 }).observe(block);
    } else {
      setVisible(true);
    }

    const product = Object.values(PRODUCTS).find((item) => item.quote === button.dataset.quoteProduct);
    if (product) {
      trackMeta('ViewContent', { content_name: product.name, content_type: 'product', content_ids: [product.id] });
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
        </span>
        <i aria-hidden="true" class="fa-solid fa-arrow-right nav-dropdown__arrow"></i>
      </a>`;
    wrap.insertAdjacentHTML('beforeend', `
      <button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-label="Ver tarjetas NFC"><i aria-hidden="true" class="fa-solid fa-chevron-down"></i></button>
      <div class="nav-dropdown__panel" role="menu">
        <div class="nav-dropdown__list">
          <p class="nav-dropdown__label">Elige tu tarjeta</p>
          ${menuItem(PRODUCTS.pvc)}
          ${menuItem(PRODUCTS.metal)}
          <p class="nav-dropdown__label nav-dropdown__label--sub">Para tu negocio</p>
          ${menuItem(PRODUCTS.google)}
        </div>
        <aside class="nav-dropdown__promo">
          <p class="nav-dropdown__label">¿Por qué TapLoop?</p>
          <ul>
            <li><i aria-hidden="true" class="fa-solid fa-truck-fast"></i> Envío gratis a todo México</li>
            <li><i aria-hidden="true" class="fa-solid fa-receipt"></i> Sin mensualidades</li>
            <li><i aria-hidden="true" class="fa-solid fa-gift"></i> Diseño con tu logo sin costo</li>
          </ul>
          <a class="nav-dropdown__cta" href="contacto-redes.html" data-quote>Solicitar cotización ${QUOTE_ICON}</a>
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
    if (event.target.closest('[data-layer-close]')) closeLayer(event.target.closest('.store-layer'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.store-layer.is-open').forEach(closeLayer);
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

  // Limpia datos del carrito anterior que pudieran quedar en el navegador.
  try {
    ['taploopCart:v1', 'taploopPendingOrder', 'taploeCart'].forEach((key) => localStorage.removeItem(key));
    if ('indexedDB' in window) indexedDB.deleteDatabase('taploopCartFiles');
  } catch { /* sin almacenamiento */ }

  buildAnnouncementBar();
  buildNavQuote();
  buildNavDropdown();
  watchHeaderScroll();
  document.querySelectorAll('[data-pdp-quote]').forEach(setupStickyQuote);
  document.querySelectorAll('.product-media').forEach(setupGallery);
  fadeInLazyImages();
})();
