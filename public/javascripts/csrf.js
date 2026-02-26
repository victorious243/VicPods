(function csrfController() {
  function getToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? String(meta.getAttribute('content') || '') : '';
  }

  function isUnsafeMethod(method) {
    var value = String(method || 'GET').toUpperCase();
    return value !== 'GET' && value !== 'HEAD' && value !== 'OPTIONS';
  }

  function ensureFormTokens(token) {
    if (!token) {
      return;
    }

    var forms = document.querySelectorAll('form');
    forms.forEach(function (form) {
      var method = form.getAttribute('method') || 'GET';
      if (!isUnsafeMethod(method)) {
        return;
      }

      if (form.querySelector('input[name="_csrf"]')) {
        return;
      }

      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      input.value = token;
      form.appendChild(input);
    });
  }

  function patchFetch(token) {
    if (!token || typeof window.fetch !== 'function') {
      return;
    }

    var originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      var config = init ? Object.assign({}, init) : {};
      var method = String(config.method || 'GET').toUpperCase();

      if (!isUnsafeMethod(method)) {
        return originalFetch(input, config);
      }

      var requestUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var targetOrigin = requestUrl ? new URL(requestUrl, window.location.href).origin : window.location.origin;
      if (targetOrigin !== window.location.origin) {
        return originalFetch(input, config);
      }

      var headers = new Headers(config.headers || {});
      if (!headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', token);
      }
      config.headers = headers;

      return originalFetch(input, config);
    };
  }

  document.addEventListener('DOMContentLoaded', function onReady() {
    var token = getToken();
    ensureFormTokens(token);
    patchFetch(token);
  });
}());
