(function initOnboarding() {
  var overlay = document.getElementById('onboarding-overlay');
  if (!overlay) {
    return;
  }

  var titleElement = document.getElementById('onboarding-title');
  var descriptionElement = document.getElementById('onboarding-description');
  var progressCounter = document.getElementById('onboarding-step-counter');
  var progressFill = document.getElementById('onboarding-progress-fill');
  var linksContainer = document.getElementById('onboarding-links');
  var skipButton = document.getElementById('onboarding-skip');
  var backButton = document.getElementById('onboarding-back');
  var nextButton = document.getElementById('onboarding-next');
  var highlight = document.getElementById('onboarding-highlight');
  var card = document.getElementById('onboarding-card');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STATE_KEY = 'vicpods_onboarding_state';
  var pagePath = window.location.pathname;
  var pageSearch = new URLSearchParams(window.location.search);

  var tours = {
    main: {
      match: function () {
        return pagePath === '/studio';
      },
      steps: [
        {
          title: 'Welcome to your AI podcast cockpit',
          description: 'VicPods is an AI-powered podcast structuring application that helps you plan, draft, and refine stronger episodes.',
          target: '#onboarding-studio-start',
          links: [
            { label: 'Start from Studio', href: '/studio' },
          ],
        },
        {
          title: 'Launch a single podcast',
          description: 'Pick Single Episode to produce one focused episode with a complete start-to-finish script workflow.',
          target: '#onboarding-start-single',
          links: [
            { label: 'Open Single Wizard', href: '/create/single', childTour: 'single' },
          ],
        },
        {
          title: 'Build a podcast series',
          description: 'Use Series to set up themes, continuity rules, and automated production for multiple episodes.',
          target: '#onboarding-start-series',
          links: [
            { label: 'Open Series Wizard', href: '/create/series', childTour: 'series' },
          ],
        },
        {
          title: 'Configure your workspace',
          description: 'Open Settings to manage profile, security, and account-level preferences.',
          target: '#onboarding-open-settings',
          links: [
            { label: 'Open Settings', href: '/settings?section=profile', childTour: 'settingsProfile' },
          ],
        },
        {
          title: 'Control lighting systems',
          description: 'Your lighting is the theme system. Use quick toggle or appearance settings.',
          target: '#theme-toggle',
          links: [
            { label: 'Open Appearance', href: '/settings?section=appearance', childTour: 'settingsAppearance' },
          ],
        },
        {
          title: 'You are onboarded',
          description: 'Tour complete. Your workflow is ready. Start creating and shipping episodes.',
          target: '#onboarding-studio-start',
          links: [],
        },
      ],
    },
    single: {
      match: function () {
        return pagePath === '/create/single';
      },
      steps: [
        {
          title: 'Quick tour: Single podcast',
          description: 'This wizard builds one complete standalone episode fast.',
          target: '#onboarding-single-wizard',
          links: [],
        },
        {
          title: 'Start with topic and audience',
          description: 'Define topic, audience, and intent first. This drives structure and hook quality.',
          target: '#onboarding-single-topic-title',
          links: [],
        },
        {
          title: 'Generate when ready',
          description: 'Use Generate to create your draft, then return to Studio to continue the main tour.',
          target: '#onboarding-single-generate',
          links: [
            { label: 'Back to Studio Tour', href: '/studio', resumeMain: true },
          ],
        },
      ],
    },
    series: {
      match: function () {
        return pagePath === '/create/series';
      },
      steps: [
        {
          title: 'Quick tour: Series mode',
          description: 'Series mode sets up continuity across themes and episodes.',
          target: '#onboarding-series-wizard',
          links: [],
        },
        {
          title: 'Set the series foundation',
          description: 'Name, goal, audience, and tone become defaults for every generated episode.',
          target: '#onboarding-series-name',
          links: [],
        },
        {
          title: 'Define themes and launch',
          description: 'Add themes, set episode defaults, and create your workspace.',
          target: '#onboarding-series-themes',
          links: [
            { label: 'Back to Studio Tour', href: '/studio', resumeMain: true },
          ],
        },
      ],
    },
    settingsProfile: {
      match: function () {
        var section = pageSearch.get('section') || 'profile';
        return pagePath === '/settings' && section === 'profile';
      },
      steps: [
        {
          title: 'Quick tour: Settings',
          description: 'Use settings tabs to control profile, appearance, security, and billing.',
          target: '#onboarding-settings-tabs',
          links: [],
        },
        {
          title: 'Profile configuration',
          description: 'Update name, email, and avatar so your workspace is personalized.',
          target: '#onboarding-settings-profile-form',
          links: [],
        },
        {
          title: 'Return to Studio',
          description: 'Profile setup is clear. Go back to continue the main onboarding flow.',
          target: '#onboarding-settings-tabs',
          links: [
            { label: 'Back to Studio Tour', href: '/studio', resumeMain: true },
          ],
        },
      ],
    },
    settingsAppearance: {
      match: function () {
        return pagePath === '/settings' && pageSearch.get('section') === 'appearance';
      },
      steps: [
        {
          title: 'Quick tour: Lighting controls',
          description: 'Lighting in VicPods means dark and light visual modes.',
          target: '#onboarding-settings-tab-appearance',
          links: [],
        },
        {
          title: 'Save default lighting',
          description: 'Set your default mode in Appearance for every future session.',
          target: '#appearance-form',
          links: [],
        },
        {
          title: 'Quick switch from topbar',
          description: 'The topbar toggle changes theme instantly from any page.',
          target: '#theme-toggle',
          links: [
            { label: 'Back to Studio Tour', href: '/studio', resumeMain: true },
          ],
        },
      ],
    },
  };
  var mainStepCount = tours.main.steps.length;

  function readState() {
    try {
      var raw = sessionStorage.getItem(STATE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeState(nextState) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(nextState || {}));
    } catch (error) {
      // no-op
    }
  }

  function clearState() {
    try {
      sessionStorage.removeItem(STATE_KEY);
    } catch (error) {
      // no-op
    }
  }

  function clampStep(value, max) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(max, Math.floor(value)));
  }

  function resolveTourId(saved) {
    if (saved && saved.activeTour && tours[saved.activeTour] && tours[saved.activeTour].match()) {
      return saved.activeTour;
    }

    if (tours.main.match()) {
      return 'main';
    }

    return null;
  }

  function hideOverlay() {
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    document.body.classList.remove('is-onboarding-active');
    if (highlight) {
      highlight.hidden = true;
    }
  }

  var savedState = readState();
  var activeTourId = resolveTourId(savedState);
  if (!activeTourId) {
    hideOverlay();
    return;
  }

  var activeTour = tours[activeTourId];
  var steps = activeTour.steps;

  function initialStep() {
    if (savedState && savedState.activeTour === activeTourId) {
      return clampStep(savedState.step, steps.length - 1);
    }

    if (activeTourId === 'main' && savedState && typeof savedState.resumeStep === 'number') {
      return clampStep(savedState.resumeStep, steps.length - 1);
    }

    return 0;
  }

  var currentStep = initialStep();
  var requestInFlight = false;

  function updateProgress(index, total) {
    var ratio = Math.max(0, Math.min(1, (index + 1) / total));
    progressFill.style.width = (ratio * 100) + '%';
    progressCounter.textContent = 'Step ' + (index + 1) + ' of ' + total;
  }

  function formatLinks(links) {
    linksContainer.innerHTML = '';

    if (!links || !links.length) {
      linksContainer.hidden = true;
      return;
    }

    links.forEach(function (linkItem) {
      var a = document.createElement('a');
      a.className = 'btn btn-secondary';
      a.href = linkItem.href;
      a.textContent = linkItem.label;
      a.setAttribute('target', '_self');
      a.addEventListener('click', function () {
        if (linkItem.childTour) {
          writeState({
            activeTour: linkItem.childTour,
            step: 0,
            resumeStep: Math.min(currentStep + 1, mainStepCount - 1),
          });
        } else if (linkItem.resumeMain) {
          var state = readState();
          var resumeStep = state && typeof state.resumeStep === 'number'
            ? clampStep(state.resumeStep, mainStepCount - 1)
            : 0;
          writeState({
            activeTour: 'main',
            step: resumeStep,
          });
        }
      });
      linksContainer.appendChild(a);
    });

    linksContainer.hidden = false;
  }

  function normalizeRect(rect, margin) {
    var safeMargin = margin || 10;
    return {
      top: Math.max(0, Math.floor(rect.top - safeMargin)),
      left: Math.max(0, Math.floor(rect.left - safeMargin)),
      width: Math.ceil(rect.width + safeMargin * 2),
      height: Math.ceil(rect.height + safeMargin * 2),
    };
  }

  function placeHighlight(targetSelector) {
    if (!highlight) {
      return;
    }

    if (!targetSelector) {
      highlight.hidden = true;
      return;
    }

    var target = document.querySelector(targetSelector);
    if (!target) {
      highlight.hidden = true;
      return;
    }

    var rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      highlight.hidden = true;
      return;
    }

    if (!prefersReducedMotion) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      target.scrollIntoView({ block: 'center' });
    }

    var position = normalizeRect(rect, 10);
    highlight.style.top = position.top + 'px';
    highlight.style.left = position.left + 'px';
    highlight.style.width = position.width + 'px';
    highlight.style.height = position.height + 'px';
    highlight.hidden = false;

    if (!prefersReducedMotion) {
      highlight.classList.add('is-active');
    } else {
      highlight.classList.remove('is-active');
    }
  }

  function postAction(path, buttonToDisable) {
    if (requestInFlight) {
      return Promise.resolve();
    }

    requestInFlight = true;
    if (buttonToDisable) {
      buttonToDisable.disabled = true;
      buttonToDisable.textContent = 'Saving...';
    }

    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'same-origin',
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Unable to save onboarding state.');
        }
        return response.json();
      })
      .finally(function () {
        requestInFlight = false;
      });
  }

  function closeOverlay() {
    clearState();
    overlay.classList.add('is-closing');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    document.body.classList.remove('is-onboarding-active');
    if (!prefersReducedMotion && card) {
      card.style.transform = '';
    }
    if (highlight) {
      highlight.hidden = true;
    }
  }

  function renderStep(index) {
    var step = steps[index];
    if (!step) {
      return;
    }

    var isLast = index === steps.length - 1;
    var lastActionLabel = activeTourId === 'main' ? 'Finish' : 'Back to Studio';

    titleElement.textContent = step.title;
    descriptionElement.textContent = step.description;

    updateProgress(index, steps.length);
    backButton.hidden = index === 0;
    nextButton.textContent = isLast ? lastActionLabel : 'Next';

    formatLinks(step.links);
    placeHighlight(step.target);
    writeState({
      activeTour: activeTourId,
      step: index,
      resumeStep: savedState && typeof savedState.resumeStep === 'number'
        ? clampStep(savedState.resumeStep, mainStepCount - 1)
        : activeTourId === 'main'
          ? undefined
          : Math.min(currentStep + 1, mainStepCount - 1),
    });

    if (!prefersReducedMotion) {
      card.classList.remove('is-animated');
      card.offsetWidth;
      card.classList.add('is-animated');
    }
  }

  function completeTour() {
    if (activeTourId !== 'main') {
      var currentState = readState();
      var resumeStep = currentState && typeof currentState.resumeStep === 'number'
        ? clampStep(currentState.resumeStep, mainStepCount - 1)
        : 0;
      writeState({
        activeTour: 'main',
        step: resumeStep,
      });
      window.location.assign('/studio');
      return;
    }

    postAction('/onboarding/complete', nextButton)
      .then(function () {
        closeOverlay();
      })
      .catch(function () {
        closeOverlay();
      });
  }

  function skipTour() {
    postAction('/onboarding/skip', skipButton)
      .then(function () {
        closeOverlay();
      })
      .catch(function () {
        closeOverlay();
      });
  }

  function show() {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-onboarding-active');
    renderStep(currentStep);
  }

  nextButton.addEventListener('click', function onNext() {
    if (currentStep === steps.length - 1) {
      completeTour();
      return;
    }

    currentStep += 1;
    renderStep(currentStep);
  });

  backButton.addEventListener('click', function onBack() {
    if (requestInFlight || currentStep === 0) {
      return;
    }

    currentStep -= 1;
    renderStep(currentStep);
  });

  skipButton.addEventListener('click', skipTour);
  overlay.addEventListener('click', function onOverlayClick(event) {
    if (event.target === overlay || event.target.id === 'onboarding-backdrop') {
      skipTour();
    }
  });

  window.addEventListener('resize', function () {
    var step = steps[currentStep];
    if (step) {
      placeHighlight(step.target);
    }
  });

  document.addEventListener('keydown', function onKeydown(event) {
    if (overlay.hidden || overlay.getAttribute('aria-hidden') === 'true') {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      skipTour();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextButton.click();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      backButton.click();
    }
  });

  show();
}());
