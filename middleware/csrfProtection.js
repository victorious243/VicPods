const crypto = require('crypto');
const { AppError } = require('../utils/errors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_FIELD_NAME = '_csrf';
const CSRF_HEADER_NAMES = ['x-csrf-token', 'x-xsrf-token'];

function isApiRequest(req) {
  const path = String(req.originalUrl || req.path || '');
  return path === '/api' || path.startsWith('/api/');
}

function getAllowedOrigins(req) {
  const origins = new Set();

  if (process.env.APP_URL) {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch (_error) {
      // Ignore malformed APP_URL and fall back to request host.
    }
  }

  const requestHost = String(req.get('host') || '').trim();
  if (requestHost) {
    origins.add(`${req.protocol}://${requestHost}`);
  }

  return origins;
}

function ensureCsrfToken(req, res, next) {
  if (!req.session) {
    return next(new Error('Session middleware must be initialized before CSRF protection.'));
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  req.csrfToken = () => req.session.csrfToken;
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function readSubmittedToken(req) {
  if (req.body && typeof req.body === 'object') {
    const bodyToken = req.body[CSRF_FIELD_NAME];
    if (bodyToken) {
      return String(bodyToken);
    }
  }

  for (const headerName of CSRF_HEADER_NAMES) {
    const headerValue = req.get(headerName);
    if (headerValue) {
      return String(headerValue);
    }
  }

  return '';
}

function hasSameOriginHeaders(req) {
  const allowedOrigins = getAllowedOrigins(req);
  const origin = req.get('origin');
  const referer = req.get('referer');

  if (origin) {
    return allowedOrigins.has(origin);
  }

  if (referer) {
    return Array.from(allowedOrigins).some((allowedOrigin) => (
      referer.startsWith(`${allowedOrigin}/`) || referer === allowedOrigin
    ));
  }

  return false;
}

function verifyCsrfToken(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (isApiRequest(req)) {
    return next();
  }

  const submittedToken = readSubmittedToken(req);
  if (submittedToken && req.session && submittedToken === req.session.csrfToken) {
    return next();
  }

  if (hasSameOriginHeaders(req)) {
    return next();
  }

  return next(new AppError('Invalid CSRF token.', 403));
}

module.exports = {
  ensureCsrfToken,
  verifyCsrfToken,
  CSRF_FIELD_NAME,
};
