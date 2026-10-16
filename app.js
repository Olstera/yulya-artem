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

  function initPhotoContest() {
    const track = document.querySelector('#contest-slides');
    const nominations = settings.contestNominations || [];
    if (!track || !nominations.length) return;

    const dialog = document.querySelector('#contest-dialog');
    const form = document.querySelector('#contest-form');
    const nominationInput = document.querySelector('#contest-nomination');
    const selectedNomination = document.querySelector('#contest-selected');
    const status = document.querySelector('#contest-status');
    const fileInput = document.querySelector('#contest-photo');
    const prev = document.querySelector('#contest-prev');
    const next = document.querySelector('#contest-next');
    const maxPhotos = 5;

    track.replaceChildren(...nominations.map((nomination, index) => {
      const slide = document.createElement('article');
      slide.className = 'contest-slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'слайд');
      slide.setAttribute('aria-label', `${index + 1} из ${nominations.length}`);

      const number = document.createElement('span');
      number.className = 'contest-slide-number';
      number.textContent = String(index + 1).padStart(2, '0');
      const eyebrow = document.createElement('span');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `НОМИНАЦИЯ ${String(index + 1).padStart(2, '0')}`;
      const title = document.createElement('h3');
      title.textContent = nomination;
      const button = document.createElement('button');
      button.className = 'action-link contest-join';
      button.type = 'button';
      button.append(document.createTextNode('Участвовать в номинации'));
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.setAttribute('width', '18');
      arrow.setAttribute('height', '18');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.setAttribute('focusable', 'false');
      arrow.classList.add('button-arrow');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 19 19 5M5 5h14v14');
      arrow.append(path);
      button.append(arrow);
      button.addEventListener('click', () => {
        nominationInput.value = nomination;
        selectedNomination.textContent = nomination;
        status.textContent = '';
        form.reset();
        nominationInput.value = nomination;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      });
      slide.append(number, eyebrow, title, button);
      return slide;
    }));

    const slideStep = () => track.firstElementChild.getBoundingClientRect().width
      + parseFloat(getComputedStyle(track).gap);
    const currentSlide = () => Math.round(track.scrollLeft / slideStep());
    const updateSlider = () => {
      const index = currentSlide();
      prev.disabled = index <= 0;
      next.disabled = index >= track.children.length - 1;
      document.querySelector('#contest-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(track.children.length).padStart(2, '0')}`;
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

    document.querySelector('#contest-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });

    const validatePhotoCount = () => {
      fileInput.setCustomValidity(fileInput.files.length > maxPhotos
        ? `Можно выбрать не больше ${maxPhotos} фото за одну отправку.`
        : '');
    };
    fileInput.addEventListener('change', validatePhotoCount);

    const decodeImage = file => new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('unsupported-image')); };
      image.src = objectUrl;
    });

    async function preparePhoto(file) {
      if (!file || !file.type.startsWith('image/')) throw new Error('Выберите файл с фотографией.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Исходное фото должно быть меньше 20 МБ.');

      let image;
      try {
        image = 'createImageBitmap' in window ? await createImageBitmap(file) : await decodeImage(file);
      } catch {
        throw new Error('Не удалось открыть фото. Попробуйте выбрать снимок в формате JPEG.');
      }

      let scale = Math.min(1, 1600 / Math.max(image.width, image.height));
      let blob;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', Math.max(.5, .84 - attempt * .07)));
        if (blob && blob.size <= 1_500_000) break;
        scale *= .85;
      }
      image.close?.();
      if (!blob || blob.size > 1_500_000) throw new Error('Не удалось уменьшить это фото для отправки. Выберите другое.');

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Не удалось подготовить фото.'));
        reader.readAsDataURL(blob);
      });
      return dataUrl.split(',')[1];
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      validatePhotoCount();
      if (!form.reportValidity()) return;
      const button = form.querySelector('[type=submit]');
      const files = Array.from(fileInput.files || []);
      if (!settings.photoContestEndpoint) {
        status.textContent = 'Форма готова, но загрузка ещё не подключена. Фото не отправлено.';
        return;
      }
      if (!files.length || files.length > maxPhotos) return;

      button.disabled = true;
      let uploaded = 0;
      try {
        for (let index = 0; index < files.length; index += 1) {
          status.textContent = `Подготавливаем фото ${index + 1} из ${files.length}…`;
          const imageData = await preparePhoto(files[index]);
          const payload = {
            action: 'photoContest',
            nomination: nominationInput.value,
            guestName: form.elements.guestName.value.trim(),
            table: form.elements.table.value.trim(),
            imageData
          };
          const response = await fetch(settings.photoContestEndpoint, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify(payload)
          });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.message || 'Не удалось отправить фото.');
          uploaded += 1;
          status.textContent = `Отправлено ${uploaded} из ${files.length} фото…`;
        }
        status.textContent = `${uploaded === 1 ? 'Фото отправлено' : `Отправлено ${uploaded} фото`}. Спасибо за участие!`;
        form.reset();
        window.setTimeout(() => dialog.close(), 1200);
      } catch (error) {
        status.textContent = uploaded
          ? `Отправлено ${uploaded} из ${files.length} фото. Остальные не удалось отправить: ${error.message || 'попробуйте ещё раз.'}`
          : error.message || 'Не удалось отправить фото. Попробуйте ещё раз.';
      } finally {
        button.disabled = false;
      }
    });
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
      '.autumn-bridge img', '.gift-illustration img', '.map-card', '.contest-join',
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
  initPhotoContest();
  initRsvp();
  initPaletteMotion();
  initElementMotion();
})();
