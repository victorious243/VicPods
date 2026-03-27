const AppActivityEvent = require('../../models/AppActivityEvent');

function normalizePath(req, explicitPath = '') {
  const provided = String(explicitPath || '').trim();
  if (provided) {
    return provided;
  }

  const original = String(req.originalUrl || req.url || '/').split('?')[0].trim();
  if (original) {
    return original;
  }

  const combined = `${String(req.baseUrl || '')}${String(req.path || '')}`.trim();
  return combined || '/';
}

function resolveIpAddress(req) {
  const forwardedFor = String(req.get('x-forwarded-for') || '').split(',')[0].trim();
  const realIp = String(req.get('x-real-ip') || '').trim();
  return forwardedFor || realIp || String(req.ip || '').trim();
}

function normalizeAuthProvider(user, provided) {
  const value = String(provided || user?.authProvider || '').trim().toLowerCase();
  if (value === 'google') {
    return 'google';
  }
  if (value === 'local' || value === 'email') {
    return 'local';
  }
  return 'unknown';
}

async function recordActivityEvent(req, options = {}) {
  try {
    const user = options.user || req.currentUser || null;
    await AppActivityEvent.create({
      eventType: String(options.eventType || '').trim(),
      visitorId: String(options.visitorId || req.visitorId || '').trim(),
      sessionId: String(options.sessionId || req.sessionID || '').trim(),
      requestPath: normalizePath(req, options.requestPath),
      method: String(options.method || req.method || 'GET').toUpperCase(),
      statusCode: Number.isInteger(options.statusCode) ? options.statusCode : null,
      ipAddress: resolveIpAddress(req),
      forwardedFor: String(req.get('x-forwarded-for') || '').trim(),
      userAgent: String(req.get('user-agent') || '').trim(),
      referer: String(req.get('referer') || '').trim(),
      userId: user?._id || options.userId || null,
      userEmail: String(options.userEmail || user?.email || '').trim().toLowerCase(),
      userRole: String(options.userRole || user?.role || 'guest').trim().toLowerCase(),
      authProvider: normalizeAuthProvider(user, options.authProvider),
      metadata: options.metadata || null,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`App activity logging failed: ${error.message}`);
  }
}

module.exports = {
  recordActivityEvent,
};
