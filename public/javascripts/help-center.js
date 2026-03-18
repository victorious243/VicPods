(() => {
  const revealItems = Array.from(document.querySelectorAll('[data-help-reveal]'));

  if (!revealItems.length) {
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -10% 0px',
    }
  );

  revealItems.forEach((item, index) => {
    item.style.setProperty('--help-reveal-delay', `${Math.min(index * 80, 320)}ms`);
    observer.observe(item);
  });

  const helpMicHero = document.querySelector('[data-help-mic-hero]');
  const helpMicMotion = document.querySelector('[data-help-mic-motion]');

  if (
    !helpMicHero ||
    !helpMicMotion ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  let currentX = 0;
  let currentY = 0;
  let currentRotateX = 0;
  let currentRotateY = 0;
  let targetX = 0;
  let targetY = 0;
  let targetRotateX = 0;
  let targetRotateY = 0;
  let rafId = null;

  const animateMic = () => {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    currentRotateX += (targetRotateX - currentRotateX) * 0.12;
    currentRotateY += (targetRotateY - currentRotateY) * 0.12;

    helpMicMotion.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg)`;

    const isSettled =
      Math.abs(targetX - currentX) < 0.08 &&
      Math.abs(targetY - currentY) < 0.08 &&
      Math.abs(targetRotateX - currentRotateX) < 0.08 &&
      Math.abs(targetRotateY - currentRotateY) < 0.08;

    if (isSettled) {
      rafId = null;
      return;
    }

    rafId = window.requestAnimationFrame(animateMic);
  };

  const queueMicAnimation = () => {
    if (rafId !== null) {
      return;
    }

    rafId = window.requestAnimationFrame(animateMic);
  };

  const resetMic = () => {
    targetX = 0;
    targetY = 0;
    targetRotateX = 0;
    targetRotateY = 0;
    queueMicAnimation();
  };

  helpMicHero.addEventListener('pointermove', (event) => {
    const rect = helpMicHero.getBoundingClientRect();
    const offsetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const offsetY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    targetX = offsetX * 14;
    targetY = offsetY * 10;
    targetRotateX = offsetY * -10;
    targetRotateY = offsetX * 16;

    queueMicAnimation();
  });

  helpMicHero.addEventListener('pointerleave', resetMic);
  window.addEventListener('blur', resetMic);
})();
