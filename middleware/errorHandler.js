const { renderPage } = require('../utils/render');
const { translateUserMessage } = require('../services/i18n/languageService');

function notFoundHandler(req, res, next) {
  const error = new Error('Page not found');
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;
  const localizedMessage = translateUserMessage(
    err.message || req.t('error.defaultMessage', 'Something went wrong.'),
    req.language
  );

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(statusCode).json({
      error: localizedMessage || req.t('error.defaultMessage', 'Something went wrong.'),
    });
  }

  res.status(statusCode);
  return renderPage(res, {
    title: `Error ${statusCode}`,
    pageTitle: statusCode === 404
      ? req.t('error.notFoundTitle', 'Not Found')
      : req.t('error.unexpectedTitle', 'Unexpected Error'),
    subtitle: localizedMessage || req.t('error.defaultMessage', 'Something went wrong.'),
    view: 'error',
    authPage: !req.currentUser,
    data: {
      errorCode: statusCode,
      errorStack: process.env.NODE_ENV === 'development' ? err.stack : null,
    },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
