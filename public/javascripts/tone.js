(function initToneUi() {
  function bindRangeOutputs() {
    var ranges = document.querySelectorAll('[data-range-source]');
    ranges.forEach(function (range) {
      var id = range.getAttribute('data-range-source');
      var target = document.querySelector('[data-range-value="' + id + '"]');
      if (!target) {
        return;
      }

      function sync() {
        target.textContent = String(range.value || '');
      }

      range.addEventListener('input', sync);
      sync();
    });
  }

  function bindOverrideToggle() {
    var toggle = document.querySelector('[data-tone-override-toggle]');
    var fields = document.querySelector('[data-tone-override-fields]');
    if (!toggle || !fields) {
      return;
    }

    function sync() {
      fields.style.display = toggle.checked ? 'grid' : 'none';
      var inputs = fields.querySelectorAll('input, select, textarea');
      inputs.forEach(function (element) {
        if (toggle.checked) {
          element.removeAttribute('disabled');
        } else {
          element.setAttribute('disabled', 'disabled');
        }
      });
    }

    toggle.addEventListener('change', sync);
    sync();
  }

  function bindCharCounters() {
    var counters = document.querySelectorAll('[data-char-count]');
    counters.forEach(function (input) {
      var key = input.getAttribute('data-char-count');
      var label = document.querySelector('[data-char-count-label="' + key + '"]');
      if (!label) {
        return;
      }

      function sync() {
        label.textContent = String((input.value || '').length);
      }

      input.addEventListener('input', sync);
      sync();
    });
  }

  bindRangeOutputs();
  bindOverrideToggle();
  bindCharCounters();
}());
