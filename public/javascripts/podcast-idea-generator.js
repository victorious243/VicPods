(function initPodcastIdeaGenerator() {
  if (typeof document === 'undefined') {
    return;
  }

  var form = document.querySelector('[data-idea-generator-form]');
  if (!form) {
    return;
  }

  var input = form.querySelector('[data-idea-generator-input]');
  var submitButton = form.querySelector('[data-idea-generator-submit]');
  var statusNode = form.querySelector('[data-idea-generator-status]');
  var errorNode = form.querySelector('[data-idea-generator-error]');
  var resultsShell = document.querySelector('[data-idea-generator-results-shell]');
  var resultsSummary = document.querySelector('[data-idea-generator-results-summary]');
  var resultsGrid = document.querySelector('[data-idea-generator-results]');
  var saveForm = document.querySelector('[data-idea-save-form]');
  var saveEmailInput = saveForm ? saveForm.querySelector('[data-idea-save-email]') : null;
  var saveSubmitButton = saveForm ? saveForm.querySelector('[data-idea-save-submit]') : null;
  var saveStatusNode = saveForm ? saveForm.querySelector('[data-idea-save-status]') : null;
  var cardTemplate = document.getElementById('podcast-idea-card-template');
  var episodeGeneratorBase = form.getAttribute('data-episode-generator-base') || '/';
  var defaultButtonLabel = submitButton ? submitButton.textContent.trim() : 'Generate ideas';
  var defaultSaveButtonLabel = saveSubmitButton ? saveSubmitButton.textContent.trim() : 'Save My Ideas';
  var autoTriggered = false;
  var loadingTimer = null;
  var lastPayload = null;
  var loadingMessages = [
    'Scanning strong angles',
    'Generating hook directions',
    'Building the idea list',
  ];

  function setError(message) {
    if (!errorNode) {
      return;
    }

    errorNode.hidden = !message;
    errorNode.textContent = message || '';
  }

  function setSaveStatus(message, isError) {
    if (!saveStatusNode) {
      return;
    }

    saveStatusNode.hidden = !message;
    saveStatusNode.textContent = message || '';
    saveStatusNode.classList.toggle('is-error', Boolean(isError));
  }

  function stopLoadingMessages() {
    if (loadingTimer) {
      window.clearInterval(loadingTimer);
      loadingTimer = null;
    }
  }

  function setLoading(isLoading) {
    form.classList.toggle('is-loading', isLoading);

    if (submitButton) {
      submitButton.disabled = isLoading;
      submitButton.textContent = isLoading ? 'Generating...' : defaultButtonLabel;
    }

    if (!statusNode) {
      return;
    }

    if (!isLoading) {
      statusNode.hidden = true;
      statusNode.textContent = '';
      stopLoadingMessages();
      return;
    }

    var index = 0;
    statusNode.hidden = false;
    statusNode.textContent = loadingMessages[index];
    stopLoadingMessages();
    loadingTimer = window.setInterval(function () {
      index = (index + 1) % loadingMessages.length;
      statusNode.textContent = loadingMessages[index];
    }, 900);
  }

  function updateShareableUrl(niche) {
    if (!window.history || !window.history.replaceState) {
      return;
    }

    var url = new URL(window.location.href);
    if (niche) {
      url.searchParams.set('niche', niche);
    } else {
      url.searchParams.delete('niche');
    }

    window.history.replaceState({}, '', url.pathname + url.search);
  }

  function buildSeedIdea(idea) {
    return [idea.title, idea.hookAngle].filter(Boolean).join('. ');
  }

  function buildEpisodeUrl(idea) {
    var url = new URL(episodeGeneratorBase, window.location.origin);
    url.searchParams.set('idea', buildSeedIdea(idea));
    return url.pathname + url.search + '#idea-to-episode-generator';
  }

  function copyIdeaText(idea, button) {
    var text = idea.title + '\nHook angle: ' + idea.hookAngle;
    var originalLabel = button.textContent;

    function setCopiedLabel(label) {
      button.textContent = label;
      window.setTimeout(function () {
        button.textContent = originalLabel;
      }, 1400);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setCopiedLabel('Copied');
      }).catch(function () {
        setCopiedLabel('Copy failed');
      });
      return;
    }

    setCopiedLabel('Copy unavailable');
  }

  function renderIdeas(payload) {
    var ideas = Array.isArray(payload && payload.ideas) ? payload.ideas : [];
    if (!resultsGrid || !cardTemplate) {
      return;
    }

    lastPayload = {
      niche: payload && payload.niche ? payload.niche : '',
      ideas: ideas,
    };

    resultsGrid.innerHTML = '';

    ideas.forEach(function (idea, index) {
      var fragment = cardTemplate.content.cloneNode(true);
      var indexNode = fragment.querySelector('[data-idea-card-index]');
      var titleNode = fragment.querySelector('[data-idea-card-title]');
      var hookNode = fragment.querySelector('[data-idea-card-hook]');
      var copyButton = fragment.querySelector('[data-idea-card-copy]');
      var turnLink = fragment.querySelector('[data-idea-card-turn]');

      if (indexNode) {
        indexNode.textContent = String(index + 1).padStart(2, '0');
      }
      if (titleNode) {
        titleNode.textContent = idea.title || 'Untitled idea';
      }
      if (hookNode) {
        hookNode.textContent = idea.hookAngle || '';
      }
      if (turnLink) {
        turnLink.setAttribute('href', buildEpisodeUrl(idea));
      }
      if (copyButton) {
        copyButton.addEventListener('click', function () {
          copyIdeaText(idea, copyButton);
        });
      }

      resultsGrid.appendChild(fragment);
    });

    if (resultsSummary) {
      resultsSummary.textContent = payload && payload.niche
        ? 'Ideas tailored to ' + payload.niche + '. Pick one and turn it into an episode.'
        : '10 broad podcast ideas ready to refine into a real episode.';
    }

    if (resultsShell) {
      resultsShell.hidden = false;
      resultsShell.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }

  function setSaveLoading(isLoading) {
    if (!saveSubmitButton) {
      return;
    }

    saveSubmitButton.disabled = isLoading;
    saveSubmitButton.textContent = isLoading ? 'Saving...' : defaultSaveButtonLabel;
  }

  async function handleSaveIdeas(event) {
    event.preventDefault();

    if (!lastPayload || !Array.isArray(lastPayload.ideas) || !lastPayload.ideas.length) {
      setSaveStatus('Generate ideas first.', true);
      return;
    }

    if (!saveEmailInput || !saveEmailInput.value.trim()) {
      setSaveStatus('Enter your email to save these ideas.', true);
      saveEmailInput && saveEmailInput.focus();
      return;
    }

    setSaveStatus('');
    setSaveLoading(true);

    try {
      var response = await fetch('/api/public/save-preview', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'podcast_ideas',
          email: saveEmailInput.value.trim(),
          payload: lastPayload,
        }),
      });

      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save ideas right now.');
      }

      setSaveStatus(payload.message || 'Ideas saved. Check your inbox.');
    } catch (error) {
      setSaveStatus(error.message || 'Unable to save ideas right now.', true);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    var niche = input ? input.value.trim() : '';

    setError('');
    setLoading(true);
    updateShareableUrl(niche);

    try {
      var response = await fetch(form.action, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          niche: niche,
          language: document.documentElement.getAttribute('lang') || 'en',
        }),
      });

      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to generate podcast ideas right now.');
      }

      renderIdeas(payload);
    } catch (error) {
      setError(error.message || 'Unable to generate podcast ideas right now.');
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', handleSubmit);
  if (saveForm) {
    saveForm.addEventListener('submit', handleSaveIdeas);
  }

  if (input && input.value.trim() && !autoTriggered) {
    autoTriggered = true;
    window.requestAnimationFrame(function () {
      handleSubmit();
    });
  }
}());
