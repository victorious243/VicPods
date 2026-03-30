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
    throw new Error('APP_URL is required to build the creator welcome email in production.');
  }

  return 'http://localhost:3000';
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

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildCreatorPremiumWelcomeEmail({
  name,
  appUrl,
  expiresAt,
  creatorInviteUrl,
  accessMode,
  currentPlan,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedAppUrl = normalizeAppUrl(appUrl);
  const studioUrl = `${normalizedAppUrl}/studio`;
  const createEpisodeUrl = `${normalizedAppUrl}/create/single`;
  const helpUrl = `${normalizedAppUrl}/help`;
  const formattedExpiry = formatDate(expiresAt);
  const safeCreatorInviteUrl = String(creatorInviteUrl || '').trim();
  const normalizedAccessMode = String(accessMode || 'granted_premium_trial').trim().toLowerCase();
  const normalizedPlan = String(currentPlan || '').trim().toLowerCase();
  const planLabel = normalizedPlan ? `${normalizedPlan.charAt(0).toUpperCase()}${normalizedPlan.slice(1)}` : 'Premium';
  const hasPremiumAccess = normalizedAccessMode !== 'existing_paid';
  const subject = hasPremiumAccess
    ? 'Your VicPods Premium creator access is live'
    : 'Your VicPods creator access is live';
  const previewText = hasPremiumAccess
    ? 'Premium is on. Test one real episode workflow in VicPods, then share your creator link when you are ready.'
    : 'Your creator access is ready. Your current plan stays unchanged while you test VicPods and share your creator link.';
  const accessIntro = normalizedAccessMode === 'existing_paid'
    ? `Your creator setup is ready, and your current <strong>${escapeHtml(planLabel)}</strong> plan stays unchanged.`
    : formattedExpiry
      ? `Your Premium creator access is now live through <strong>${escapeHtml(formattedExpiry)}</strong>.`
      : 'Your Premium creator access is now live.';
  const accessIntroText = normalizedAccessMode === 'existing_paid'
    ? `Your creator setup is ready, and your current ${planLabel} plan stays unchanged.`
    : formattedExpiry
      ? `Your Premium creator access is now live through ${formattedExpiry}.`
      : 'Your Premium creator access is now live.';
  const capabilityHeading = hasPremiumAccess
    ? 'What Premium unlocks during your test'
    : 'What to test in VicPods';

  const textLines = [
    `Hi ${safeName},`,
    '',
    'Thanks again for checking out VicPods.',
    '',
    accessIntroText,
    '',
    'VicPods helps you turn a rough podcast idea into a structured, ready-to-record episode and launch prep without getting stuck in a blank page.',
    '',
    'Best way to test it:',
    '1. Open Studio and start one real episode idea you would actually record.',
    '2. Choose a template, add your topic, and generate the first draft.',
    '3. Review the Launch Pack for titles, description, show notes, social captions, and CTA ideas.',
    '4. If it feels like a fit for your audience, use your creator link to invite them in.',
    '',
    `Open Studio: ${studioUrl}`,
    `Create your first episode: ${createEpisodeUrl}`,
  ];

  if (safeCreatorInviteUrl) {
    textLines.push(`Your creator link: ${safeCreatorInviteUrl}`);
  }

  textLines.push(
    `Help Center: ${helpUrl}`,
    '',
    `${capabilityHeading}:`,
    '- full draft generation workflow',
    '- Launch Pack output',
    '- stronger continuity and refinement tools',
    '- richer export-ready prep',
    '',
    'Thanks again for giving VicPods a real test.',
    '',
    'VicPods Team',
    'Your voice deserves structure.'
  );

  const text = textLines.join('\n');

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
                  Creator access
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  Your VicPods Premium access is ready
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 14px; font-size:16px; line-height:1.7; color:#334155;">
                  Thanks again for checking out VicPods.
                  ${accessIntro}
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155;">
                  VicPods helps podcasters go from a rough idea to a structured, ready-to-record episode with launch-ready content around it, so the planning work is already done before recording day.
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 14px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Best way to test VicPods
                      </p>
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        1. Open Studio and start with one real episode idea you would actually record.
                      </p>
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        2. Choose a template, add the topic, and generate the first structured draft.
                      </p>
                      <p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#1e293b;">
                        3. Review the Launch Pack for titles, description, show notes, captions, and CTA ideas.
                      </p>
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#1e293b;">
                        4. If it feels like a fit for your audience, use your creator link when you are ready to share it.
                      </p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Open Studio
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px; font-size:14px; line-height:1.7; color:#475569; text-align:center;">
                  Want the fastest first test?
                  <a href="${escapeHtml(createEpisodeUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Create your first episode</a>
                </p>

                ${safeCreatorInviteUrl ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#0f172a; border-radius:18px;">
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 8px; font-size:12px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#a5b4fc;">
                        Your creator link
                      </p>
                      <p style="margin:0; font-size:14px; line-height:1.7; color:#e2e8f0; word-break:break-word;">
                        <a href="${escapeHtml(safeCreatorInviteUrl)}" style="color:#c4b5fd; text-decoration:none;">${escapeHtml(safeCreatorInviteUrl)}</a>
                      </p>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:18px;">
                  <tr>
                    <td style="padding:20px;">
                      <p style="margin:0 0 12px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#475569;">
                        ${escapeHtml(capabilityHeading)}
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        Full draft generation workflow
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        Launch Pack output
                      </p>
                      <p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#1e293b;">
                        Stronger continuity and refinement tools
                      </p>
                      <p style="margin:0; font-size:15px; line-height:1.7; color:#1e293b;">
                        Richer export-ready prep
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
                      Need to review the flow first?
                      <a href="${escapeHtml(helpUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open the Help Center</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px; line-height:1.7; color:#94a3b8; text-align:center;">
                      Thanks again for giving VicPods a real test.
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

  return {
    subject,
    text,
    html,
  };
}

async function sendCreatorPremiumWelcomeEmail({
  to,
  name,
  appUrl,
  expiresAt,
  creatorInviteUrl,
  accessMode,
  currentPlan,
}) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildCreatorPremiumWelcomeEmail({
    name,
    appUrl,
    expiresAt,
    creatorInviteUrl,
    accessMode,
    currentPlan,
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
  buildCreatorPremiumWelcomeEmail,
  sendCreatorPremiumWelcomeEmail,
};
