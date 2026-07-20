const { sendEmail } = require('./emailService');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPodcastPerformanceEmail({ name, appUrl, analytics }) {
  const safeName = String(name || 'there').trim() || 'there';
  const studioAnalyticsUrl = String(appUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '') + '/studio/analytics';
  const totals = analytics?.totals || {};
  const topEpisodes = analytics?.topEpisodes || [];
  const recommendations = analytics?.recommendations || [];
  const subject = 'Your VicPods podcast performance report';

  const text = [
    'Hi ' + safeName + ',',
    '',
    'Your podcast performance:',
    '- Downloads: ' + (totals.audioDownloads || 0),
    '- Plays: ' + (totals.playerPlays || 0),
    '- Completions: ' + (totals.playerCompletions || 0),
    '- Shares: ' + (totals.shareClicks || 0),
    '',
    'Top episodes:',
    ...(topEpisodes.length ? topEpisodes.slice(0, 3).map((episode) => '- ' + episode.title + ': ' + episode.audioDownloads + ' downloads, ' + episode.playerPlays + ' plays') : ['- No analytics yet.']),
    '',
    'Recommended next moves:',
    ...(recommendations.length ? recommendations.slice(0, 3).map((item) => '- ' + item.title + ': ' + item.body) : ['- Publish and share an episode to unlock recommendations.']),
    '',
    'Open analytics: ' + studioAnalyticsUrl,
  ].join('\n');

  const metricCards = [
    ['Downloads', totals.audioDownloads || 0],
    ['Plays', totals.playerPlays || 0],
    ['Completions', totals.playerCompletions || 0],
    ['Shares', totals.shareClicks || 0],
  ].map(([label, value]) => (
    '<div style="border:1px solid #e2e8f0; border-radius:14px; padding:14px;">'
    + '<strong style="display:block; font-size:24px;">' + value + '</strong>'
    + '<span style="color:#64748b; font-size:13px;">' + escapeHtml(label) + '</span>'
    + '</div>'
  )).join('');
  const episodeItems = (topEpisodes.length ? topEpisodes.slice(0, 3) : [{ title: 'No analytics yet', audioDownloads: 0, playerPlays: 0 }])
    .map((episode) => '<li>' + escapeHtml(episode.title) + ': ' + (episode.audioDownloads || 0) + ' downloads, ' + (episode.playerPlays || 0) + ' plays</li>')
    .join('');
  const recommendationItems = (recommendations.length ? recommendations.slice(0, 3) : [{ title: 'Publish and share an episode', body: 'VicPods will turn listener activity into recommendations.' }])
    .map((item) => '<li><strong>' + escapeHtml(item.title) + '</strong>: ' + escapeHtml(item.body) + '</li>')
    .join('');
  const html = [
    "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; max-width:640px; margin:0 auto; padding:28px; color:#0f172a;\">",
    '<p style="margin:0 0 10px; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;">VicPods analytics</p>',
    '<h1 style="margin:0 0 16px; font-size:30px; line-height:1.15;">Your podcast performance report</h1>',
    '<p style="margin:0 0 24px; color:#334155; line-height:1.6;">Hi ' + escapeHtml(safeName) + ', here is what happened after publishing.</p>',
    '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin:0 0 24px;">' + metricCards + '</div>',
    '<h2 style="font-size:18px;">Top episodes</h2>',
    '<ul>' + episodeItems + '</ul>',
    '<h2 style="font-size:18px;">Next moves</h2>',
    '<ul>' + recommendationItems + '</ul>',
    '<p><a href="' + escapeHtml(studioAnalyticsUrl) + '" style="color:#4f46e5; font-weight:700;">Open analytics in VicPods</a></p>',
    '</div>',
  ].join('');

  return { subject, text, html };
}

async function sendPodcastPerformanceEmail({ user, analytics, appUrl }) {
  if (!user?.email) {
    return { delivered: false, skipped: true };
  }

  const email = buildPodcastPerformanceEmail({
    name: user.name,
    appUrl,
    analytics,
  });

  return sendEmail({
    to: user.email,
    ...email,
  });
}

module.exports = {
  buildPodcastPerformanceEmail,
  sendPodcastPerformanceEmail,
};
