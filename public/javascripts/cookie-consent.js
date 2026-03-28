function updateCookieConsentStatus() {
  const panel = document.querySelector('[data-cookie-consent-panel]');
  if (!panel) {
    return;
  }

  const summary = panel.querySelector('[data-cookie-consent-summary]');
  const consent = window.Cookiebot && window.Cookiebot.consent ? window.Cookiebot.consent : null;

  const categories = ['preferences', 'statistics', 'marketing'];
  categories.forEach((category) => {
    const stateNode = panel.querySelector(`[data-cookie-category-state="${category}"]`);
    const card = panel.querySelector(`[data-cookie-category="${category}"]`);
    if (!stateNode || !card) {
      return;
    }

    if (!consent) {
      stateNode.textContent = 'Unavailable';
      card.classList.remove('is-active', 'is-inactive');
      return;
    }

    const enabled = Boolean(consent[category]);
    stateNode.textContent = enabled ? 'Allowed' : 'Off';
    card.classList.toggle('is-active', enabled);
    card.classList.toggle('is-inactive', !enabled);
  });

  if (!summary) {
    return;
  }

  if (!window.Cookiebot) {
    summary.textContent = 'Consent manager is not available yet. Refresh the page or use the banner when it appears.';
    return;
  }

  if (!consent) {
    summary.textContent = 'Consent state is not available yet. Open the consent manager to review your choices.';
    return;
  }

  const enabledCategories = categories.filter((category) => consent[category]);
  summary.textContent = enabledCategories.length
    ? `Optional consent is currently enabled for: ${enabledCategories.join(', ')}.`
    : 'Only necessary storage is currently active.';
}

function attachCookiebotActions() {
  const actionButtons = document.querySelectorAll('[data-cookiebot-action]');
  if (!actionButtons.length) {
    return;
  }

  actionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = String(button.getAttribute('data-cookiebot-action') || '').trim();
      if (!window.Cookiebot) {
        updateCookieConsentStatus();
        return;
      }

      if (action === 'renew' && typeof window.Cookiebot.renew === 'function') {
        window.Cookiebot.renew();
      }

      if (action === 'withdraw' && typeof window.Cookiebot.withdraw === 'function') {
        window.Cookiebot.withdraw();
      }

      window.setTimeout(updateCookieConsentStatus, 500);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachCookiebotActions();
  updateCookieConsentStatus();
});

window.addEventListener('CookiebotOnConsentReady', updateCookieConsentStatus);
window.addEventListener('CookiebotOnAccept', updateCookieConsentStatus);
window.addEventListener('CookiebotOnDecline', updateCookieConsentStatus);
