const crypto = require('crypto');
const { AppError } = require('../utils/errors');
const { recordAdminAccess } = require('../services/admin/adminAccessLogService');

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function requireAdminEntryAuth(req, res, next) {
  if (!req.currentUser) {
    await recordAdminAccess(req, 'denied_guest');
    return next(new AppError('Page not found', 404));
  }

  if (req.currentUser.emailVerified === false) {
    await recordAdminAccess(req, 'denied_unverified');
    return next(new AppError('Page not found', 404));
  }

  return next();
}

async function requireAdminDashboardAccess(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    await recordAdminAccess(req, 'denied_role');
    return next(new AppError('Page not found', 404));
  }

  const configuredSecret = String(process.env.ADMIN_DASHBOARD_KEY || '').trim();

  if (!configuredSecret) {
    if (process.env.NODE_ENV === 'production') {
      await recordAdminAccess(req, 'denied_config');
      return next(new AppError('Page not found', 404));
    }

    res.set('Cache-Control', 'no-store');
    await recordAdminAccess(req, 'granted_dev');
    return next();
  }

  const providedSecret = String(req.query.key || req.get('x-admin-key') || '').trim();
  if (!providedSecret || !constantTimeEquals(providedSecret, configuredSecret)) {
    await recordAdminAccess(req, 'denied_key');
    return next(new AppError('Page not found', 404));
  }

  res.set('Cache-Control', 'no-store');
  await recordAdminAccess(req, 'granted');
  return next();
}

module.exports = {
  requireAdminEntryAuth,
  requireAdminDashboardAccess,
};
