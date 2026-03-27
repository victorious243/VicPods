(function initTopbarMenu() {
  var DESKTOP_BREAKPOINT = 1120;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupTopbar(topbar) {
    var toggle = topbar.querySelector('[data-topbar-toggle]');
    var panel = topbar.querySelector('[data-topbar-panel]');
    var closeLinks = panel ? panel.querySelectorAll('[data-topbar-close]') : [];
    var closeTimer = null;

    if (!toggle || !panel) {
      return;
    }

    function setExpandedState(isOpen) {
      var nextLabel = toggle.getAttribute(isOpen ? 'data-topbar-close-label' : 'data-topbar-open-label');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (nextLabel) {
        toggle.setAttribute('aria-label', nextLabel);
      }
    }

    function openMenu() {
      if (!panel.hidden) {
        setExpandedState(true);
        topbar.classList.add('is-menu-open');
        toggle.classList.add('is-active');
        panel.classList.add('is-open');
        return;
      }

      window.clearTimeout(closeTimer);
      panel.hidden = false;
      requestAnimationFrame(function onNextFrame() {
        topbar.classList.add('is-menu-open');
        toggle.classList.add('is-active');
        panel.classList.add('is-open');
        setExpandedState(true);
      });
    }

    function hidePanel() {
      panel.hidden = true;
      panel.classList.remove('is-open');
      topbar.classList.remove('is-menu-open');
      toggle.classList.remove('is-active');
      setExpandedState(false);
    }

    function closeMenu(immediate) {
      if (panel.hidden) {
        setExpandedState(false);
        topbar.classList.remove('is-menu-open');
        toggle.classList.remove('is-active');
        panel.classList.remove('is-open');
        return;
      }

      panel.classList.remove('is-open');
      topbar.classList.remove('is-menu-open');
      toggle.classList.remove('is-active');
      setExpandedState(false);

      if (immediate || prefersReducedMotion) {
        panel.hidden = true;
        return;
      }

      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function onCloseDone() {
        if (!panel.classList.contains('is-open')) {
          panel.hidden = true;
        }
      }, 220);
    }

    function toggleMenu() {
      if (panel.hidden) {
        openMenu();
        return;
      }

      closeMenu(false);
    }

    toggle.addEventListener('click', function handleToggleClick() {
      toggleMenu();
    });

    closeLinks.forEach(function bindCloseLink(link) {
      link.addEventListener('click', function handlePanelNavigation() {
        closeMenu(true);
      });
    });

    document.addEventListener('click', function handleOutsideClick(event) {
      if (panel.hidden) {
        return;
      }

      if (!topbar.contains(event.target)) {
        closeMenu(false);
      }
    });

    document.addEventListener('keydown', function handleEscape(event) {
      if (event.key === 'Escape' && !panel.hidden) {
        closeMenu(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', function handleResize() {
      if (window.innerWidth > DESKTOP_BREAKPOINT) {
        closeMenu(true);
      }
    });

    setExpandedState(false);
  }

  document.addEventListener('DOMContentLoaded', function onLoad() {
    var topbars = document.querySelectorAll('[data-topbar]');
    topbars.forEach(setupTopbar);
  });
}());
