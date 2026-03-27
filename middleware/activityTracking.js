const crypto = require('crypto');
const { recordActivityEvent } = require('../services/analytics/appActivityService');

const VISITOR_COOKIE_NAME = 'vicpods_vid';
const VISITOR_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 90;

function createVisitorId() {
  return crypto.randomUUID().replace(/-/g, '');
}

function ensureVisitorId(req, res, next) {
  let visitorId = String(req.cookies?.[VISITOR_COOKIE_NAME] || '').trim();

  if (!visitorId) {
    visitorId = createVisitorId();
    res.cookie(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: VISITOR_COOKIE_MAX_AGE_MS,
    });
  }

  req.visitorId = visitorId;
  res.locals.visitorId = visitorId;
  return next();
}

function shouldTrackPageView(req, res) {
  if (req.method !== 'GET') {
    return false;
  }

  if (req.path.startsWith('/api') || req.path.startsWith('/webhooks')) {
    return false;
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    return false;
  }

  const contentType = String(res.getHeader('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html')) {
    return false;
  }

  return true;
}

function trackPageViews(req, res, next) {
  res.once('finish', () => {
    if (!shouldTrackPageView(req, res)) {
      return;
    }

    void recordActivityEvent(req, {
      eventType: 'page_view',
      statusCode: res.statusCode,
    });
  });

  return next();
}

module.exports = {
  ensureVisitorId,
  trackPageViews,
};
