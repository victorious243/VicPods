(function initCreateUi() {
  var suggestButton = document.querySelector('[data-suggest-themes]');
  var themeTarget = document.querySelector('[data-theme-target]');
  var form = document.querySelector('#series-create-form');

  if (suggestButton && themeTarget && form) {
    suggestButton.addEventListener('click', function () {
      var payload = new URLSearchParams();
      var nameInput = form.querySelector('input[name="name"]');
      var goalInput = form.querySelector('input[name="goal"]');
      var intentInput = form.querySelector('select[name="intent"]');

      payload.set('name', nameInput ? nameInput.value : '');
      payload.set('goal', goalInput ? goalInput.value : '');
      payload.set('intent', intentInput ? intentInput.value : 'educate');

      fetch('/create/series/suggest-themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      })
        .then(function (res) {
          if (!res.ok) {
            throw new Error('Unable to suggest themes right now.');
          }
          return res.json();
        })
        .then(function (data) {
          if (Array.isArray(data.suggestions) && data.suggestions.length) {
            themeTarget.value = data.suggestions.join('\n');
          }
        })
        .catch(function () {
          suggestButton.textContent = 'Suggestions unavailable';
        });
    });
  }
}());
