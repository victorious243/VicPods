const crypto = require('crypto');
const { AppError } = require('../utils/errors');

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdminDashboardAccess(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    return next(new AppError('Page not found', 404));
  }

  const configuredSecret = String(process.env.ADMIN_DASHBOARD_KEY || '').trim();

  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      return next(new AppError('Page not found', 404));
    }

    res.set('Cache-Control', 'no-store');
    return next();
  }

  const providedSecret = String(req.query.key || req.get('x-admin-key') || '').trim();
  if (!providedSecret || !constantTimeEquals(providedSecret, configuredSecret)) {
    return next(new AppError('Page not found', 404));
  }

  res.set('Cache-Control', 'no-store');
  return next();
}

module.exports = {
  requireAdminDashboardAccess,
};
