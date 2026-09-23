(() => {
  'use strict';

  const scriptUrl = document.currentScript.src;
  const frame = { width: 768, height: 448, columns: 4, cropX: 300, cropY: 125 };
  const animations = {
    idle: { file: 'darbgo-pet-idle-sprite.png', frames: 21, frameDuration: 135, loop: true },
    wave: { file: 'darbgo-pet-wave-sprite.png', frames: 29, frameDuration: 72, loop: false }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const assetUrl = file => new URL(`../../assets/Pet/${file}`, scriptUrl).href;
  const stylesheetUrl = new URL('../../css/components/pet.css', scriptUrl).href;

  if (!document.querySelector(`link[href="${stylesheetUrl}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = stylesheetUrl;
    document.head.append(stylesheet);
  }

  const pet = document.createElement('button');
  pet.type = 'button';
  pet.className = 'darbgo-pet';
  pet.setAttribute('aria-label', 'DarbGo assistant');
  let student;
  try { student = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null'); } catch { student = null; }
  const firstName = student?.fullName?.trim().split(/\s+/)[0];
  const message = document.createElement('span');
  message.className = 'darbgo-pet__message';
  message.setAttribute('aria-hidden', 'true');
  message.textContent = firstName ? `Welcome, ${firstName}!` : 'Welcome to DarbGo!';
  const spriteElement = document.createElement('span');
  spriteElement.className = 'darbgo-pet__sprite';
  spriteElement.setAttribute('aria-hidden', 'true');
  pet.append(message, spriteElement);
  document.body.append(pet);

  const sprite = pet.lastElementChild;
  let currentAnimation = '';
  let frameIndex = 0;
  let frameTimer = 0;
  let runToken = 0;
  let offsetX = 0;
  let offsetY = 0;
  let dragState = null;
  let suppressClick = false;
  let visibilityTimer = 0;
  let layoutMode = window.innerWidth <= 680 ? 'mobile' : 'desktop';

  const positionKey = () => `darbgoPetPosition:${layoutMode}`;
  const savePosition = () => sessionStorage.setItem(positionKey(), JSON.stringify({ x: offsetX, y: offsetY }));
  const bounds = () => {
    const style = getComputedStyle(pet);
    const baseX = window.innerWidth - parseFloat(style.right) - pet.offsetWidth;
    const baseY = window.innerHeight - parseFloat(style.bottom) - pet.offsetHeight;
    return { minX: -baseX, maxX: 0, minY: -baseY, maxY: 0 };
  };
  const movePet = (x, y, persist = false) => {
    const limit = bounds();
    offsetX = Math.min(limit.maxX, Math.max(limit.minX, x));
    offsetY = Math.min(limit.maxY, Math.max(limit.minY, y));
    pet.style.setProperty('--pet-x', `${offsetX}px`);
    pet.style.setProperty('--pet-y', `${offsetY}px`);
    pet.classList.toggle('is-message-below', pet.offsetTop + offsetY < 80);
    pet.classList.toggle('is-message-left', pet.offsetLeft + offsetX < 90);
    if (persist) savePosition();
  };
  const restorePosition = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(positionKey()) || 'null');
      movePet(Number.isFinite(saved?.x) ? saved.x : 0, Number.isFinite(saved?.y) ? saved.y : 0);
    } catch {
      sessionStorage.removeItem(positionKey());
      movePet(0, 0);
    }
  };

  const showFrame = index => {
    const column = index % frame.columns;
    const row = Math.floor(index / frame.columns);
    sprite.style.setProperty('--pet-frame-x', `${-(column * frame.width + frame.cropX)}px`);
    sprite.style.setProperty('--pet-frame-y', `${-(row * frame.height + frame.cropY)}px`);
  };

  const playPetAnimation = (name, options = {}) => {
    const animation = animations[name];
    if (!animation || (currentAnimation === name && !options.restart)) return false;
    window.clearTimeout(frameTimer);
    const token = ++runToken;
    currentAnimation = name;
    frameIndex = 0;
    sprite.style.backgroundImage = `url("${assetUrl(animation.file)}")`;
    pet.dataset.animation = name;
    showFrame(0);

    if (reducedMotion.matches) {
      if (name !== 'idle') frameTimer = window.setTimeout(() => playPetAnimation('idle'), 450);
      return true;
    }

    const advance = () => {
      if (token !== runToken) return;
      frameIndex += 1;
      if (frameIndex >= animation.frames) {
        if (!animation.loop) {
          playPetAnimation(options.next || 'idle');
          return;
        }
        frameIndex = 0;
      }
      showFrame(frameIndex);
      frameTimer = window.setTimeout(advance, animation.frameDuration);
    };
    frameTimer = window.setTimeout(advance, animation.frameDuration);
    return true;
  };

  pet.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (currentAnimation !== 'wave') playPetAnimation('wave');
  });

  pet.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offsetX, originY: offsetY, moved: false };
    window.clearTimeout(visibilityTimer);
    pet.setPointerCapture(event.pointerId);
    pet.classList.add('is-dragging');
  });
  pet.addEventListener('pointermove', event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.hypot(deltaX, deltaY) > 5) dragState.moved = true;
    if (dragState.moved) movePet(dragState.originX + deltaX, dragState.originY + deltaY);
  });
  const finishDrag = event => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    suppressClick = dragState.moved;
    if (suppressClick) window.setTimeout(() => { suppressClick = false; }, 0);
    pet.classList.remove('is-dragging');
    if (pet.hasPointerCapture(event.pointerId)) pet.releasePointerCapture(event.pointerId);
    if (dragState.moved) savePosition();
    dragState = null;
  };
  pet.addEventListener('pointerup', finishDrag);
  pet.addEventListener('pointercancel', finishDrag);

  const preload = Object.values(animations).map(animation => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = reject;
    image.src = assetUrl(animation.file);
  }));

  Promise.all(preload).then(() => {
    sessionStorage.removeItem('darbgoPetPosition');
    restorePosition();
    pet.classList.add('is-ready', 'is-context-visible');
    playPetAnimation(reducedMotion.matches ? 'idle' : 'wave');
    visibilityTimer = window.setTimeout(() => pet.classList.remove('is-context-visible'), 3600);
  }).catch(() => pet.remove());

  window.addEventListener('resize', () => {
    const nextMode = window.innerWidth <= 680 ? 'mobile' : 'desktop';
    if (nextMode !== layoutMode) {
      layoutMode = nextMode;
      restorePosition();
      return;
    }
    movePet(offsetX, offsetY, true);
  });
  window.addEventListener('pagehide', () => window.clearTimeout(frameTimer), { once: true });
  window.DarbGoPet = {
    play: playPetAnimation,
    say(text) {
      if (typeof text === 'string' && text.trim()) message.textContent = text.trim();
      window.clearTimeout(visibilityTimer);
      pet.classList.remove('is-context-visible');
      void pet.offsetWidth;
      pet.classList.add('is-context-visible');
      playPetAnimation('wave', { restart: true });
      visibilityTimer = window.setTimeout(() => pet.classList.remove('is-context-visible'), 4600);
    },
    animations: Object.keys(animations)
  };
})();
