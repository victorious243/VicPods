const { translateUserMessage } = require('../services/i18n/languageService');

function flashMiddleware(req, res, next) {
  req.flash = (type, message) => {
    if (!req.session.flash) {
      req.session.flash = [];
    }

    req.session.flash.push({
      type,
      message,
    });
  };

  const language = req.language || 'en';
  res.locals.flashMessages = (req.session.flash || []).map((item) => ({
    ...item,
    message: translateUserMessage(item.message, language),
  }));
  delete req.session.flash;

  next();
}

module.exports = {
  flashMiddleware,
};
