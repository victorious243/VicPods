(function initLazyHeroModels() {
  var shells = Array.from(document.querySelectorAll('[data-lazy-model]'));
  if (!shells.length) {
    return;
  }

  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  var saveData = Boolean(connection && connection.saveData);
  var slowNetwork = Boolean(connection && /(^|-)2g$/.test(String(connection.effectiveType || '').toLowerCase()));
  var lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  var modelViewerReady = null;

  function shouldSkipModel(shell) {
    var minWidth = Number(shell.getAttribute('data-model-min-width') || 0);

    if (minWidth && window.innerWidth < minWidth) {
      return true;
    }

    return prefersReducedMotion || coarsePointer || saveData || slowNetwork || lowMemory;
  }

  function loadModelViewerLibrary() {
    if (window.customElements && window.customElements.get('model-viewer')) {
      return Promise.resolve();
    }

    if (modelViewerReady) {
      return modelViewerReady;
    }

    modelViewerReady = new Promise(function resolveLoader(resolve, reject) {
      var script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
      script.async = true;
      script.onload = function onLoad() {
        if (!window.customElements || !window.customElements.whenDefined) {
          resolve();
          return;
        }

        window.customElements.whenDefined('model-viewer')
          .then(resolve)
          .catch(reject);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return modelViewerReady;
  }

  function buildViewer(shell) {
    var viewer = document.createElement('model-viewer');
    var source = shell.getAttribute('data-model-src');
    var rotationPerSecond = shell.getAttribute('data-model-rotation-per-second');
    var ariaLabel = shell.getAttribute('data-model-aria-label');

    if (!source) {
      return null;
    }

    viewer.setAttribute('src', source);
    viewer.setAttribute('shadow-intensity', shell.getAttribute('data-model-shadow-intensity') || '1');
    viewer.setAttribute('exposure', shell.getAttribute('data-model-exposure') || '1.05');
    viewer.setAttribute('environment-image', shell.getAttribute('data-model-environment-image') || 'neutral');
    viewer.setAttribute('interaction-prompt', 'none');
    viewer.setAttribute('touch-action', 'pan-y');
    viewer.setAttribute('loading', 'lazy');
    viewer.setAttribute('reveal', 'auto');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.background = 'transparent';

    if (ariaLabel) {
      viewer.setAttribute('aria-label', ariaLabel);
    } else {
      viewer.setAttribute('aria-hidden', 'true');
    }

    if (shell.getAttribute('data-model-auto-rotate') === 'true') {
      viewer.setAttribute('auto-rotate', '');
    }

    if (rotationPerSecond) {
      viewer.setAttribute('rotation-per-second', rotationPerSecond);
    }

    if (shell.getAttribute('data-model-camera-controls') === 'true') {
      viewer.setAttribute('camera-controls', '');
    }

    if (shell.getAttribute('data-model-disable-pan') !== 'false') {
      viewer.setAttribute('disable-pan', '');
    }

    return viewer;
  }

  function hydrateModel(shell) {
    if (shell.getAttribute('data-model-hydrated') === 'true') {
      return;
    }

    shell.setAttribute('data-model-hydrated', 'true');
    shell.classList.add('is-model-loading');

    loadModelViewerLibrary()
      .then(function onLibraryReady() {
        var viewer = buildViewer(shell);
        if (!viewer) {
          shell.classList.remove('is-model-loading');
          shell.classList.add('is-model-disabled');
          return;
        }

        viewer.addEventListener('load', function onModelLoad() {
          shell.classList.remove('is-model-loading');
          shell.classList.add('is-model-ready');
        }, { once: true });

        viewer.addEventListener('error', function onModelError() {
          shell.classList.remove('is-model-loading');
          shell.classList.add('is-model-disabled');
          if (viewer.parentNode === shell) {
            shell.removeChild(viewer);
          }
        }, { once: true });

        shell.appendChild(viewer);
      })
      .catch(function onLibraryError() {
        shell.classList.remove('is-model-loading');
        shell.classList.add('is-model-disabled');
      });
  }

  var observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(function onIntersect(entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        observer.unobserve(entry.target);
        hydrateModel(entry.target);
      });
    }, {
      rootMargin: '160px 0px',
      threshold: 0.01,
    })
    : null;

  shells.forEach(function prepareShell(shell) {
    if (shouldSkipModel(shell)) {
      shell.classList.add('is-model-disabled');
      return;
    }

    if (!observer) {
      hydrateModel(shell);
      return;
    }

    observer.observe(shell);
  });
}());
