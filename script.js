const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.main-nav');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

const normalizeLabel = (value) => value.replace(/\s+/g, ' ').trim().toLowerCase();

const isQuoteTriggerLabel = (label) => (
  label.includes('solicitar cotización') ||
  label.includes('solicitar cotizacion') ||
  label.includes('cotiza') ||
  label.includes('cotizar') ||
  label.includes('iniciar mi propuesta') ||
  label.includes('iniciar propuesta') ||
  label.includes('recibir una propuesta') ||
  label.includes('solicitar propuesta') ||
  label.includes('solicitar una propuesta')
);

const setupPageMotion = () => {
  if (motionQuery.matches) return;

  const revealSelectors = [
    'main > section',
    'main section .section-heading',
    'main section article',
    'main section .final-cta-card',
    'main section .teams-overview-card',
    'main section .product-media',
    'main section .product-accordions details',
    'main section .faq-list details',
    'main section .brand-mockup-card',
    'main section .platform-suite-grid article',
    'main section img',
  ];

  const revealItems = Array.from(document.querySelectorAll(revealSelectors.join(',')))
    .filter((element, index, list) => list.indexOf(element) === index)
    .filter((element) => !element.closest('.site-header, .proposal-modal, .whatsapp-float'));

  revealItems.forEach((element, index) => {
    element.classList.add('reveal-on-scroll');
    element.style.setProperty('--reveal-delay', `${Math.min(index % 6, 5) * 45}ms`);
  });

  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.12,
  });

  revealItems.forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      element.classList.add('is-visible');
      return;
    }

    observer.observe(element);
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    const label = normalizeLabel(link.textContent || '');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;
    if (isQuoteTriggerLabel(label)) return;

    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname && url.hash) return;

    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.body.classList.add('is-page-leaving');
      window.setTimeout(() => {
        window.location.href = url.href;
      }, 150);
    });
  });
};

const resetPageTransitionState = () => {
  document.body.classList.remove('is-page-leaving');
};

window.addEventListener('pageshow', resetPageTransitionState);
window.addEventListener('load', resetPageTransitionState);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) resetPageTransitionState();
});

setupPageMotion();

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

document.querySelectorAll('details').forEach((item) => {
  item.addEventListener('toggle', () => {
    const symbol = item.querySelector('summary b');
    if (symbol) symbol.textContent = item.open ? '−' : '+';
  });
});

document.querySelectorAll('[data-card-link]').forEach((card) => {
  const target = card.dataset.cardLink;
  if (!target) return;

  const openTarget = () => {
    window.location.href = target;
  };

  card.addEventListener('click', (event) => {
    if (event.target.closest('a, button')) return;
    openTarget();
  });

  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (event.target.closest('a, button')) return;
    event.preventDefault();
    openTarget();
  });
});

document.querySelectorAll('.product-media').forEach((gallery) => {
  const mainMedia = gallery.querySelector('[data-product-main-media]');
  const buttons = Array.from(gallery.querySelectorAll('[data-product-media]'));

  if (!mainMedia || !buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.productMedia;
      const src = button.dataset.src;
      const poster = button.dataset.poster;
      const alt = button.dataset.alt || '';

      if (!src) return;

      mainMedia.replaceChildren();

      if (type === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        video.autoplay = true;
        if (poster) video.poster = poster;
        video.setAttribute('aria-label', alt);
        mainMedia.append(video);
      } else {
        const image = document.createElement('img');
        image.src = src;
        image.alt = alt;
        mainMedia.append(image);
      }

      buttons.forEach((item) => item.classList.toggle('is-active', item === button));
    });
  });
});

const currentPath = window.location.pathname;
let whatsappMessage = 'Me interesan los productos de TapLoop.';

if (currentPath.endsWith('/tarjeta-digital-nfc-taploop.html')) {
  whatsappMessage = 'Me interesa la Tarjeta NFC Digital de TapLoop.';
}

if (currentPath.endsWith('/tarjeta-digital-nfc-metalica-taploop.html')) {
  whatsappMessage = 'Me interesa la Tarjeta NFC Digital Metálica de TapLoop.';
}

const whatsappUrl = `https://wa.me/526643053834?text=${encodeURIComponent(whatsappMessage)}`;
const supabaseRestUrl = 'https://ejhkjyofrazyxtxkohfo.supabase.co/rest/v1/quote_requests';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaGtqeW9mcmF6eXh0eGtvaGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3Mjg1MjMsImV4cCI6MjA4NzMwNDUyM30.MsYH7bPlJdjJelexsJn_4mLvWu3NMUCTt6mcgn08dZ8';
const emailJsApiUrl = 'https://api.emailjs.com/api/v1.0/email/send';
const emailJsServiceId = 'service_gshjpyg';
const emailJsTemplateId = 'template_y4y0gl8';
const emailJsPublicKey = '5vTFdcXJ0G3y7ZaPs';

const proposalOptions = [
  {
    value: 'pvc',
    label: 'Tarjeta NFC Digital PVC',
    icon: 'fa-solid fa-id-card',
  },
  {
    value: 'metalica',
    label: 'Tarjeta NFC Digital Metálica',
    icon: 'fa-regular fa-gem',
  },
  {
    value: 'ambas',
    label: 'Ambas',
    icon: 'fa-solid fa-layer-group',
  },
  {
    value: 'equipo',
    label: 'Tarjetas NFC para mi equipo',
    icon: 'fa-solid fa-users',
  },
  {
    value: 'asesoria',
    label: 'Ayúdame a elegir',
    icon: 'fa-solid fa-comments',
  },
];

const proposalModalState = {
  selectedSolution: 'asesoria',
  selectedQuantity: '1',
};

const getPageSolution = () => {
  const path = currentPath;

  if (path.endsWith('/tarjeta-digital-nfc-taploop.html')) return 'pvc';
  if (path.endsWith('/tarjeta-digital-nfc-metalica-taploop.html')) return 'metalica';
  if (path.endsWith('/para-equipos.html')) return 'ambas';

  return 'asesoria';
};

const getSolutionFromTrigger = (trigger) => {
  const text = `${trigger?.textContent || ''} ${trigger?.getAttribute('aria-label') || ''}`.toLowerCase();
  const card = trigger?.closest('article, .solution-card, .cards-product-card, .cards-catalog-item');
  const cardId = card?.id?.toLowerCase() || '';
  const cardText = card?.textContent?.toLowerCase() || '';

  if (text.includes('metálica') || text.includes('metalica') || text.includes('premium')) return 'metalica';
  if (text.includes('pvc') || text.includes('digital')) return 'pvc';
  if (text.includes('equipo') || text.includes('colaborador') || text.includes('empresa')) return 'ambas';

  if (cardId.includes('metalica') || cardText.includes('metálica') || cardText.includes('metalica') || cardText.includes('premium')) return 'metalica';
  if (cardId.includes('pvc') || cardText.includes('pvc')) return 'pvc';
  if (cardText.includes('equipo') || cardText.includes('colaborador') || cardText.includes('empresa')) return 'ambas';

  return getPageSolution();
};

const getDeviceType = () => {
  if (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
};

const getUtmParams = () => {
  const params = new URLSearchParams(window.location.search);
  const utms = {};

  params.forEach((value, key) => {
    if (key.toLowerCase().startsWith('utm_')) {
      utms[key] = value;
    }
  });

  return utms;
};

const getProposalMetadata = (triggerLabel) => ({
  page: document.title,
  pageUrl: window.location.href,
  sourcePath: window.location.pathname,
  triggerButton: triggerLabel,
  productSelected: proposalOptions.find((option) => option.value === proposalModalState.selectedSolution)?.label || '',
  submittedAt: new Date().toISOString(),
  utm: getUtmParams(),
  referrer: document.referrer || '',
  device: getDeviceType(),
  userAgent: navigator.userAgent,
});

const createProposalModal = () => {
  const modal = document.createElement('div');
  modal.className = 'proposal-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="proposal-modal__overlay" data-proposal-close></div>
    <div class="proposal-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title">
      <button class="proposal-modal__close" type="button" data-proposal-close aria-label="Cerrar propuesta">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>

      <div class="proposal-form__loading" data-proposal-loading hidden aria-live="polite" aria-label="Registrando solicitud">
        <span aria-hidden="true"></span>
        <p>Enviando tu solicitud...</p>
      </div>

      <form class="proposal-form" data-proposal-form>
        <div class="proposal-form__intro">
          <img class="proposal-form__logo" src="assets/images/taploop-logo.webp" alt="TapLoop" loading="lazy" decoding="async">
          <h2 id="proposal-modal-title">Recibe propuesta en minutos</h2>
          <p>Un agente de TapLoop te contactará en segundos.</p>
        </div>

        <div class="proposal-form__grid">
          <label class="proposal-field">
            <span>Tipo de solución <b aria-hidden="true">*</b></span>
            <select name="solution" required>
              <option value="asesoria" selected>Ayúdame a elegir</option>
              <option value="pvc">Tarjeta NFC Digital PVC</option>
              <option value="metalica">Tarjeta NFC Digital Metálica</option>
              <option value="ambas">Ambas</option>
            </select>
          </label>

          <label class="proposal-field">
            <span>Cantidad aproximada <b aria-hidden="true">*</b></span>
            <input type="number" name="quantity" min="1" step="1" inputmode="numeric" required>
          </label>

          <label class="proposal-field">
            <span>Nombre completo <b aria-hidden="true">*</b></span>
            <input type="text" name="fullName" autocomplete="name" required>
          </label>

          <label class="proposal-field">
            <span>Empresa <small>opcional</small></span>
            <input type="text" name="company" autocomplete="organization">
          </label>

          <label class="proposal-field">
            <span>Teléfono <small>opcional</small></span>
            <input type="tel" name="phone" autocomplete="tel" inputmode="tel">
          </label>

          <label class="proposal-field">
            <span>Correo electrónico <b aria-hidden="true">*</b></span>
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label class="proposal-field proposal-field--wide">
            <span>Cuéntanos brevemente qué tienes en mente <small>opcional</small></span>
            <textarea name="comments" rows="4" placeholder="Ejemplo: Necesitamos 15 tarjetas para el equipo comercial, personalizadas con el logo y los datos de cada asesor."></textarea>
          </label>
        </div>

        <input type="hidden" name="metadata" data-proposal-metadata>

        <div class="proposal-form__actions">
          <button class="btn btn-primary" type="submit">
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Recibir mi propuesta
          </button>
        </div>
        <p class="proposal-form__error" data-proposal-error hidden>No pudimos enviar tu solicitud. Intenta nuevamente.</p>
        <p class="proposal-form__note">Te contactaremos para confirmar los detalles y preparar tu cotización. Sin compromiso.</p>
      </form>

    </div>
  `;

  document.body.append(modal);
  return modal;
};

const createProposalConfirmationModal = () => {
  const modal = document.createElement('div');
  modal.className = 'proposal-modal proposal-confirmation-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="proposal-modal__overlay" data-confirmation-close></div>
    <div class="proposal-modal__dialog proposal-modal__dialog--confirmation" role="dialog" aria-modal="true" aria-labelledby="proposal-confirmation-title">
      <button class="proposal-modal__close" type="button" data-confirmation-close aria-label="Cerrar confirmación">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>

      <div class="proposal-confirmation">
        <span class="proposal-confirmation__icon"><i class="fa-solid fa-check" aria-hidden="true"></i></span>
        <h2 id="proposal-confirmation-title">¡Recibimos tu solicitud!</h2>
        <p>Nuestro equipo revisará la información y se pondrá en contacto contigo para preparar una propuesta personalizada.</p>
        <p>Mientras tanto, puedes enviarnos tu logo o referencias por WhatsApp para avanzar más rápido.</p>
        <div class="proposal-confirmation__actions">
          <a class="btn btn-primary" data-proposal-confirm-whatsapp target="_blank" rel="noopener noreferrer" href="${whatsappUrl}">
            <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Continuar por WhatsApp
          </a>
          <button class="btn btn-outline" type="button" data-confirmation-close>Cancelar</button>
        </div>
      </div>
    </div>
  `;

  document.body.append(modal);
  return modal;
};

const proposalModal = createProposalModal();
const proposalConfirmationModal = createProposalConfirmationModal();
const proposalForm = proposalModal.querySelector('[data-proposal-form]');
const proposalSubmitButton = proposalForm.querySelector('button[type="submit"]');
const proposalError = proposalModal.querySelector('[data-proposal-error]');
const proposalLoading = proposalModal.querySelector('[data-proposal-loading]');
const proposalMetadataInput = proposalModal.querySelector('[data-proposal-metadata]');
const proposalWhatsappLinks = proposalConfirmationModal.querySelectorAll('[data-proposal-confirm-whatsapp]');
let lastFocusedElement = null;
let proposalTriggerLabel = '';

const updateProposalSelection = (groupName, value) => {
  const input = proposalModal.querySelector(`[name="${groupName}"]`);
  if (!input) return;

  if (input.tagName === 'SELECT') {
    input.value = value === 'equipo' ? 'ambas' : value;
  } else {
    input.value = value;
  }

  if (groupName === 'solution') proposalModalState.selectedSolution = input.value;
  if (groupName === 'quantity') proposalModalState.selectedQuantity = input.value;
};

const getProposalWhatsappUrl = () => {
  const solution = proposalOptions.find((option) => option.value === proposalModalState.selectedSolution)?.label || 'tarjetas NFC';
  const message = `Hola, quiero recibir una propuesta personalizada de TapLoop. Solución: ${solution}. Cantidad aproximada: ${proposalModalState.selectedQuantity}.`;

  return `https://wa.me/526643053834?text=${encodeURIComponent(message)}`;
};

const refreshProposalMetadata = () => {
  const metadata = getProposalMetadata(proposalTriggerLabel);
  proposalMetadataInput.value = JSON.stringify(metadata);
  proposalWhatsappLinks.forEach((link) => {
    link.href = getProposalWhatsappUrl();
  });
};

const getOptionalValue = (formData, key) => {
  const value = String(formData.get(key) || '').trim();
  return value || null;
};

const createQuoteRequestPayload = (formData) => ({
  solution_type: String(formData.get('solution') || '').trim(),
  approximate_quantity: Number.parseInt(String(formData.get('quantity') || ''), 10),
  full_name: String(formData.get('fullName') || '').trim(),
  company: getOptionalValue(formData, 'company'),
  phone: getOptionalValue(formData, 'phone'),
  email: String(formData.get('email') || '').trim(),
  message: getOptionalValue(formData, 'comments'),
});

const createEmailJsParams = (quoteRequest) => {
  const product = proposalOptions.find((option) => option.value === quoteRequest.solution_type)?.label || quoteRequest.solution_type;
  const description = quoteRequest.message || 'Sin descripcion adicional.';
  const company = quoteRequest.company || 'Sin empresa';
  const phone = quoteRequest.phone || 'Sin telefono';

  return {
    title: 'Nueva solicitud de cotizacion TapLoop',
    name: quoteRequest.full_name,
    nombre: quoteRequest.full_name,
    empresa: company,
    email: quoteRequest.email,
    correo: quoteRequest.email,
    telefono: phone,
    producto: product,
    cantidad: String(quoteRequest.approximate_quantity),
    entrega: 'Por confirmar',
    descripcion: description,
    message: description,
  };
};

const submitQuoteRequest = async (quoteRequest) => {
  const response = await fetch(supabaseRestUrl, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(quoteRequest),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Supabase respondió con estado ${response.status}`);
  }
};

const sendQuoteRequestEmail = async (quoteRequest) => {
  const response = await fetch(emailJsApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: emailJsServiceId,
      template_id: emailJsTemplateId,
      user_id: emailJsPublicKey,
      template_params: createEmailJsParams(quoteRequest),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `EmailJS respondió con estado ${response.status}`);
  }
};

const setProposalLoading = (isLoading) => {
  proposalModal.querySelector('.proposal-modal__dialog')?.classList.toggle('is-loading', isLoading);
  proposalSubmitButton.disabled = isLoading;
  proposalSubmitButton.setAttribute('aria-busy', String(isLoading));
  proposalLoading.hidden = !isLoading;
  proposalSubmitButton.innerHTML = isLoading
    ? '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Enviando...'
    : '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Recibir mi propuesta';
};

const openProposalModal = (trigger) => {
  lastFocusedElement = trigger;
  proposalTriggerLabel = trigger?.textContent?.replace(/\s+/g, ' ').trim() || 'Solicitar cotización';
  proposalForm.reset();
  proposalError.hidden = true;
  setProposalLoading(false);
  updateProposalSelection('solution', getSolutionFromTrigger(trigger));
  updateProposalSelection('quantity', '1');
  refreshProposalMetadata();
  proposalModal.classList.add('is-open');
  proposalModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('proposal-modal-open');
  window.setTimeout(() => proposalModal.querySelector('input[name="fullName"]')?.focus(), 80);
};

const closeProposalModal = () => {
  proposalModal.classList.remove('is-open');
  proposalModal.setAttribute('aria-hidden', 'true');
  if (!proposalConfirmationModal.classList.contains('is-open')) {
    document.body.classList.remove('proposal-modal-open');
  }
  lastFocusedElement?.focus?.();
};

const openProposalConfirmationModal = () => {
  proposalConfirmationModal.classList.add('is-open');
  proposalConfirmationModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('proposal-modal-open');
  proposalConfirmationModal.querySelector('a')?.focus();
};

const closeProposalConfirmationModal = () => {
  proposalConfirmationModal.classList.remove('is-open');
  proposalConfirmationModal.setAttribute('aria-hidden', 'true');
  if (!proposalModal.classList.contains('is-open')) {
    document.body.classList.remove('proposal-modal-open');
  }
  lastFocusedElement?.focus?.();
};

proposalModal.querySelectorAll('[data-proposal-close]').forEach((button) => {
  button.addEventListener('click', closeProposalModal);
});

proposalConfirmationModal.querySelectorAll('[data-confirmation-close]').forEach((button) => {
  button.addEventListener('click', closeProposalConfirmationModal);
});

proposalModal.addEventListener('change', (event) => {
  if (event.target.name === 'solution') updateProposalSelection('solution', event.target.value);
  if (event.target.name === 'quantity') updateProposalSelection('quantity', event.target.value);
  refreshProposalMetadata();
});

proposalModal.addEventListener('input', (event) => {
  if (event.target.name === 'quantity') {
    updateProposalSelection('quantity', event.target.value);
    refreshProposalMetadata();
  }
});

proposalForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!proposalForm.reportValidity()) return;

  const formData = new FormData(proposalForm);
  const quoteRequest = createQuoteRequestPayload(formData);

  proposalError.hidden = true;
  setProposalLoading(true);

  try {
    await Promise.all([
      submitQuoteRequest(quoteRequest),
      sendQuoteRequestEmail(quoteRequest),
    ]);
  } catch (error) {
    console.error('No se pudo completar el envio de la solicitud.', error);
    proposalError.hidden = false;
    setProposalLoading(false);
    return;
  }

  const payload = Object.fromEntries(formData.entries());
  payload.metadata = getProposalMetadata(proposalTriggerLabel);
  payload.productSelected = payload.metadata.productSelected;
  payload.quoteRequest = quoteRequest;

  window.taploopProposalRequests = window.taploopProposalRequests || [];
  window.taploopProposalRequests.push(payload);
  window.dataLayer?.push?.({ event: 'proposal_request_submitted', proposal: payload });

  try {
    const savedRequests = JSON.parse(window.localStorage.getItem('taploopProposalRequests') || '[]');
    savedRequests.push(payload);
    window.localStorage.setItem('taploopProposalRequests', JSON.stringify(savedRequests));
  } catch (error) {
    console.warn('No se pudo guardar la solicitud localmente.', error);
  }

  closeProposalModal();
  openProposalConfirmationModal();
  setProposalLoading(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && proposalModal.classList.contains('is-open')) {
    closeProposalModal();
  }

  if (event.key === 'Escape' && proposalConfirmationModal.classList.contains('is-open')) {
    closeProposalConfirmationModal();
  }
});

document.querySelectorAll('a, button').forEach((trigger) => {
  const label = normalizeLabel(trigger.textContent || '');
  const href = trigger.getAttribute('href') || '';
  const isProposalTrigger = (
    isQuoteTriggerLabel(label) &&
    !label.includes('whatsapp') &&
    (href === '#cotizacion' || href.startsWith('mailto:') || trigger.classList.contains('nav-cta') || trigger.classList.contains('btn'))
  );

  if (!isProposalTrigger) return;

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openProposalModal(trigger);
  });
});

const whatsappFloat = document.createElement('div');
whatsappFloat.className = 'whatsapp-float';
whatsappFloat.innerHTML = `
  <div class="whatsapp-float-message">Habla con un agente</div>
  <a class="whatsapp-float-button" href="${whatsappUrl}" target="_blank" rel="noopener" aria-label="Hablar con un agente por WhatsApp">
    <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
  </a>
`;
document.body.append(whatsappFloat);
