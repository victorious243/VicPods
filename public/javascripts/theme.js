(function themeController() {
  var STORAGE_KEY = 'vicpods_theme';
  var root = document.documentElement;
  var LANGUAGE_COPY = {
    en: {
      dark: 'Dark',
      light: 'Light',
      switchToLight: 'Switch to light mode',
      switchToDark: 'Switch to dark mode',
    },
    es: {
      dark: 'Oscuro',
      light: 'Claro',
      switchToLight: 'Cambiar a modo claro',
      switchToDark: 'Cambiar a modo oscuro',
    },
    pt: {
      dark: 'Escuro',
      light: 'Claro',
      switchToLight: 'Mudar para modo claro',
      switchToDark: 'Mudar para modo escuro',
    },
  };

  function resolveLanguageCopy() {
    var lang = String(root.getAttribute('lang') || 'en').toLowerCase().slice(0, 2);
    return LANGUAGE_COPY[lang] || LANGUAGE_COPY.en;
  }

  function resolveTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch (error) {
      // no-op if storage is unavailable
    }
    return root.getAttribute('data-theme') || 'dark';
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // no-op if storage is unavailable
    }
  }

  function updateToggle(theme) {
    var button = document.getElementById('theme-toggle');
    if (!button) {
      return;
    }

    var icon = button.querySelector('.theme-toggle-icon');
    var label = button.querySelector('.theme-toggle-label');
    var isDark = theme === 'dark';
    var copy = resolveLanguageCopy();

    if (icon) {
      icon.textContent = isDark ? '🌙' : '☀️';
    }
    if (label) {
      label.textContent = isDark ? copy.dark : copy.light;
    }

    button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    button.setAttribute('title', isDark ? copy.switchToLight : copy.switchToDark);
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    updateToggle(theme);
  }

  function toggleTheme() {
    var current = root.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    persistTheme(next);
  }

  document.addEventListener('DOMContentLoaded', function onLoad() {
    var theme = resolveTheme();
    applyTheme(theme);

    var button = document.getElementById('theme-toggle');
    if (button) {
      button.addEventListener('click', toggleTheme);
    }
  });
}());
