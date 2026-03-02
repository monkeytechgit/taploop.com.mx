(function () {
  'use strict';

  var SUPABASE_URL = 'https://ejhkjyofrazyxtxkohfo.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaGtqeW9mcmF6eXh0eGtvaGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3Mjg1MjMsImV4cCI6MjA4NzMwNDUyM30.MsYH7bPlJdjJelexsJn_4mLvWu3NMUCTt6mcgn08dZ8';

  // ── Inject modal HTML ──────────────────────────────────────────────────────
  var modalHTML = [
    '<div id="cot-overlay" class="cot-overlay" role="dialog" aria-modal="true" aria-label="Solicitar cotización">',
    '  <div class="cot-box">',
    '    <button class="cot-close" id="cot-close" aria-label="Cerrar">&times;</button>',
    '    <h2 class="cot-title">Solicitar cotización</h2>',
    '    <p class="cot-subtitle">Cuéntanos sobre tu proyecto y te contactamos en menos de 24h.</p>',
    '    <form id="cot-form" novalidate>',
    '      <div class="cot-row2">',
    '        <div class="cot-field">',
    '          <label for="cot-nombre">Nombre completo *</label>',
    '          <input type="text" id="cot-nombre" name="nombre_completo" placeholder="Tu nombre completo" required />',
    '        </div>',
    '        <div class="cot-field">',
    '          <label for="cot-correo">Correo electrónico *</label>',
    '          <input type="email" id="cot-correo" name="correo" placeholder="tu@correo.com" required />',
    '        </div>',
    '      </div>',
    '      <div class="cot-row2">',
    '        <div class="cot-field">',
    '          <label for="cot-tel">Teléfono</label>',
    '          <input type="tel" id="cot-tel" name="telefono" placeholder="+52 664 000 0000" />',
    '        </div>',
    '        <div class="cot-field">',
    '          <label for="cot-empresa">Empresa / Institución</label>',
    '          <input type="text" id="cot-empresa" name="empresa" placeholder="Nombre de tu empresa" />',
    '        </div>',
    '      </div>',
    '      <div class="cot-row2">',
    '        <div class="cot-field">',
    '          <label for="cot-tipo">Tipo de tarjeta</label>',
    '          <select id="cot-tipo" name="tipo_tarjeta">',
    '            <option value="">Selecciona...</option>',
    '            <option value="PVC">PVC</option>',
    '            <option value="Metálica">Metálica</option>',
    '            <option value="Otro">Otro</option>',
    '          </select>',
    '        </div>',
    '        <div class="cot-field">',
    '          <label for="cot-cantidad">Cantidad</label>',
    '          <input type="text" id="cot-cantidad" name="cantidad" placeholder="Ej: 50 unidades" />',
    '        </div>',
    '      </div>',
    '      <div class="cot-field">',
    '        <label for="cot-desc">Cuéntanos sobre tu proyecto</label>',
    '        <textarea id="cot-desc" name="descripcion" rows="3" placeholder="Detalles adicionales, fechas, personalizaciones..."></textarea>',
    '      </div>',
    '      <div id="cot-msg" class="cot-msg" hidden></div>',
    '      <button type="submit" class="btn btn-primary cot-submit" id="cot-submit">Enviar solicitud</button>',
    '      <p class="cot-disclaimer">Al enviar aceptas nuestra <a href="#">política de privacidad</a>.</p>',
    '    </form>',
    '  </div>',
    '</div>'
  ].join('\n');

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // ── Mobile nav toggle ──────────────────────────────────────────────────────
  var mobileToggle = document.querySelector('.mobile-toggle');
  var navLinks     = document.querySelector('.nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', function () {
      navLinks.classList.toggle('nav-open');
    });
    // Close menu when a link is clicked
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') navLinks.classList.remove('nav-open');
    });
    // Close menu on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav')) navLinks.classList.remove('nav-open');
    });
  }

  var overlay  = document.getElementById('cot-overlay');
  var closeBtn = document.getElementById('cot-close');
  var form     = document.getElementById('cot-form');
  var msgEl    = document.getElementById('cot-msg');
  var submitBtn = document.getElementById('cot-submit');

  // ── Open / close ───────────────────────────────────────────────────────────
  function openModal() {
    overlay.classList.add('cot-open');
    document.body.style.overflow = 'hidden';
    // Focus first input for accessibility
    setTimeout(function () {
      var first = overlay.querySelector('input, select, textarea');
      if (first) first.focus();
    }, 80);
  }

  function closeModal() {
    overlay.classList.remove('cot-open');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  closeBtn.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // ── Intercept "Solicitar cotización" clicks ────────────────────────────────
  // Triggers: nav-cta links, buttons/links with text "Solicitar cotización",
  // or anything pointing to contacto.html — EXCEPT when already on contacto.html.
  var isContactoPage = window.location.pathname.indexOf('contacto') !== -1;

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a[href="contacto.html"], .nav-cta, .btn');
    if (!el) return;

    var text = el.textContent.trim();
    var href = el.getAttribute('href') || '';

    var isCotizacion = text === 'Solicitar cotización' || text === 'Contacta al equipo';
    if (!isCotizacion) return;

    // On contacto.html itself let the page handle it (form already visible)
    if (isContactoPage) return;

    e.preventDefault();
    openModal();
  });

  // ── Form submission ────────────────────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Basic validation
    var nombre = form.nombre_completo.value.trim();
    var correo = form.correo.value.trim();
    if (!nombre || !correo) {
      showMsg('Por favor completa nombre y correo.', false);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    msgEl.hidden = true;

    var data = {
      nombre_completo : nombre,
      correo          : correo,
      telefono        : form.telefono.value.trim(),
      empresa         : form.empresa.value.trim(),
      tipo_tarjeta    : form.tipo_tarjeta.value,
      cantidad        : form.cantidad.value.trim(),
      descripcion     : form.descripcion.value.trim()
    };

    var emailParams = {
      title    : 'TapLoop | Cotización: ' + (data.tipo_tarjeta || 'General'),
      nombre   : data.nombre_completo,
      empresa  : data.empresa,
      correo   : data.correo,
      telefono : data.telefono,
      producto : data.tipo_tarjeta,
      cantidad : data.cantidad,
      entrega  : data.descripcion
    };

    // Fire EmailJS in parallel — errors visible in console
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        service_id     : 'service_gshjpyg',
        template_id    : 'template_y4y0gl8',
        user_id        : '5vTFdcXJ0G3y7ZaPs',
        template_params: emailParams
      })
    })
    .then(function(r) {
      if (!r.ok) r.text().then(function(t) { console.error('EmailJS error:', t); });
      else console.log('EmailJS: email enviado correctamente');
    })
    .catch(function(err) { console.error('EmailJS network error:', err); });

    fetch(SUPABASE_URL + '/rest/v1/contacto_webpage', {
      method  : 'POST',
      headers : {
        'apikey'       : SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type' : 'application/json',
        'Prefer'       : 'return=minimal'
      },
      body: JSON.stringify(data)
    })
    .then(function (res) {
      if (res.ok) {
        showMsg('¡Solicitud enviada! Te contactaremos inmediatamente. 🎉', true);
        form.reset();
        setTimeout(closeModal, 3000);
      } else {
        return res.json().then(function (err) {
          throw new Error(err.message || 'Error del servidor');
        });
      }
    })
    .catch(function () {
      showMsg('Hubo un error al enviar. Intenta de nuevo o escríbenos al WhatsApp.', false);
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar solicitud';
    });
  });

  function showMsg(text, success) {
    msgEl.textContent = text;
    msgEl.className = 'cot-msg ' + (success ? 'cot-success' : 'cot-error');
    msgEl.hidden = false;
  }

})();
