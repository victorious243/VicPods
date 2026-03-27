const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./emailService');
const { episodeEditorPath } = require('../../utils/paths');

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

function clampTitle(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function buildEpisodeUrl({ appUrl, episodeUrl, seriesId, themeId, episodeId }) {
  if (episodeUrl) {
    return String(episodeUrl).trim();
  }

  const normalizedAppUrl = normalizeAppUrl(appUrl);
  if (seriesId && themeId && episodeId) {
    return `${normalizedAppUrl}${episodeEditorPath({ seriesId, themeId, episodeId })}`;
  }

  return `${normalizedAppUrl}/kitchen`;
}

function buildGeneratedItems({
  hook,
  outlineCount,
  talkingPointsCount,
  transcriptReady,
  showNotesReady,
  scriptDoctorReady,
}) {
  const items = [];

  if (hook || outlineCount > 0 || talkingPointsCount > 0) {
    items.push('Structured draft with hook, outline, and talking points');
  }

  if (showNotesReady) {
    items.push('Show notes pack with summary and episode description');
  }

  if (transcriptReady) {
    items.push('Episode brief ready for review and export');
  }

  if (scriptDoctorReady) {
    items.push('Script quality feedback to help tighten the final pass');
  }

  if (items.length > 0) {
    return items;
  }

  return [
    'Structured episode draft ready for review',
    'Clear talking points and flow for recording prep',
    'A stronger starting point for your next publishing step',
  ];
}

function buildEpisodeReadyEmail({
  name,
  appUrl,
  episodeUrl,
  title,
  seriesName,
  themeName,
  generatedItems,
  hook,
  outlineCount,
  talkingPointsCount,
  transcriptReady,
  showNotesReady,
  scriptDoctorReady,
  seriesId,
  themeId,
  episodeId,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const safeTitle = clampTitle(title) || 'Your latest episode';
  const safeTitleHtml = escapeHtml(safeTitle);
  const safeSeriesName = String(seriesName || '').trim();
  const safeThemeName = String(themeName || '').trim();
  const episodeLink = buildEpisodeUrl({
    appUrl,
    episodeUrl,
    seriesId,
    themeId,
    episodeId,
  });
  const reviewUrl = `${normalizeAppUrl(appUrl)}/studio`;
  const generatedList = Array.isArray(generatedItems) && generatedItems.length > 0
    ? generatedItems.map((item) => String(item || '').trim()).filter(Boolean)
    : buildGeneratedItems({
      hook,
      outlineCount,
      talkingPointsCount,
      transcriptReady,
      showNotesReady,
      scriptDoctorReady,
    });
  const subject = clampTitle(title)
    ? `${safeTitle} is ready in VicPods`
    : 'Your VicPods episode is ready';
  const previewText = 'Your episode draft is ready to review in VicPods.';
  const locationLine = [safeSeriesName, safeThemeName].filter(Boolean).join(' • ');

  const text = [
    `Hi ${safeName},`,
    '',
    'Your latest VicPods episode is ready to review.',
    '',
    `${safeTitle}`,
    locationLine ? locationLine : '',
    '',
    'What was generated:',
    ...generatedList.map((item) => `- ${item}`),
    '',
    'Open the episode to review the draft, tighten the script, and keep your workflow moving.',
    '',
    `View episode: ${episodeLink}`,
    `Open Studio: ${reviewUrl}`,
    '',
    'VicPods Team',
    'Your voice deserves structure.',
  ].filter((line) => line !== null && line !== undefined).join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="display:inline-block; margin:0 auto 20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Episode ready
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  Your episode is ready
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Your latest VicPods draft is ready to review. Everything you need is waiting in one place so you can tighten the script and move straight into recording prep.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Ready to review
                      </p>
                      <p style="margin:0 0 8px; font-size:22px; line-height:1.4; font-weight:700; color:#0f172a;">
                        ${safeTitleHtml}
                      </p>
                      ${locationLine ? `
                      <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                        ${escapeHtml(locationLine)}
                      </p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px; font-size:14px; line-height:1.5; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6d28d9;">
                  What was generated
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                  ${generatedList.map((item) => `
                  <tr>
                    <td style="padding:0 0 12px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td valign="top" style="padding:7px 10px 0 0;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:#5b5ff8;"></span>
                          </td>
                          <td style="font-size:16px; line-height:1.6; color:#1e293b;">
                            ${escapeHtml(item)}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  `).join('')}
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(episodeLink)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        View episode
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#64748b; text-align:center;">
                  Open it now while the structure, script flow, and next edits are still fresh.
                </p>
                <p style="margin:0; font-size:14px; line-height:1.7; color:#475569; text-align:center;">
                  Need the broader view first?
                  <a href="${escapeHtml(reviewUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Studio</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b; text-align:center;">
                      VicPods helps creators move faster from draft to recording-ready episodes.
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

async function sendEpisodeReadyEmail(input) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildEpisodeReadyEmail({
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
  buildEpisodeReadyEmail,
  sendEpisodeReadyEmail,
};
