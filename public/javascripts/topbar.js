(function initTopbarShell() {
  var MOBILE_BREAKPOINT = 860;
  var PUBLIC_BREAKPOINT = 1120;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setAriaState(target, isOpen) {
    if (!target) {
      return;
    }

    target.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var nextLabel = target.getAttribute(isOpen ? 'data-topbar-close-label' : 'data-topbar-open-label');
    if (nextLabel) {
      target.setAttribute('aria-label', nextLabel);
    }
  }

  function setupPublicTopbar(topbar) {
    var toggle = topbar.querySelector('[data-topbar-toggle]');
    var panel = topbar.querySelector('[data-topbar-panel]');
    var closeLinks = topbar.querySelectorAll('[data-topbar-close]');
    var closeTimer = null;

    if (!toggle || !panel) {
      return;
    }

    function hidePanel(immediate) {
      panel.classList.remove('is-open');
      topbar.classList.remove('is-menu-open');
      toggle.classList.remove('is-active');
      setAriaState(toggle, false);

      if (immediate || prefersReducedMotion) {
        panel.hidden = true;
        return;
      }

      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function onCloseDone() {
        if (!panel.classList.contains('is-open')) {
          panel.hidden = true;
        }
      }, 180);
    }

    function showPanel() {
      if (!panel.hidden) {
        panel.classList.add('is-open');
        topbar.classList.add('is-menu-open');
        toggle.classList.add('is-active');
        setAriaState(toggle, true);
        return;
      }

      panel.hidden = false;
      window.clearTimeout(closeTimer);
      requestAnimationFrame(function onFrame() {
        panel.classList.add('is-open');
        topbar.classList.add('is-menu-open');
        toggle.classList.add('is-active');
        setAriaState(toggle, true);
      });
    }

    toggle.addEventListener('click', function onToggleClick() {
      if (panel.hidden) {
        showPanel();
        return;
      }

      hidePanel(false);
    });

    closeLinks.forEach(function bindClose(link) {
      link.addEventListener('click', function onCloseLinkClick() {
        hidePanel(true);
      });
    });

    document.addEventListener('click', function onOutsideClick(event) {
      if (panel.hidden) {
        return;
      }

      if (!topbar.contains(event.target)) {
        hidePanel(false);
      }
    });

    document.addEventListener('keydown', function onEscape(event) {
      if (event.key === 'Escape' && !panel.hidden) {
        hidePanel(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', function onResize() {
      if (window.innerWidth > PUBLIC_BREAKPOINT) {
        hidePanel(true);
      }
    });

    setAriaState(toggle, false);
  }

  function setupAppTopbar(topbar) {
    var drawer = document.querySelector('[data-app-sidebar]');
    var drawerBackdrop = drawer ? drawer.querySelector('[data-app-sidebar-backdrop]') : null;
    var drawerPanel = drawer ? drawer.querySelector('.sidebar-panel') : null;
    var drawerCloseButtons = drawer ? drawer.querySelectorAll('[data-app-sidebar-close]') : [];
    var account = topbar.querySelector('[data-account]');
    var accountTrigger = topbar.querySelector('[data-account-trigger]');
    var accountPanel = topbar.querySelector('[data-account-panel]');
    var accountCloseTargets = topbar.querySelectorAll('[data-account-close]');
    var hideTimer = null;

    if (!accountTrigger || !drawer || !drawerBackdrop || !drawerPanel) {
      return;
    }

    function isMobileViewport() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function setDrawerBodyState(isOpen) {
      document.body.classList.toggle('app-drawer-open', Boolean(isOpen));
    }

    function syncTriggerContext() {
      var mobile = isMobileViewport();
      var openLabel = accountTrigger.getAttribute(mobile ? 'data-mobile-open-label' : 'data-account-open-label');
      var closeLabel = accountTrigger.getAttribute(mobile ? 'data-mobile-close-label' : 'data-account-close-label');
      var controls = accountTrigger.getAttribute(mobile ? 'data-mobile-controls' : 'data-account-controls');

      if (openLabel) {
        accountTrigger.setAttribute('data-topbar-open-label', openLabel);
      }

      if (closeLabel) {
        accountTrigger.setAttribute('data-topbar-close-label', closeLabel);
      }

      if (controls) {
        accountTrigger.setAttribute('aria-controls', controls);
      }

      accountTrigger.setAttribute('aria-haspopup', mobile ? 'dialog' : 'menu');
    }

    function closeDrawer(immediate) {
      syncTriggerContext();
      drawer.classList.remove('is-open');
      setDrawerBodyState(false);
      if (drawerBackdrop) {
        drawerBackdrop.classList.remove('is-open');
      }

      if (immediate || prefersReducedMotion) {
        drawerBackdrop.hidden = true;
        return;
      }

      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function onDrawerCloseDone() {
        if (!drawer.classList.contains('is-open')) {
          drawerBackdrop.hidden = true;
        }
      }, 220);
    }

    function openDrawer() {
      syncTriggerContext();
      setDrawerBodyState(true);
      if (!drawerBackdrop.hidden) {
        drawer.classList.add('is-open');
        drawerBackdrop.classList.add('is-open');
        setAriaState(accountTrigger, true);
        return;
      }

      drawerBackdrop.hidden = false;
      window.clearTimeout(hideTimer);
      requestAnimationFrame(function onDrawerFrame() {
        drawer.classList.add('is-open');
        drawerBackdrop.classList.add('is-open');
        setAriaState(accountTrigger, true);
      });
    }

    function closeAccountMenu(immediate) {
      if (!accountPanel) {
        return;
      }

      syncTriggerContext();
      accountPanel.classList.remove('is-open');
      account && account.classList.remove('is-open');
      setAriaState(accountTrigger, false);

      if (immediate || prefersReducedMotion) {
        accountPanel.hidden = true;
        return;
      }

      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(function onAccountCloseDone() {
        if (!accountPanel.classList.contains('is-open')) {
          accountPanel.hidden = true;
        }
      }, 160);
    }

    function openAccountMenu() {
      if (!accountPanel) {
        return;
      }

      syncTriggerContext();
      if (!accountPanel.hidden) {
        accountPanel.classList.add('is-open');
        account && account.classList.add('is-open');
        setAriaState(accountTrigger, true);
        return;
      }

      accountPanel.hidden = false;
      window.clearTimeout(hideTimer);
      requestAnimationFrame(function onAccountFrame() {
        accountPanel.classList.add('is-open');
        account && account.classList.add('is-open');
        setAriaState(accountTrigger, true);
      });
    }

    function toggleShell() {
      if (isMobileViewport()) {
        closeAccountMenu(true);
        if (drawer.classList.contains('is-open')) {
          closeDrawer(false);
          setAriaState(accountTrigger, false);
          return;
        }

        openDrawer();
        return;
      }

      closeDrawer(true);
      if (accountPanel && !accountPanel.hidden) {
        closeAccountMenu(false);
        return;
      }

      openAccountMenu();
    }

    accountTrigger.addEventListener('click', function onAccountTriggerClick() {
      toggleShell();
    });

    drawerCloseButtons.forEach(function bindDrawerClose(target) {
      target.addEventListener('click', function onDrawerCloseTargetClick() {
        if (isMobileViewport()) {
          closeDrawer(true);
          setAriaState(accountTrigger, false);
        }
      });
    });

    drawerBackdrop.addEventListener('click', function onBackdropClick() {
      closeDrawer(false);
      setAriaState(accountTrigger, false);
    });

    accountCloseTargets.forEach(function bindAccountClose(target) {
      target.addEventListener('click', function onAccountCloseClick() {
        if (!isMobileViewport()) {
          closeAccountMenu(true);
        }
      });
    });

    document.addEventListener('click', function onDocumentClick(event) {
      if (!topbar.contains(event.target) && accountPanel && !accountPanel.hidden) {
        closeAccountMenu(false);
      }
    });

    document.addEventListener('keydown', function onEscape(event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (drawer.classList.contains('is-open')) {
        closeDrawer(false);
        setAriaState(accountTrigger, false);
        accountTrigger.focus();
      }

      if (accountPanel && !accountPanel.hidden) {
        closeAccountMenu(false);
        accountTrigger.focus();
      }
    });

    window.addEventListener('resize', function onResize() {
      syncTriggerContext();
      if (!isMobileViewport()) {
        closeDrawer(true);
      } else {
        closeAccountMenu(true);
      }

      setAriaState(accountTrigger, false);
    });

    syncTriggerContext();
    setAriaState(accountTrigger, false);
    if (accountPanel) {
      accountPanel.hidden = true;
    }
    setDrawerBodyState(false);
    drawerBackdrop.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', function onLoad() {
    document.querySelectorAll('[data-topbar]').forEach(function setup(topbar) {
      var mode = topbar.getAttribute('data-topbar-mode') || 'app';
      if (mode === 'public') {
        setupPublicTopbar(topbar);
        return;
      }

      setupAppTopbar(topbar);
    });
  });
}());
