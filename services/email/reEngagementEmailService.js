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

function buildActivityLine(daysInactive) {
  const safeDays = Number.parseInt(daysInactive, 10);
  if (Number.isInteger(safeDays) && safeDays > 0) {
    return `It has been about ${safeDays} ${pluralize(safeDays, 'day', 'days')} since your last session.`;
  }

  return 'We noticed you have been away for a bit.';
}

function buildValuePoints({ hasDrafts, hasSeries, hasPantryItems }) {
  const items = [];

  if (hasDrafts) {
    items.push('Pick up active drafts without losing your structure or flow');
  }

  if (hasSeries) {
    items.push('Step back into your Studio and continue building your podcast workflow');
  }

  if (hasPantryItems) {
    items.push('Reuse saved hooks, notes, and ideas from Pantry to move faster');
  }

  if (items.length > 0) {
    return items;
  }

  return [
    'Turn rough ideas into structured episode drafts',
    'Use Studio to see the bigger picture and keep your workflow moving',
    'Move from concept to recording-ready prep with less friction',
  ];
}

function buildSuggestedAction({
  suggestedActionLabel,
  suggestedActionUrl,
  suggestedActionBody,
  appUrl,
}) {
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const label = String(suggestedActionLabel || '').trim();
  const url = String(suggestedActionUrl || '').trim();
  const body = String(suggestedActionBody || '').trim();

  if (label && url) {
    return { label, url, body };
  }

  return {
    label: 'Create your next episode',
    url: `${normalizedAppUrl}/create/single`,
    body: body || 'A simple way back in: start one focused episode and let VicPods rebuild your momentum from there.',
  };
}

function buildReEngagementEmail({
  name,
  appUrl,
  daysInactive,
  hasDrafts = false,
  hasSeries = false,
  hasPantryItems = false,
  suggestedActionLabel,
  suggestedActionUrl,
  suggestedActionBody,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const studioUrl = `${normalizedAppUrl}/studio`;
  const valuePoints = buildValuePoints({ hasDrafts, hasSeries, hasPantryItems });
  const inactivityLine = buildActivityLine(daysInactive);
  const suggestedAction = buildSuggestedAction({
    suggestedActionLabel,
    suggestedActionUrl,
    suggestedActionBody,
    appUrl: normalizedAppUrl,
  });
  const subject = 'Return to your Studio in VicPods';
  const previewText = 'Your Studio is still here when you are ready to jump back in.';

  const text = [
    `Hi ${safeName},`,
    '',
    'We noticed you have been away from VicPods.',
    '',
    inactivityLine,
    '',
    'When you are ready to jump back in, VicPods is still built to help you move from rough ideas to clear, structured podcast episodes.',
    '',
    'What is waiting for you:',
    ...valuePoints.map((item) => `- ${item}`),
    '',
    `${suggestedAction.label}: ${suggestedAction.url}`,
    suggestedAction.body,
    '',
    `Return to your Studio: ${studioUrl}`,
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
                  Re-engage
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  Your Studio is still here
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  We noticed you have been away from VicPods.
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#475569; text-align:left;">
                  ${escapeHtml(inactivityLine)}
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  When you are ready to jump back in, VicPods is still built to help you move from rough ideas to clear, structured podcast episodes without losing the next step.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        What is waiting for you
                      </p>
                      ${valuePoints.map((item) => `
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        ${escapeHtml(item)}
                      </p>
                      `).join('')}
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Return to your Studio
                      </a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px; background:#ffffff; border:1px solid #e2e8f0; border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px; text-align:left;">
                      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        A simple next step
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        <a href="${escapeHtml(suggestedAction.url)}" style="color:#5b5ff8; text-decoration:none; font-weight:700;">${escapeHtml(suggestedAction.label)}</a>
                      </p>
                      <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                        ${escapeHtml(suggestedAction.body)}
                      </p>
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
                      VicPods helps creators move from idea to episode with a more structured workflow.
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

async function sendReEngagementEmail(input) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildReEngagementEmail({
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
  buildReEngagementEmail,
  sendReEngagementEmail,
};
