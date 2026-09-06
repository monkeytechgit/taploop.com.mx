(() => {
  const pathname = window.location.pathname.toLowerCase();
  const market = document.documentElement.dataset.market || window.TaploeEcommerce?.market || (pathname.startsWith('/us/') ? 'us' : 'mx');
  const locale = document.documentElement.dataset.locale || window.TaploeEcommerce?.locale || (market === 'us' ? 'en-US' : 'es-MX');
  const labels = market === 'us'
    ? { viewCart: 'Open cart' }
    : { viewCart: 'Abrir carrito' };
  const cartKey = window.TaploeEcommerce?.cartStorageKey || `taploeCart:${market}`;
  const appLoginUrl = window.TaploeEcommerce?.appLoginUrl || `https://app.taploe.com/login?locale=${locale}`;

  document.querySelectorAll('a[href="iniciar-sesion.html"], a[href="login.html"]').forEach((link) => {
    link.href = appLoginUrl;
  });

  const readCartCount = () => {
    try {
      return JSON.parse(localStorage.getItem(cartKey) || '[]').reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    } catch {
      return 0;
    }
  };
  const updateCartBadges = () => {
    const count = readCartCount();
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  };
  const cartButton = () => {
    const button = document.createElement('button');
    button.className = 'cart-nav-button';
    button.type = 'button';
    button.setAttribute('aria-label', labels.viewCart);
    button.setAttribute('data-cart-open', '');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.2 6h15l-1.9 8.2a2 2 0 0 1-2 1.6H8.1a2 2 0 0 1-2-1.7L4.7 3.8H2.8"/>
        <path d="M9.2 20.2h.1M17.4 20.2h.1"/>
      </svg>
      <span class="sr-only">${labels.viewCart}</span>
      <b data-cart-count hidden>0</b>
    `;
    return button;
  };
  const headerActions = document.querySelector('.header-actions');
  if (headerActions && !headerActions.querySelector('.cart-nav-button')) {
    const menuButton = headerActions.querySelector('.menu-toggle');
    headerActions.insertBefore(cartButton(), menuButton || null);
  }
  const mobileNavInner = document.querySelector('.mobile-nav__inner');
  if (mobileNavInner && !mobileNavInner.querySelector('.cart-nav-button--mobile')) {
    const link = cartButton();
    link.classList.add('cart-nav-button--mobile');
    const loginLink = mobileNavInner.querySelector(`a[href="${appLoginUrl}"], a[href="iniciar-sesion.html"], a[href="login.html"]`);
    mobileNavInner.insertBefore(link, loginLink || null);
  }
  updateCartBadges();
  window.addEventListener('storage', updateCartBadges);
  window.addEventListener('taploe:cart-updated', updateCartBadges);

  document.querySelectorAll('[data-autoplay-video]').forEach((video) => {
    video.volume = Number(video.dataset.volume || 0.85);
    const playAttempt = video.play();
    if (playAttempt) {
      playAttempt.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  });

  const menuButton = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector("#mobile-navigation, .mobile-nav");

  if (!menuButton || !mobileNav) return;

  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    mobileNav.classList.remove("is-open");
    document.body.classList.remove("menu-is-open");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    mobileNav.classList.toggle("is-open", !isOpen);
    document.body.classList.toggle("menu-is-open", !isOpen);
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
})();
