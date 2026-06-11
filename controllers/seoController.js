const {
  buildAbsoluteUrl,
  getIndexablePublicPages,
  normalizeAppUrl,
} = require('../services/seo/siteSeoService');

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeAdminDashboardPath() {
  const configuredPath = String(process.env.ADMIN_DASHBOARD_PATH || '/control-room-ops').trim();
  return configuredPath.startsWith('/') ? configuredPath : '/control-room-ops';
}

function showRobotsTxt(req, res) {
  const adminDashboardPath = normalizeAdminDashboardPath();
  const appUrl = normalizeAppUrl();

  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /auth/',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /verify',
    'Disallow: /forgot-password',
    'Disallow: /reset-password',
    'Disallow: /api/',
    'Disallow: /ai/',
    'Disallow: /billing/',
    'Disallow: /studio/',
    'Disallow: /dashboard',
    'Disallow: /create/',
    'Disallow: /kitchen/',
    'Disallow: /pantry/',
    'Disallow: /settings/',
    'Disallow: /account',
    'Disallow: /onboarding/',
    'Disallow: /share/',
    'Disallow: /webhooks/',
    'Disallow: /feedback/',
    'Disallow: /oauth2callback',
    'Disallow: /lab',
  ];

  if (adminDashboardPath) {
    lines.push(`Disallow: ${adminDashboardPath}`);
  }

  if (appUrl) {
    lines.push(`Host: ${appUrl.replace(/^https?:\/\//i, '')}`);
    lines.push(`Sitemap: ${appUrl}/sitemap.xml`);
  }

  res.type('text/plain').send(`${lines.join('\n')}\n`);
}

function showSitemapXml(req, res) {
  const pages = getIndexablePublicPages();
  const urls = pages.map((page) => [
    '  <url>',
    `    <loc>${escapeXml(buildAbsoluteUrl(page.path))}</loc>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  res.type('application/xml').send(xml);
}

module.exports = {
  showRobotsTxt,
  showSitemapXml,
};
