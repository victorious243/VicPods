(function initAiLoading() {
  function resolveLanguage() {
    return String(document.documentElement.getAttribute('lang') || 'en').toLowerCase().slice(0, 2);
  }

  function getLanguageCopy() {
    var language = resolveLanguage();
    if (language === 'es') {
      return {
        messages: [
          'Analizando el contexto y objetivos de tu episodio.',
          'Aplicando guias de tono, estructura y continuidad.',
          'Sirviendo tu borrador compacto listo para grabar.',
        ],
        cooking: 'Cocinando...',
      };
    }

    if (language === 'pt') {
      return {
        messages: [
          'Analisando o contexto e objetivos do seu episodio.',
          'Aplicando guias de tom, estrutura e continuidade.',
          'Servindo seu rascunho compacto pronto para gravacao.',
        ],
        cooking: 'Cozinhando...',
      };
    }

    return {
      messages: [
        'Analyzing your episode context and goals.',
        'Applying tone, structure, and continuity guardrails.',
        'Plating your compact recording-ready draft.',
      ],
      cooking: 'Cooking...',
    };
  }

  function getAiForms() {
    return Array.from(document.querySelectorAll('form[action^="/ai/"], form[data-ai-loading="true"]'));
  }

  function getSubmitControls(form) {
    return Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'));
  }

  function setupOverlay() {
    var overlay = document.getElementById('ai-loader-overlay');
    if (!overlay) {
      return null;
    }

    var statusLabel = overlay.querySelector('[data-ai-loader-status]');
    var steps = Array.from(overlay.querySelectorAll('.ai-loader-step'));
    var copy = getLanguageCopy();
    var messages = copy.messages;
    var timer = null;
    var currentStep = 0;

    function setStep(index) {
      currentStep = index;
      if (statusLabel) {
        statusLabel.textContent = messages[index] || messages[0];
      }

      steps.forEach(function (step, stepIndex) {
        step.classList.toggle('is-active', stepIndex === index);
        step.classList.toggle('is-complete', stepIndex < index);
      });
    }

    function startCycle() {
      setStep(0);

      timer = window.setInterval(function () {
        var next = (currentStep + 1) % messages.length;
        setStep(next);
      }, 1500);
    }

    function stopCycle() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function show() {
      stopCycle();
      setStep(0);
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-visible');
      startCycle();
    }

    function hide() {
      stopCycle();
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
    }

    return { show: show, hide: hide, cookingText: copy.cooking };
  }

  document.addEventListener('DOMContentLoaded', function onReady() {
    var overlay = setupOverlay();
    if (!overlay) {
      return;
    }

    var aiForms = getAiForms();
    if (!aiForms.length) {
      return;
    }

    aiForms.forEach(function (form) {
      form.addEventListener('submit', function onSubmit(event) {
        if (!shouldShowLoader(form)) {
          return;
        }

        overlay.show();

        var controls = getSubmitControls(form);
        controls.forEach(function (control) {
          control.disabled = true;
          if (control.tagName === 'BUTTON') {
            if (!control.dataset.originalLabel) {
              control.dataset.originalLabel = control.textContent;
            }
            control.textContent = overlay.cookingText;
          } else if (control.tagName === 'INPUT') {
            if (!control.dataset.originalLabel) {
              control.dataset.originalLabel = control.value;
            }
            control.value = overlay.cookingText;
          }
        });

        if (event.submitter && event.submitter.tagName === 'BUTTON') {
          event.submitter.textContent = overlay.cookingText;
        }
      });
    });

    window.addEventListener('pageshow', function onPageShow() {
      overlay.hide();
    });
  });
}());
  function shouldShowLoader(form) {
    var action = String(form.getAttribute('action') || '');
    if (action.indexOf('/ai/') === 0) {
      return true;
    }

    if (form.getAttribute('data-ai-loading') === 'true') {
      var guardName = form.getAttribute('data-ai-loading-guard');
      if (!guardName) {
        return true;
      }

      var field = form.elements[guardName];
      if (!field) {
        return true;
      }

      if (field.type === 'checkbox') {
        return Boolean(field.checked);
      }

      return Boolean(String(field.value || '').trim());
    }

    return false;
  }
