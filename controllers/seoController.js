const {
  getIndexablePublicPages,
  normalizeAppUrl,
} = require('../services/seo/siteSeoService');

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
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /ai/',
    'Disallow: /billing/',
    'Disallow: /studio/',
    'Disallow: /create/',
    'Disallow: /kitchen/',
    'Disallow: /pantry/',
    'Disallow: /settings/',
    'Disallow: /onboarding/',
    'Disallow: /generate-episode',
    'Disallow: /share/',
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
  const appUrl = normalizeAppUrl();
  const pages = getIndexablePublicPages();
  const urls = pages.map((page) => [
    '  <url>',
    `    <loc>${appUrl}${page.path}</loc>`,
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
