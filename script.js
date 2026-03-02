document.addEventListener('DOMContentLoaded', () => {
  const carousels = document.querySelectorAll('[data-carousel]');

  carousels.forEach((carousel) => {
    const container = carousel.closest('.product-layout');
    if (!container) return;

    const info = container.querySelector('.product-info');
    if (!info) return;

    let images = [];
    try {
      images = JSON.parse(info.dataset.images || '[]');
    } catch {
      images = [];
    }

    if (!images.length) return;

    const mainImage = carousel.querySelector('[data-main-image]');
    const prev = carousel.querySelector('[data-prev]');
    const next = carousel.querySelector('[data-next]');
    const current = carousel.querySelector('[data-current]');
    const total = carousel.querySelector('[data-total]');
    const thumbButtons = carousel.querySelectorAll('[data-slide]');

    let index = 0;
    total.textContent = String(images.length);

    const render = () => {
      mainImage.src = images[index];
      current.textContent = String(index + 1);

      thumbButtons.forEach((button) => {
        const isActive = Number(button.dataset.slide) === index;
        button.classList.toggle('active', isActive);
      });
    };

    prev?.addEventListener('click', () => {
      index = (index - 1 + images.length) % images.length;
      render();
    });

    next?.addEventListener('click', () => {
      index = (index + 1) % images.length;
      render();
    });

    thumbButtons.forEach((button) => {
      button.addEventListener('click', () => {
        index = Number(button.dataset.slide);
        render();
      });
    });

    render();
  });
});