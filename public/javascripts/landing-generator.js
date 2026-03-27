(function initLandingGenerator() {
  if (typeof document === 'undefined') {
    return;
  }

  const form = document.querySelector('[data-public-generator-form]');
  if (!form) {
    return;
  }

  const textarea = form.querySelector('[data-public-generator-input]');
  const submitButton = form.querySelector('[data-public-generator-submit]');
  const errorNode = form.querySelector('[data-public-generator-error]');
  const statusNode = form.querySelector('[data-public-generator-status]');
  const resultShell = document.querySelector('[data-public-generator-result]');
  const titleNode = resultShell?.querySelector('[data-public-preview-title]');
  const hookNode = resultShell?.querySelector('[data-public-preview-hook]');
  const outlineNode = resultShell?.querySelector('[data-public-preview-outline]');
  const ctaNode = resultShell?.querySelector('[data-public-preview-cta]');
  const launchPackShell = resultShell?.querySelector('[data-public-launchpack-shell]');
  const launchPackAccessShell = resultShell?.querySelector('[data-public-launchpack-access-shell]');
  const launchPackTitles = resultShell?.querySelector('[data-public-launchpack-titles]');
  const launchPackDescription = resultShell?.querySelector('[data-public-launchpack-description]');
  const launchPackShowNotes = resultShell?.querySelector('[data-public-launchpack-show-notes]');
  const launchPackCaptions = resultShell?.querySelector('[data-public-launchpack-captions]');
  const launchPackCtaScript = resultShell?.querySelector('[data-public-launchpack-cta-script]');
  const launchPackBadges = resultShell?.querySelectorAll('[data-public-launchpack-badge]');
  const launchPackLocks = resultShell?.querySelectorAll('[data-public-launchpack-lock]');
  const saveForm = resultShell?.querySelector('[data-save-preview-form]');
  const saveEmailInput = saveForm?.querySelector('[data-save-preview-email]');
  const saveSubmitButton = saveForm?.querySelector('[data-save-preview-submit]');
  const saveStatusNode = saveForm?.querySelector('[data-save-preview-status]');
  const exportButton = resultShell?.querySelector('[data-public-export-button]');
  const exportStatusNode = resultShell?.querySelector('[data-public-export-status]');

  const defaultButtonLabel = submitButton ? submitButton.textContent.trim() : 'Generate Episode';
  const defaultSaveButtonLabel = saveSubmitButton ? saveSubmitButton.textContent.trim() : 'Save My Preview';
  const defaultExportButtonLabel = exportButton ? exportButton.textContent.trim() : 'Download Preview';
  const loadingMessages = [
    'Reading your idea',
    'Shaping the hook',
    'Structuring the episode',
    'Packaging the preview',
  ];
  const urlParams = new URLSearchParams(window.location.search);
  const seedIdea = (urlParams.get('idea') || '').trim();

  let loadingTimer = null;
  let autoTriggered = false;
  let lastPayload = null;

  function stopLoadingMessages() {
    if (loadingTimer) {
      window.clearInterval(loadingTimer);
      loadingTimer = null;
    }
  }

  function setError(message) {
    if (!errorNode) {
      return;
    }

    if (message) {
      errorNode.hidden = false;
      errorNode.textContent = message;
      return;
    }

    errorNode.hidden = true;
    errorNode.textContent = '';
  }

  function setInlineStatus(node, message, isError) {
    if (!node) {
      return;
    }

    node.hidden = !message;
    node.textContent = message || '';
    node.classList.toggle('is-error', Boolean(isError));
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

    let index = 0;
    statusNode.hidden = false;
    statusNode.textContent = loadingMessages[index];
    stopLoadingMessages();
    loadingTimer = window.setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      statusNode.textContent = loadingMessages[index];
    }, 900);
  }

  function renderOutline(items) {
    if (!outlineNode) {
      return;
    }

    outlineNode.innerHTML = '';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      const marker = document.createElement('span');
      const content = document.createElement('span');

      marker.className = 'landing-preview-outline-marker';
      marker.textContent = String(index + 1).padStart(2, '0');
      content.textContent = item;

      li.appendChild(marker);
      li.appendChild(content);
      outlineNode.appendChild(li);
    });
  }

  function renderSimpleList(target, items, emptyMessage) {
    if (!target) {
      return;
    }

    target.innerHTML = '';

    if (!items.length) {
      const li = document.createElement('li');
      li.textContent = emptyMessage;
      target.appendChild(li);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      target.appendChild(li);
    });
  }

  function renderLaunchPack(launchPack, accessLevel) {
    if (!launchPackShell) {
      return;
    }

    const isUnlocked = accessLevel === 'full';

    renderSimpleList(
      launchPackTitles,
      Array.isArray(launchPack?.titles) ? launchPack.titles : [],
      'Publish-ready title options appear here after generation.'
    );
    renderSimpleList(
      launchPackCaptions,
      Array.isArray(launchPack?.socialCaptions) ? launchPack.socialCaptions : [],
      'Caption options appear here once the full Launch Pack is unlocked.'
    );

    if (launchPackDescription) {
      launchPackDescription.textContent = launchPack?.description
        || 'A concise publish-ready description appears here once the Launch Pack is generated.';
    }

    if (launchPackShowNotes) {
      launchPackShowNotes.textContent = launchPack?.showNotes
        || 'Publish-ready show notes appear here once the full Launch Pack is unlocked.';
    }

    if (launchPackCtaScript) {
      launchPackCtaScript.textContent = launchPack?.cta
        || 'A host-read CTA script appears here once the full Launch Pack is unlocked.';
    }

    launchPackShell.classList.toggle('is-unlocked', isUnlocked);
    launchPackAccessShell?.classList.toggle('is-unlocked', isUnlocked);
    launchPackBadges?.forEach((badge) => {
      badge.textContent = isUnlocked ? 'Unlocked' : 'Locked';
    });
    launchPackLocks?.forEach((overlay) => {
      overlay.hidden = isUnlocked;
    });
  }

  function showResult(payload) {
    if (!resultShell) {
      return;
    }

    lastPayload = {
      title: payload.title || '',
      hook: payload.hook || '',
      outline: Array.isArray(payload.outline) ? payload.outline : [],
      cta: payload.cta || '',
      idea: textarea ? textarea.value.trim() : '',
      launchPackTitles: Array.isArray(payload.launchPack?.titles) ? payload.launchPack.titles : [],
      launchPackDescription: payload.launchPack?.description || '',
    };

    if (titleNode) {
      titleNode.textContent = payload.title || 'Ready-to-record episode preview';
    }

    if (hookNode) {
      hookNode.textContent = payload.hook || '';
    }

    if (ctaNode) {
      ctaNode.textContent = payload.cta || '';
    }

    renderOutline(Array.isArray(payload.outline) ? payload.outline : []);
    renderLaunchPack(payload.launchPack || {}, payload.launchPackAccess || 'preview');

    resultShell.hidden = false;
    window.requestAnimationFrame(() => {
      resultShell.classList.add('is-visible');
    });

    resultShell.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  function setSaveLoading(isLoading) {
    if (!saveForm) {
      return;
    }

    saveSubmitButton.disabled = isLoading;
    saveSubmitButton.textContent = isLoading ? 'Saving...' : defaultSaveButtonLabel;
  }

  function setExportLoading(isLoading) {
    if (!exportButton) {
      return;
    }

    exportButton.disabled = isLoading;
    exportButton.textContent = isLoading ? 'Preparing...' : defaultExportButtonLabel;
  }

  function parseDownloadFilename(response, fallback) {
    var header = response.headers.get('content-disposition') || '';
    var match = header.match(/filename=\"?([^\";]+)\"?/i);
    return match && match[1] ? match[1] : fallback;
  }

  function triggerBrowserDownload(blob, filename) {
    var objectUrl = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function cleanupUrl() {
      window.URL.revokeObjectURL(objectUrl);
    }, 0);
  }

  async function handleSavePreview(event) {
    event.preventDefault();

    if (!lastPayload) {
      setInlineStatus(saveStatusNode, 'Generate a preview first.', true);
      return;
    }

    if (!saveEmailInput || !saveEmailInput.value.trim()) {
      setInlineStatus(saveStatusNode, 'Enter your email to save this preview.', true);
      saveEmailInput?.focus();
      return;
    }

    setInlineStatus(saveStatusNode, '');
    setSaveLoading(true);

    try {
      const response = await fetch('/api/public/save-preview', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'episode_preview',
          email: saveEmailInput.value.trim(),
          payload: lastPayload,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save preview right now.');
      }

      setInlineStatus(saveStatusNode, payload.message || 'Preview saved. Check your inbox.');
    } catch (error) {
      setInlineStatus(saveStatusNode, error.message || 'Unable to save preview right now.', true);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleExportPreview() {
    if (!lastPayload) {
      setInlineStatus(exportStatusNode, 'Generate a preview first.', true);
      return;
    }

    setInlineStatus(exportStatusNode, '');
    setExportLoading(true);

    try {
      const response = await fetch('/api/public/export-preview', {
        method: 'POST',
        headers: {
          Accept: 'text/plain',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'episode_preview',
          payload: lastPayload,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to export preview right now.');
      }

      const blob = await response.blob();
      const filename = parseDownloadFilename(response, 'vicpods-episode-preview.txt');
      triggerBrowserDownload(blob, filename);
      setInlineStatus(exportStatusNode, 'Preview downloaded.');
    } catch (error) {
      setInlineStatus(exportStatusNode, error.message || 'Unable to export preview right now.', true);
    } finally {
      setExportLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const idea = textarea ? textarea.value.trim() : '';
    if (!idea) {
      setError('Paste a podcast idea to generate the preview.');
      textarea?.focus();
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea,
          language: document.documentElement.getAttribute('lang') || 'en',
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to generate preview right now.');
      }

      showResult(payload);
    } catch (error) {
      setError(error.message || 'Unable to generate preview right now.');
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', handleSubmit);
  saveForm?.addEventListener('submit', handleSavePreview);
  exportButton?.addEventListener('click', handleExportPreview);

  if (seedIdea && textarea && !textarea.value.trim() && !autoTriggered) {
    autoTriggered = true;
    textarea.value = seedIdea;
    window.requestAnimationFrame(() => {
      handleSubmit(new Event('submit'));
    });
  }
})();
