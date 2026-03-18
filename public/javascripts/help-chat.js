(function initHelpChat() {
  var widget = document.getElementById('help-chat-widget');
  if (!widget) {
    return;
  }

  var toggle = document.getElementById('help-chat-toggle');
  var closeButton = document.getElementById('help-chat-close');
  var panel = document.getElementById('help-chat-panel');
  var form = document.getElementById('help-chat-form');
  var input = document.getElementById('help-chat-input');
  var messages = document.getElementById('help-chat-messages');
  var endpoint = widget.getAttribute('data-endpoint') || '/ai/help/chat';
  var loadingText = widget.getAttribute('data-loading-text') || 'VicPods Help is thinking...';
  var errorText = widget.getAttribute('data-error-text') || 'Help is unavailable right now. Please open the Help Center.';
  var pendingNode = null;

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }
  }

  function createMessage(role, text) {
    var article = document.createElement('article');
    article.className = 'help-chat-message help-chat-message-' + role;

    var paragraph = document.createElement('p');
    paragraph.textContent = text;
    article.appendChild(paragraph);

    return article;
  }

  function createMeta(response) {
    if ((!response.links || !response.links.length) && (!response.sources || !response.sources.length)) {
      return null;
    }

    var meta = document.createElement('div');
    meta.className = 'help-chat-meta';

    if (Array.isArray(response.sources) && response.sources.length) {
      var sources = document.createElement('span');
      sources.className = 'mini-note';
      sources.textContent = response.sources.join(' · ');
      meta.appendChild(sources);
    }

    if (Array.isArray(response.links) && response.links.length) {
      var linksWrap = document.createElement('div');
      linksWrap.className = 'help-chat-links';
      response.links.forEach(function (link) {
        var anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.textContent = link.label;
        linksWrap.appendChild(anchor);
      });
      meta.appendChild(linksWrap);
    }

    return meta;
  }

  function appendAssistantResponse(response) {
    var article = createMessage('assistant', response.answer || errorText);
    var meta = createMeta(response);
    if (meta) {
      article.appendChild(meta);
    }
    messages.appendChild(article);
    messages.scrollTop = messages.scrollHeight;
  }

  function setPending(enabled) {
    if (enabled) {
      pendingNode = createMessage('assistant', loadingText);
      pendingNode.classList.add('is-loading');
      messages.appendChild(pendingNode);
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    if (pendingNode && pendingNode.parentNode) {
      pendingNode.parentNode.removeChild(pendingNode);
    }
    pendingNode = null;
  }

  function submitPrompt(prompt) {
    var text = String(prompt || '').trim();
    if (!text) {
      return;
    }

    messages.appendChild(createMessage('user', text));
    messages.scrollTop = messages.scrollHeight;
    setPending(true);

    fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: text }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Request failed');
        }
        return response.json();
      })
      .then(function (data) {
        setPending(false);
        appendAssistantResponse(data || {});
      })
      .catch(function () {
        setPending(false);
        appendAssistantResponse({ answer: errorText, links: [{ href: '/help', label: 'Help Center' }] });
      });
  }

  toggle.addEventListener('click', function () {
    setOpen(panel.hidden);
  });

  closeButton.addEventListener('click', function () {
    setOpen(false);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var text = input.value;
    input.value = '';
    submitPrompt(text);
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  widget.querySelectorAll('[data-help-chat-prompt]').forEach(function (button) {
    button.addEventListener('click', function () {
      submitPrompt(button.getAttribute('data-help-chat-prompt'));
      setOpen(true);
    });
  });
}());
