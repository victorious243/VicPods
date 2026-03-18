(function settingsController() {
  function syncThemePreferenceForm() {
    var form = document.getElementById('appearance-form');
    var select = document.getElementById('theme-preference-select');
    var languageSelect = document.getElementById('language-preference-select');
    if (!form || !select) {
      return;
    }

    form.addEventListener('submit', function onSubmit() {
      var value = select.value === 'light' ? 'light' : 'dark';
      try {
        localStorage.setItem('vicpods_theme', value);
      } catch (error) {
        // no-op
      }
      document.documentElement.setAttribute('data-theme', value);

      if (languageSelect) {
        var languageValue = languageSelect.value === 'es' || languageSelect.value === 'pt'
          ? languageSelect.value
          : 'en';
        try {
          localStorage.setItem('vicpods_language', languageValue);
        } catch (error) {
          // no-op
        }
        document.documentElement.setAttribute('lang', languageValue);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function onReady() {
    syncThemePreferenceForm();
  });
}());
