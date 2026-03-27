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

function buildFirstEpisodeOnboardingEmail({ name, appUrl, logoCid }) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const createEpisodeUrl = `${normalizedAppUrl}/create/single`;
  const studioUrl = `${normalizedAppUrl}/studio`;
  const kitchenUrl = `${normalizedAppUrl}/kitchen`;
  const subject = 'Create your first episode in VicPods';
  const previewText = 'Start in Studio, shape it in Kitchen, and turn your first idea into a real episode.';

  const text = [
    `Hi ${safeName},`,
    '',
    'Welcome back to VicPods.',
    '',
    'Your easiest next step is to create your first episode. Start in Studio for a clear view of your podcast workflow, then move into Kitchen to shape your idea into something structured and ready to record.',
    '',
    'Getting started is simple:',
    '- Open Studio and choose your first episode flow',
    '- Use Kitchen to organize the idea, angle, and notes',
    '- Build a structured draft you can refine before recording',
    '',
    `Create your first episode: ${createEpisodeUrl}`,
    `Open Studio: ${studioUrl}`,
    `Open Kitchen: ${kitchenUrl}`,
    '',
    'VicPods is built to help creators move from rough ideas to clear, production-ready episodes without losing momentum.',
    '',
    'VicPods Team',
    'Your voice deserves structure.',
  ].join('\n');

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
                  First episode
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  Create your first episode
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Your easiest next step in VicPods is to create your first episode. Start in <strong>Studio</strong> for the big-picture view, then move into <strong>Kitchen</strong> to shape your idea into a structured draft you can refine before recording.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        What happens next
                      </p>
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        1. Open Studio and start your first episode flow.
                      </p>
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        2. Use Kitchen to organize your angle, notes, and structure.
                      </p>
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#1e293b;">
                        3. Turn the idea into a clear draft that is ready for recording prep.
                      </p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(createEpisodeUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Create your first episode
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px; font-size:14px; line-height:1.7; color:#64748b; text-align:center;">
                  It only takes a few focused steps to go from a rough idea to a structured podcast workflow.
                </p>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#475569; text-align:center;">
                  Prefer to browse first?
                  <a href="${escapeHtml(studioUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Studio</a>
                  or
                  <a href="${escapeHtml(kitchenUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Kitchen</a>
                </p>
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

async function sendFirstEpisodeOnboardingEmail({ to, name, appUrl }) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildFirstEpisodeOnboardingEmail({
    name,
    appUrl,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  return sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}

module.exports = {
  buildFirstEpisodeOnboardingEmail,
  sendFirstEpisodeOnboardingEmail,
};
