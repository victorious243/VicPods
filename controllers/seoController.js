function normalizeAppUrl() {
  return String(process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
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
  }

  res.type('text/plain').send(`${lines.join('\n')}\n`);
}

module.exports = {
  showRobotsTxt,
};
