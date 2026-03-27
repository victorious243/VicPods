(function initEpisodeTools() {
  var triggers = document.querySelectorAll('[data-copy-trigger]');

  if (!triggers.length) {
    return;
  }

  function getSourceValue(key) {
    var source = document.querySelector('[data-copy-source="' + key + '"]');
    if (!source) {
      return '';
    }

    if (typeof source.value === 'string') {
      return source.value;
    }

    return source.textContent || '';
  }

  function setTemporaryLabel(button, nextLabel) {
    var defaultLabel = button.getAttribute('data-copy-label') || button.textContent;
    button.textContent = nextLabel;
    window.setTimeout(function resetLabel() {
      button.textContent = defaultLabel;
    }, 1800);
  }

  function notifyCopyCompleted(button) {
    var endpoint = button.getAttribute('data-copy-complete-endpoint');
    if (!endpoint) {
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    }).catch(function noop() {});
  }

  function fallbackCopy(text) {
    var helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', 'readonly');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    document.execCommand('copy');
    document.body.removeChild(helper);
  }

  triggers.forEach(function bindCopyTrigger(button) {
    button.addEventListener('click', function handleCopy() {
      var key = button.getAttribute('data-copy-trigger');
      var text = getSourceValue(key).trim();

      if (!text) {
        setTemporaryLabel(button, 'Nothing to copy');
        return;
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(function onCopied() {
            notifyCopyCompleted(button);
            setTemporaryLabel(button, 'Copied');
          })
          .catch(function onClipboardError() {
            fallbackCopy(text);
            notifyCopyCompleted(button);
            setTemporaryLabel(button, 'Copied');
          });
        return;
      }

      fallbackCopy(text);
      notifyCopyCompleted(button);
      setTemporaryLabel(button, 'Copied');
    });
  });
}());
