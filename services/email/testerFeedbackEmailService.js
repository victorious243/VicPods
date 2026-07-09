const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./emailService');

const EMAIL_LOGO_CID = 'vicpods-logo@vicpods.app';
const EMAIL_LOGO_PATH = path.resolve(__dirname, '../../public/images/logo/vicpods-logo-horizontal-dark.png');

function normalizeAppUrl(appUrl) {
  const normalized = String(appUrl || process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (normalized) {
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL is required to build tester feedback emails in production.');
  }

  return 'http://localhost:3000';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function buildTesterFeedbackEmail({
  name,
  appUrl,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const studioUrl = `${normalizedAppUrl}/studio`;
  const helpUrl = `${normalizedAppUrl}/help`;
  const subject = 'Quick feedback on VicPods?';
  const previewText = 'A short note asking testers what VicPods should improve, add, or simplify next.';

  const questions = [
    'What were you trying to create in VicPods?',
    'What part felt most useful or saved you the most time?',
    'What felt confusing, slow, or unnecessary?',
    'What is missing that would make VicPods more useful for your podcast workflow?',
    'Would you use VicPods again for a real episode? Why or why not?',
  ];

  const text = [
    `Hi ${safeName},`,
    '',
    'Thank you again for testing VicPods.',
    '',
    'I would really appreciate your honest feedback. VicPods is still improving, and your experience can help decide what we fix, simplify, and build next.',
    '',
    'When you have a few minutes, could you reply to this email with answers to any of these questions?',
    '',
    ...questions.map((question, index) => `${index + 1}. ${question}`),
    '',
    'Even short answers are helpful. A few bullet points is perfect.',
    '',
    `Open VicPods: ${studioUrl}`,
    `Help Center: ${helpUrl}`,
    '',
    'Thanks again for helping shape VicPods.',
    '',
    'VicPods Team',
    'Your voice deserves structure.',
  ].join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px; overflow:hidden;">
            <tr>
              <td style="padding:32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                  <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="text-align:center; margin-bottom:20px;">
                  <span style="display:inline-block; padding:8px 13px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
                    Tester feedback
                  </span>
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:800; color:#0f172a; text-align:center;">
                  Could you share quick feedback on VicPods?
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${escapeHtml(safeName)},
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.7; color:#334155;">
                  Thank you again for testing VicPods. I would really appreciate your honest feedback while the product is still being shaped.
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155;">
                  Your experience can help decide what we fix, simplify, and build next, especially around the episode draft, workspace, launch pack, and overall flow.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Questions
                      </p>
                      <ol style="margin:0; padding-left:20px; color:#1e293b; font-size:15px; line-height:1.7;">
                        ${questions.map((question) => `<li style="margin:0 0 10px;">${escapeHtml(question)}</li>`).join('')}
                      </ol>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#475569;">
                  Even short answers are helpful. A few bullet points is perfect.
                </p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 22px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px; background:linear-gradient(135deg,#4f7dff,#775fff);">
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:800; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Open VicPods
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b; text-align:center;">
                  Need a reminder of the workflow?
                  <a href="${escapeHtml(helpUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:700;">Open Help</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#94a3b8; text-align:center;">
                      VicPods · Your voice deserves structure.
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

async function sendTesterFeedbackEmail({
  to,
  name,
  appUrl,
}) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildTesterFeedbackEmail({
    name,
    appUrl,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  return sendEmail({
    to,
    ...email,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}

module.exports = {
  buildTesterFeedbackEmail,
  sendTesterFeedbackEmail,
};
