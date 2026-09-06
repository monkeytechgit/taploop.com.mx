(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (menuButton && mobileNav) {
    menuButton.addEventListener('click', () => {
      const expanded = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!expanded));
      mobileNav.style.display = expanded ? 'none' : 'block';
    });
  }

  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const main = gallery.querySelector('[data-gallery-main]');
    gallery.querySelectorAll('[data-gallery-image]').forEach((button) => {
      button.addEventListener('click', () => {
        main.src = button.dataset.galleryImage;
        main.alt = button.dataset.galleryAlt || '';
        gallery.querySelectorAll('[data-gallery-image]').forEach((item) => item.setAttribute('aria-current', 'false'));
        button.setAttribute('aria-current', 'true');
      });
    });
  }

  const configurator = document.querySelector('[data-product-configurator]');
  if (!configurator) return;

  const form = configurator.querySelector('[data-product-form]');
  const uploadPanel = configurator.querySelector('[data-upload-panel]');
  const designInputs = configurator.querySelectorAll('input[name="design"]');
  const finishInputs = configurator.querySelectorAll('input[name="finish"]');
  const stage = document.querySelector('[data-gallery-stage]');
  const dropzone = configurator.querySelector('[data-dropzone]');
  const fileInput = configurator.querySelector('[data-logo-input]');
  const preview = configurator.querySelector('[data-upload-preview]');
  const previewImage = configurator.querySelector('[data-upload-image]');
  const previewName = configurator.querySelector('[data-upload-name]');
  const previewSize = configurator.querySelector('[data-upload-size]');
  const removeUpload = configurator.querySelector('[data-upload-remove]');
  const quantityInput = configurator.querySelector('[data-quantity]');
  const minus = configurator.querySelector('[data-quantity-minus]');
  const plus = configurator.querySelector('[data-quantity-plus]');
  const status = configurator.querySelector('[data-form-status]');
  const submit = configurator.querySelector('.product-submit');

  const selectedValue = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || '';

  const updateDesign = () => {
    const custom = selectedValue('design') === 'custom';
    if (uploadPanel) uploadPanel.classList.toggle('is-visible', custom);
  };
  designInputs.forEach((input) => input.addEventListener('change', updateDesign));
  updateDesign();

  finishInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (stage) stage.classList.toggle('is-gloss', input.value === 'Gloss' && input.checked);
    });
  });

  const clearFile = () => {
    if (fileInput) fileInput.value = '';
    if (preview) preview.classList.remove('is-visible');
    if (previewImage) previewImage.removeAttribute('src');
  };

  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      if (status) status.textContent = 'El archivo supera el máximo de 10 MB.';
      clearFile();
      return;
    }
    if (previewName) previewName.textContent = file.name;
    if (previewSize) previewSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    if (preview) preview.classList.add('is-visible');
    if (file.type.startsWith('image/') && previewImage) {
      const reader = new FileReader();
      reader.onload = (event) => { previewImage.src = event.target.result; };
      reader.readAsDataURL(file);
    } else if (previewImage) {
      previewImage.removeAttribute('src');
      previewImage.alt = 'Archivo de logotipo seleccionado';
    }
    if (status) status.textContent = '';
  };

  if (fileInput) fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  if (dropzone) {
    ['dragenter','dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('is-dragover');
    }));
    ['dragleave','drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('is-dragover');
    }));
    dropzone.addEventListener('drop', (event) => {
      const file = event.dataTransfer.files[0];
      if (fileInput && file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        fileInput.files = transfer.files;
      }
      handleFile(file);
    });
  }
  if (removeUpload) removeUpload.addEventListener('click', clearFile);

  const clampQuantity = (value) => Math.min(99, Math.max(1, Number(value) || 1));
  if (minus) minus.addEventListener('click', () => { quantityInput.value = clampQuantity(Number(quantityInput.value) - 1); });
  if (plus) plus.addEventListener('click', () => { quantityInput.value = clampQuantity(Number(quantityInput.value) + 1); });
  if (quantityInput) quantityInput.addEventListener('change', () => { quantityInput.value = clampQuantity(quantityInput.value); });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const design = selectedValue('design');
    if (design === 'custom' && fileInput && !fileInput.files.length) {
      status.textContent = 'Carga tu logotipo para continuar con el diseño personalizado.';
      uploadPanel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const item = {
      product: configurator.dataset.productName,
      unitPrice: Number(configurator.dataset.productPrice),
      quantity: clampQuantity(quantityInput?.value),
      design,
      finish: selectedValue('finish'),
      color: selectedValue('color'),
      logoName: fileInput?.files[0]?.name || '',
      addedAt: new Date().toISOString()
    };
    const cart = JSON.parse(localStorage.getItem('taploeCart') || '[]');
    cart.push(item);
    localStorage.setItem('taploeCart', JSON.stringify(cart));
    status.textContent = `${item.product} se agregó al carrito.`;
    submit.classList.add('is-added');
    const original = submit.textContent;
    submit.textContent = 'Agregado al carrito ✓';
    setTimeout(() => { submit.classList.remove('is-added'); submit.textContent = original; }, 2200);
  });
})();
