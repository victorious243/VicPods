const {
  normalizeLanguage,
  resolveLanguagePreference,
  getLanguageOptions,
  translate,
  getLocalizedNavItems,
} = require('../services/i18n/languageService');

function applyLanguageContext(req, res, next) {
  const userLanguage = resolveLanguagePreference(req.currentUser);
  const sessionLanguage = normalizeLanguage(req.session?.languagePreference);
  const language = req.currentUser ? userLanguage : sessionLanguage;

  if (req.session) {
    req.session.languagePreference = language;
  }

  req.language = language;
  req.t = (key, fallback) => translate(key, language, fallback);

  res.locals.language = language;
  res.locals.languageOptions = getLanguageOptions();
  res.locals.t = req.t;
  res.locals.navItems = getLocalizedNavItems(language);

  return next();
}

module.exports = {
  applyLanguageContext,
};
