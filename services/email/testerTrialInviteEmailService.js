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
    throw new Error('APP_URL is required to build tester invite emails in production.');
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

function buildTesterTrialInviteEmail({
  name,
  appUrl,
  inviteUrl,
  plan = 'premium',
  durationDays = 14,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const safeInviteUrl = String(inviteUrl || '').trim();
  const planLabel = String(plan || 'premium').trim().toLowerCase() === 'pro' ? 'Pro' : 'Premium';
  const dayCount = Math.max(1, Number.parseInt(durationDays, 10) || 14);
  const subject = `You’re invited to test VicPods ${planLabel}`;
  const previewText = `Thank you for volunteering to test VicPods. Your no-card ${dayCount}-day ${planLabel} trial is ready.`;
  const helpUrl = `${normalizedAppUrl}/help`;
  const examplesUrl = `${normalizedAppUrl}/examples`;

  const text = [
    `Hi ${safeName},`,
    '',
    'Thank you for volunteering to test VicPods.',
    '',
    `We appreciate you taking the time to try an early product and share honest feedback. Your no-card ${dayCount}-day VicPods ${planLabel} trial invite is ready.`,
    '',
    'VicPods helps podcasters turn a rough idea into a structured, ready-to-record episode with launch prep around it, including episode structure, stronger hooks, show notes, and launch-pack direction.',
    '',
    'How your tester trial works:',
    '1. Create your account with the invite link below.',
    '2. Verify your email so VicPods can activate the trial.',
    `3. Your ${planLabel} trial starts automatically. No credit card is required.`,
    '',
    'Best way to test VicPods:',
    '- Use one real podcast idea you would actually record.',
    '- Generate the first episode structure inside Studio.',
    '- Review the hook, outline, draft direction, and Launch Pack.',
    '- Tell us what felt useful, what felt confusing, and what would make you use it again.',
    '',
    `Start your trial: ${safeInviteUrl}`,
    `See examples: ${examplesUrl}`,
    `Help Center: ${helpUrl}`,
    '',
    'What to send back after testing:',
    '- Did VicPods save you planning time?',
    '- Was the first output useful enough to keep editing?',
    '- What would make it more valuable for your podcast workflow?',
    '',
    'No credit card is required for this tester trial. If you decide not to continue, nothing is charged.',
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
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="text-align:center; margin-bottom:20px;">
                  <span style="display:inline-block; padding:8px 13px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase;">
                    Volunteer tester access
                  </span>
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:800; color:#0f172a; text-align:center;">
                  Thank you for helping test VicPods
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${escapeHtml(safeName)},
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.7; color:#334155;">
                  We appreciate you taking the time to try an early product and share honest feedback. Your invite gives you a <strong>no-card ${dayCount}-day VicPods ${escapeHtml(planLabel)} trial</strong> after signup and email verification.
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155;">
                  VicPods is built for podcasters who want to move from a rough idea to a structured, ready-to-record episode with launch prep already taking shape before recording day.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 12px; font-size:13px; line-height:1.5; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        How your trial works
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        1. Create your account with the secure invite link below.
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        2. Verify your email so VicPods can activate your tester access.
                      </p>
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#1e293b;">
                        3. Your ${escapeHtml(planLabel)} trial starts automatically. No credit card is required.
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td width="50%" valign="top" style="padding:0 6px 0 0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px;">
                        <tr>
                          <td style="padding:18px;">
                            <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:800; color:#0f172a;">
                              What to try first
                            </p>
                            <p style="margin:0; font-size:14px; line-height:1.7; color:#475569;">
                              Use one real episode idea you would actually record, then review the title, hook, outline, draft direction, and Launch Pack.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="50%" valign="top" style="padding:0 0 0 6px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px;">
                        <tr>
                          <td style="padding:18px;">
                            <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:800; color:#0f172a;">
                              Feedback we need
                            </p>
                            <p style="margin:0; font-size:14px; line-height:1.7; color:#475569;">
                              Tell us what saved time, what felt unclear, and what would make VicPods valuable enough to use again.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 22px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px; background:linear-gradient(135deg,#4f7dff,#775fff);">
                      <a href="${escapeHtml(safeInviteUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:800; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Start your no-card trial
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px; font-size:14px; line-height:1.7; color:#64748b; text-align:center;">
                  No credit card is required. If you decide not to continue after the tester period, nothing is charged.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#0f172a; border-radius:18px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:800; color:#c4b5fd; letter-spacing:0.06em; text-transform:uppercase;">
                        Invite link
                      </p>
                      <a href="${escapeHtml(safeInviteUrl)}" style="color:#dbeafe; text-decoration:none; word-break:break-all; font-size:13px; line-height:1.7;">
                        ${escapeHtml(safeInviteUrl)}
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b; text-align:center;">
                  Want to understand the workflow first?
                  <a href="${escapeHtml(examplesUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:700;">View examples</a>
                  or
                  <a href="${escapeHtml(helpUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:700;">open Help</a>.
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

async function sendTesterTrialInviteEmail({
  to,
  name,
  appUrl,
  inviteUrl,
  plan,
  durationDays,
}) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildTesterTrialInviteEmail({
    name,
    appUrl,
    inviteUrl,
    plan,
    durationDays,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  return sendEmail({
    to,
    ...email,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}

module.exports = {
  buildTesterTrialInviteEmail,
  sendTesterTrialInviteEmail,
};
