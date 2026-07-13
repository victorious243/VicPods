const LANDING_PATH_COOKIE_NAME = 'vicpods_lp';
const LANDING_PATH_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

const SEARCH_ENGINE_REGEX = /(google\.[^/]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|ecosia\.org|yandex\.[^/]+)/i;
const SEO_CONTENT_PATH_REGEX = /^(\/$|\/podcast-idea-generator$|\/examples$|\/about$|\/help$|\/guides$|\/guides\/[^/]+$|\/terms$|\/privacy-policy$|\/cookie-policy$|\/data-rights$)/;

function normalizePath(pathname = '') {
  const value = String(pathname || '').split('?')[0].trim();
  return value || '/';
}

function isSeoAttributablePath(pathname = '') {
  const path = normalizePath(pathname);

  if (path === '/' || path === '/podcast-idea-generator' || path === '/examples' || path === '/about' || path === '/help' || path === '/guides' || path === '/terms' || path === '/privacy-policy' || path === '/cookie-policy' || path === '/data-rights') {
    return true;
  }

  if (path === '/generate-episode' || path === '/lab') {
    return true;
  }

  return path.startsWith('/guides/');
}

function setLandingPathCookie(req, res) {
  const pathname = normalizePath(req.path || req.originalUrl || '/');
  if (!isSeoAttributablePath(pathname)) {
    return;
  }

  res.cookie(LANDING_PATH_COOKIE_NAME, pathname, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: LANDING_PATH_COOKIE_MAX_AGE_MS,
  });
}

function getLandingPathFromRequest(req) {
  const cookiePath = normalizePath(req.cookies?.[LANDING_PATH_COOKIE_NAME] || '');
  if (isSeoAttributablePath(cookiePath)) {
    return cookiePath;
  }

  const currentPath = normalizePath(req.path || req.originalUrl || '/');
  if (isSeoAttributablePath(currentPath)) {
    return currentPath;
  }

  return '';
}

function isSearchEngineReferer(value = '') {
  return SEARCH_ENGINE_REGEX.test(String(value || '').trim());
}

module.exports = {
  LANDING_PATH_COOKIE_NAME,
  SEO_CONTENT_PATH_REGEX,
  SEARCH_ENGINE_REGEX,
  getLandingPathFromRequest,
  isSearchEngineReferer,
  isSeoAttributablePath,
  setLandingPathCookie,
};
