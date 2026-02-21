const { renderPage } = require('../utils/render');

function notFoundHandler(req, res, next) {
  const error = new Error('Page not found');
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = err.statusCode || 500;

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(statusCode).json({
      error: err.message || 'Something went wrong',
    });
  }

  res.status(statusCode);
  return renderPage(res, {
    title: `Error ${statusCode}`,
    pageTitle: statusCode === 404 ? 'Not Found' : 'Unexpected Error',
    subtitle: err.message || 'Something went wrong.',
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
