const AdminAccessLog = require('../../models/AdminAccessLog');

function pickKeySource(req) {
  if (String(req.query?.key || '').trim()) {
    return 'query';
  }

  if (String(req.get('x-admin-key') || '').trim()) {
    return 'header';
  }

  return 'none';
}

function normalizePath(req) {
  const path = `${String(req.baseUrl || '')}${String(req.path || '')}`.trim();
  if (path) {
    return path;
  }

  return String(req.originalUrl || req.url || '/').split('?')[0].trim() || '/';
}

function resolveIpAddress(req) {
  const forwardedFor = String(req.get('x-forwarded-for') || '').split(',')[0].trim();
  const realIp = String(req.get('x-real-ip') || '').trim();
  return forwardedFor || realIp || String(req.ip || '').trim();
}

async function recordAdminAccess(req, outcome) {
  try {
    const keySource = pickKeySource(req);
    await AdminAccessLog.create({
      outcome,
      requestPath: normalizePath(req),
      method: String(req.method || 'GET').toUpperCase(),
      ipAddress: resolveIpAddress(req),
      forwardedFor: String(req.get('x-forwarded-for') || '').trim(),
      userAgent: String(req.get('user-agent') || '').trim(),
      referer: String(req.get('referer') || '').trim(),
      hasAdminKey: keySource !== 'none',
      keySource,
      userId: req.currentUser?._id || null,
      userEmail: String(req.currentUser?.email || '').trim().toLowerCase(),
      userRole: String(req.currentUser?.role || 'guest').trim().toLowerCase(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Admin access logging failed: ${error.message}`);
  }
}

module.exports = {
  recordAdminAccess,
};
