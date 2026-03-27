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

function clampText(value, maxLength = 180) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeTip(tip) {
  const title = clampText(tip?.title, 96);
  const detail = clampText(tip?.detail, 220);

  if (!title) {
    return null;
  }

  return { title, detail };
}

function buildDefaultTips() {
  return [
    {
      title: 'Start with the listener outcome before you build the outline',
      detail: 'A clearer transformation makes the hook, talking points, and close feel tighter from the start.',
    },
    {
      title: 'Use Pantry to save hooks and loose ideas before you lose them',
      detail: 'Treat Pantry as your ingredient shelf so future drafts start with better raw material.',
    },
    {
      title: 'Move a draft to Ready only when the opening, body, and close all point in the same direction',
      detail: 'That small final check usually improves clarity more than adding extra sections.',
    },
  ];
}

function buildCreatorTipsEmail({
  name,
  appUrl,
  tips = [],
  introNote,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const studioUrl = `${normalizedAppUrl}/studio`;
  const pantryUrl = `${normalizedAppUrl}/pantry`;
  const finalTips = (Array.isArray(tips) ? tips : [])
    .map(normalizeTip)
    .filter(Boolean)
    .slice(0, 3);
  const tipsToUse = finalTips.length > 0 ? finalTips : buildDefaultTips();
  const note = String(introNote || '').trim()
    || 'A few short creator tips from the VicPods workflow to help you shape stronger episodes with less friction.';
  const subject = '3 quick creator tips from VicPods';
  const previewText = 'Short podcast workflow tips you can apply inside VicPods right away.';

  const text = [
    `Hi ${safeName},`,
    '',
    note,
    '',
    ...tipsToUse.flatMap((tip, index) => [
      `${index + 1}. ${tip.title}`,
      tip.detail ? `   ${tip.detail}` : '',
      '',
    ]),
    `Try this in your Studio: ${studioUrl}`,
    `Save ideas in Pantry: ${pantryUrl}`,
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
                  Creator tips
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  A few quick tips for stronger episodes
                </h1>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml}, ${escapeHtml(note)}
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                  ${tipsToUse.map((tip, index) => `
                  <tr>
                    <td style="padding:0 0 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                        <tr>
                          <td style="padding:20px 22px;">
                            <p style="margin:0 0 8px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                              Tip ${index + 1}
                            </p>
                            <p style="margin:0 0 8px; font-size:18px; line-height:1.5; font-weight:700; color:#0f172a;">
                              ${escapeHtml(tip.title)}
                            </p>
                            ${tip.detail ? `
                            <p style="margin:0; font-size:14px; line-height:1.7; color:#475569;">
                              ${escapeHtml(tip.detail)}
                            </p>
                            ` : ''}
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
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Try this in your Studio
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:14px; line-height:1.7; color:#475569; text-align:center;">
                  Need a place to keep rough hooks first?
                  <a href="${escapeHtml(pantryUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Pantry</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b; text-align:center;">
                      VicPods helps creators shape stronger episodes before they record.
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

async function sendCreatorTipsEmail(input) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildCreatorTipsEmail({
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
  buildCreatorTipsEmail,
  sendCreatorTipsEmail,
};
