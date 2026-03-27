const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./emailService');

const EMAIL_LOGO_CID = 'vicpods-logo@vicpods.app';
const EMAIL_LOGO_PATH = path.resolve(__dirname, '../../public/images/logo/vicpods-logo-horizontal-dark.png');

function normalizeAppUrl(appUrl) {
  const fallbackUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  return String(appUrl || fallbackUrl)
    .trim()
    .replace(/\/+$/, '');
}

function buildEmailLogoAttachment() {
  if (!fs.existsSync(EMAIL_LOGO_PATH)) {
    return null;
  }

  return {
    filename: 'vicpods-logo-horizontal-dark.png',
    path: EMAIL_LOGO_PATH,
    cid: EMAIL_LOGO_CID,
    contentDisposition: 'inline',
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pluralize(value, singular, plural) {
  return Number(value) === 1 ? singular : plural;
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function formatHook(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110);
}

function buildWeeklyHighlights({
  weeklyEpisodes,
  weeklyIdeas,
  weeklyReady,
  totalSeries,
  totalEpisodes,
  totalIdeas,
}) {
  const lines = [];

  if (weeklyEpisodes > 0) {
    lines.push(`You created ${weeklyEpisodes} ${pluralize(weeklyEpisodes, 'episode', 'episodes')} this week.`);
  }

  if (weeklyIdeas > 0) {
    lines.push(`You saved ${weeklyIdeas} new ${pluralize(weeklyIdeas, 'idea', 'ideas')} in Pantry.`);
  }

  if (weeklyReady > 0) {
    lines.push(`${weeklyReady} ${pluralize(weeklyReady, 'episode is', 'episodes are')} now marked Ready.`);
  }

  if (lines.length > 0) {
    return lines;
  }

  if (totalEpisodes > 0 || totalIdeas > 0 || totalSeries > 0) {
    return [
      `Your Studio currently holds ${totalSeries} ${pluralize(totalSeries, 'series', 'series')}, ${totalEpisodes} ${pluralize(totalEpisodes, 'episode', 'episodes')}, and ${totalIdeas} ${pluralize(totalIdeas, 'idea', 'ideas')}.`,
      'Everything is still there when you want to step back in and keep building.',
    ];
  }

  return [
    'This week is quiet so far, which makes it a clean moment to start your next episode.',
    'Use Studio to shape the next idea, draft, or series move in one place.',
  ];
}

function buildRecentActivityItems({ recentEpisodes = [], recentIdeas = [] }) {
  const episodeItems = recentEpisodes
    .slice(0, 3)
    .map((episode) => {
      const title = formatHook(episode.title) || 'Untitled episode';
      const status = String(episode.status || '').trim();
      return {
        label: 'Episode',
        title,
        meta: status ? `Status: ${status}` : '',
      };
    });

  const ideaItems = recentIdeas
    .slice(0, 3)
    .map((idea) => {
      const hook = formatHook(idea.hook) || 'Idea saved in Pantry';
      const tag = String(idea.tag || '').trim();
      return {
        label: 'Idea',
        title: hook,
        meta: tag ? `Tag: ${tag}` : '',
      };
    });

  const items = [...episodeItems, ...ideaItems].slice(0, 4);

  if (items.length > 0) {
    return items;
  }

  return [
    {
      label: 'Studio',
      title: 'No new activity yet this week',
      meta: 'Open Studio to create your next episode or save a new idea.',
    },
  ];
}

function buildWeeklySummaryEmail({
  name,
  appUrl,
  weeklyEpisodes = 0,
  weeklyIdeas = 0,
  weeklyReady = 0,
  totalSeries = 0,
  totalEpisodes = 0,
  totalIdeas = 0,
  recentEpisodes = [],
  recentIdeas = [],
  weekLabel = 'This week',
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const studioUrl = `${normalizedAppUrl}/studio`;
  const summary = {
    weeklyEpisodes: normalizeCount(weeklyEpisodes),
    weeklyIdeas: normalizeCount(weeklyIdeas),
    weeklyReady: normalizeCount(weeklyReady),
    totalSeries: normalizeCount(totalSeries),
    totalEpisodes: normalizeCount(totalEpisodes),
    totalIdeas: normalizeCount(totalIdeas),
  };
  const highlightLines = buildWeeklyHighlights(summary);
  const activityItems = buildRecentActivityItems({ recentEpisodes, recentIdeas });
  const safeWeekLabel = String(weekLabel || 'This week').trim() || 'This week';
  const subject = 'Your weekly VicPods summary';
  const previewText = 'A quick look at your podcast progress inside VicPods.';

  const text = [
    `Hi ${safeName},`,
    '',
    `${safeWeekLabel} in VicPods:`,
    `- Episodes created: ${summary.weeklyEpisodes}`,
    `- Ideas saved: ${summary.weeklyIdeas}`,
    `- Ready episodes: ${summary.weeklyReady}`,
    '',
    'Highlights:',
    ...highlightLines.map((line) => `- ${line}`),
    '',
    'Recent activity:',
    ...activityItems.map((item) => `- ${item.label}: ${item.title}${item.meta ? ` (${item.meta})` : ''}`),
    '',
    `Open Studio: ${studioUrl}`,
    '',
    'VicPods Team',
    'Your voice deserves structure.',
  ].filter((line) => line !== null && line !== undefined).join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="display:inline-block; margin:0 auto 20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Weekly summary
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  ${escapeHtml(safeWeekLabel)} in VicPods
                </h1>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml}, here is a quick look at your progress inside VicPods.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td width="33.33%" style="padding:0 8px 0 0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                        <tr>
                          <td style="padding:20px 18px;">
                            <p style="margin:0 0 6px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                              Episodes
                            </p>
                            <p style="margin:0; font-size:28px; line-height:1.1; font-weight:700; color:#0f172a;">
                              ${summary.weeklyEpisodes}
                            </p>
                            <p style="margin:8px 0 0; font-size:13px; line-height:1.6; color:#64748b;">
                              created this week
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="33.33%" style="padding:0 4px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                        <tr>
                          <td style="padding:20px 18px;">
                            <p style="margin:0 0 6px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                              Ideas
                            </p>
                            <p style="margin:0; font-size:28px; line-height:1.1; font-weight:700; color:#0f172a;">
                              ${summary.weeklyIdeas}
                            </p>
                            <p style="margin:8px 0 0; font-size:13px; line-height:1.6; color:#64748b;">
                              saved this week
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="33.33%" style="padding:0 0 0 8px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                        <tr>
                          <td style="padding:20px 18px;">
                            <p style="margin:0 0 6px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                              Ready
                            </p>
                            <p style="margin:0; font-size:28px; line-height:1.1; font-weight:700; color:#0f172a;">
                              ${summary.weeklyReady}
                            </p>
                            <p style="margin:8px 0 0; font-size:13px; line-height:1.6; color:#64748b;">
                              ready episodes
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Highlights
                      </p>
                      ${highlightLines.map((line) => `
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        ${escapeHtml(line)}
                      </p>
                      `).join('')}
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Recent activity
                      </p>
                      ${activityItems.map((item) => `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                        <tr>
                          <td style="padding:14px 16px;">
                            <p style="margin:0 0 4px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#64748b;">
                              ${escapeHtml(item.label)}
                            </p>
                            <p style="margin:0 0 4px; font-size:15px; line-height:1.6; color:#0f172a; font-weight:600;">
                              ${escapeHtml(item.title)}
                            </p>
                            ${item.meta ? `
                            <p style="margin:0; font-size:13px; line-height:1.6; color:#64748b;">
                              ${escapeHtml(item.meta)}
                            </p>
                            ` : ''}
                          </td>
                        </tr>
                      </table>
                      `).join('')}
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Open Studio
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b; text-align:center;">
                      VicPods helps creators keep momentum from first idea to finished episode.
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px; line-height:1.7; color:#94a3b8; text-align:center;">
                      Your voice deserves structure.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return { subject, text, html };
}

async function sendWeeklySummaryEmail(input) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildWeeklySummaryEmail({
    ...input,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  return sendEmail({
    to: input.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}

module.exports = {
  buildWeeklySummaryEmail,
  sendWeeklySummaryEmail,
};
