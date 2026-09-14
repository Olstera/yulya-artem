(() => {
  'use strict';

  const settings = window.WEDDING;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function initPreview() {
    // A review-only route lets the couple inspect the mobile layout on a computer.
    const params = new URLSearchParams(location.search);
    if (params.get('preview') === 'mobile') document.documentElement.classList.add('design-preview');
    const target = new URL(settings.publicUrl || location.href);
    target.searchParams.delete('preview');
    target.hash = '';
    const local = ['localhost', '127.0.0.1', '::1'].includes(target.hostname);
    const code = document.querySelector('#qr-code');
    try {
      const qr = qrcode(0, 'M');
      qr.addData(target.href);
      qr.make();
      code.innerHTML = qr.createSvgTag({cellSize: 4, margin: 4, scalable: true});
    } catch {
      code.textContent = 'Откройте ссылку на телефоне';
    }
    document.querySelector('#local-qr-note').hidden = !local;
  }

  function initLinks() {
    document.querySelector('#map-link').href = settings.venueMapUrl;
    const giftLink = document.querySelector('#gift-link');
    if (settings.giftUrl && giftLink) {
      giftLink.href = settings.giftUrl;
      giftLink.hidden = false;
      document.querySelector('#gift-pending').hidden = true;
      document.querySelector('.gift-note').hidden = true;
    }
    if (settings.chatUrl) {
      const link = document.querySelector('#chat-link');
      link.href = settings.chatUrl;
      link.hidden = false;
      document.querySelector('#chat-pending').hidden = true;
    }
    const phone = document.querySelector('#contact-phone');
    phone.href = `tel:${settings.contact.phone}`;
    document.querySelector('.contact-name').textContent = settings.contact.name;
    const deadline = document.querySelector('#rsvp-deadline');
    deadline.dateTime = settings.rsvpDeadline;
    deadline.textContent = new Date(`${settings.rsvpDeadline}T12:00:00`).toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'}).replace(' г.', '');
  }

  function initPhoto() {
    if (settings.photoUrl) {
      const frame = document.querySelector('#couple-photo');
      const image = document.createElement('img');
      image.fetchPriority = 'high';
      image.decoding = 'async';
      image.src = settings.photoUrl;
      image.alt = 'Юлия и Артём';
      frame.querySelector('.photo-inner').replaceChildren(image);
      frame.removeAttribute('role');
      frame.removeAttribute('aria-label');
    }
  }

  function bindShortWords() {
    // Keep short Russian prepositions and conjunctions with the following word.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      if (node.parentElement.closest('script, style, textarea, option')) continue;
      node.textContent = node.textContent.replace(/(^|[\s(«])((?:в|во|на|к|ко|с|со|у|о|об|обо|от|до|из|за|по|под|над|для|без|при|про|через|перед|между|и|а|но|не)) +(?=\S)/giu, '$1$2\u00a0');
    }
  }

  function initGallery() {
    const track = document.querySelector('#photo-slides');
    if (settings.galleryPhotos?.length) {
      track.replaceChildren(...settings.galleryPhotos.map((src, index) => {
        const slide = document.createElement('div');
        slide.className = 'photo-slide';
        if (settings.galleryCoverPhotos?.includes(src)) slide.classList.add('photo-slide--cover');
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-label', `${index + 1} из ${settings.galleryPhotos.length}`);
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Фото ${index + 1}`;
        img.loading = 'lazy';
        slide.append(img);
        return slide;
      }));
    }
    const prev = document.querySelector('#slide-prev');
    const next = document.querySelector('#slide-next');
    const slideStep = () => track.firstElementChild.getBoundingClientRect().width
      + parseFloat(getComputedStyle(track).gap);
    const currentSlide = () => Math.round(track.scrollLeft / slideStep());
    const updateSlider = () => {
      const index = currentSlide();
      prev.disabled = index <= 0;
      next.disabled = index >= track.children.length - 1;
      document.querySelector('#slide-count').textContent = `${String(index + 1).padStart(2,'0')} / ${String(track.children.length).padStart(2,'0')}`;
    };
    const moveSlide = delta => track.scrollTo({
      left: (currentSlide() + delta) * slideStep(),
      behavior: reducedMotion.matches ? 'instant' : 'smooth'
    });
    prev.addEventListener('click', () => moveSlide(-1));
    next.addEventListener('click', () => moveSlide(1));
    track.addEventListener('scroll', updateSlider, {passive:true});
    track.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        moveSlide(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    new ResizeObserver(updateSlider).observe(track);
    updateSlider();
  }

  function initRsvp() {
    const form = document.querySelector('#rsvp-form');
    const toggleGroup = (id, visible, required = true) => {
      const group = document.getElementById(id);
      group.hidden = !visible;
      group.querySelectorAll('input').forEach(input => {
        input.disabled = !visible;
        if (!['radio', 'checkbox'].includes(input.type)) {
          input.required = visible && required;
        }
      });
    };
    const syncForm = () => {
      const attending = form.elements.attendance.value === 'yes';
      toggleGroup('attending-fields', attending, false);
      toggleGroup('companion-fields', attending && form.elements.plusOne.value === 'yes');
      toggleGroup('children-fields', attending && form.elements.children.value === 'yes');
      toggleGroup('parking-fields', attending && form.elements.parking.value === 'yes');
    };
    form.addEventListener('change', syncForm);
    syncForm();
    document.querySelector('#rsvp-preview-note').hidden = Boolean(settings.rsvpEndpoint);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const status = document.querySelector('#rsvp-status');
      if (!settings.rsvpEndpoint) {
        status.textContent = 'Анкета заполнена корректно. Это предпросмотр: ответ не отправлен. Подключим отправку перед приглашением гостей.';
        return;
      }
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      status.textContent = 'Отправляем ответ…';
      const data = new FormData(form);
      const payload = Object.fromEntries(data);
      for (const key of ['firstName', 'lastName', 'companionFirstName', 'companionLastName']) {
        if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
      }
      payload.drinks = data.getAll('drinks');
      try {
        const response = await fetch(settings.rsvpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error('Submission failed');
        form.reset();
        syncForm();
        status.textContent = 'Спасибо! Ваш ответ сохранён.';
      } catch {
        status.textContent = 'Не удалось подтвердить отправку. Попробуйте ещё раз или свяжитесь с Олей. Ваши ответы остались в форме.';
      } finally {
        button.disabled = false;
      }
    });
  }

  // Each figure moves as one unit, keeping its swatch and label together.
  function initPaletteMotion() {
    const palette = document.querySelector('.dress-palette');
    if (!palette || reducedMotion.matches || !('IntersectionObserver' in window)) return;

    palette.classList.add('palette-ready');
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      palette.classList.add('palette-visible');
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(palette);

    // Reveal immediately if the visitor enables reduced motion mid-session.
    reducedMotion.addEventListener('change', event => {
      if (!event.matches) return;
      palette.classList.remove('palette-ready');
      observer.disconnect();
    });
  }

  // Animate artwork itself: an animated parent would isolate mix-blend-mode.
  // Individual translate leaves the artwork's existing rotation and offset intact.
  function initElementMotion() {
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    const selectors = [
      '.photo-branch', '.falling-leaves', '.hero-pumpkin img',
      '.autumn-bridge img', '.gift-illustration img', '.map-card',
      '.action-link', '.map-button', '.hero-bottom a', '.slider-controls button'
    ];
    const elements = [...document.querySelectorAll(selectors.join(','))]
      .filter(element => !element.hidden);
    const opacity = new Map(elements.map(element => [element, getComputedStyle(element).opacity]));
    const animations = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        observer.unobserve(element);
        element.classList.remove('reveal-pending');
        const from = element.matches('.photo-branch--left, .falling-leaves--left') ? '-32px'
          : element.matches('.photo-branch--right, .falling-leaves--right, .hero-pumpkin img') ? '32px' : '0px';
        const animation = element.animate([
          { opacity: 0, translate: `${from} 0` },
          { opacity: opacity.get(element), translate: '0px 0' }
        ], { duration: 850, easing: 'cubic-bezier(0.42, 0, 0.2, 1)' });
        animations.set(element, animation);
        animation.onfinish = () => animations.delete(element);
      });
    }, { threshold: 0.15 });

    elements.forEach(element => {
      element.classList.add('reveal-pending');
      observer.observe(element);
      // Keyboard navigation must never land on an invisible button.
      element.addEventListener('focusin', () => {
        observer.unobserve(element);
        element.classList.remove('reveal-pending');
        animations.get(element)?.finish();
      });
    });
    reducedMotion.addEventListener('change', event => {
      if (!event.matches) return;
      observer.disconnect();
      elements.forEach(element => element.classList.remove('reveal-pending'));
      animations.forEach(animation => animation.finish());
    });
  }

  initPreview();
  initLinks();
  initPhoto();
  bindShortWords();
  initGallery();
  initRsvp();
  initPaletteMotion();
  initElementMotion();
})();
