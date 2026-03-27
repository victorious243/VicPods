const fs = require('fs');
const path = require('path');
const { sendEmail } = require('./emailService');
const { getPricingDisplay } = require('../billing/pricing');

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

function normalizePlan(plan) {
  const normalized = String(plan || 'free').trim().toLowerCase();
  if (['free', 'pro', 'premium'].includes(normalized)) {
    return normalized;
  }
  return 'free';
}

function getPlanLabel(plan) {
  if (plan === 'premium') {
    return 'Premium';
  }
  if (plan === 'pro') {
    return 'Pro';
  }
  return 'Free';
}

function getUpgradeContext(currentPlan) {
  if (currentPlan === 'pro') {
    return {
      recommendedPlan: 'premium',
      recommendedFeatures: [
        'Unlimited AI generations',
        'Tone Fix + Voice Persona controls',
        'Highest continuity workflow access',
        'Episode Brief TXT + PDF + DOCX exports',
      ],
      secondaryPlan: null,
      secondaryFeatures: [],
    };
  }

  return {
    recommendedPlan: 'pro',
    recommendedFeatures: [
      '50 AI generations each day',
      'Continuity refresh + stronger series planning',
      'Tone consistency scoring',
      'Episode Brief TXT + PDF exports',
    ],
    secondaryPlan: 'premium',
    secondaryFeatures: [
      'Unlimited AI generations',
      'Tone Fix + Voice Persona controls',
    ],
  };
}

function buildUsageLimitReachedLine({ currentPlan, limitLabel, usedCount }) {
  const planLabel = getPlanLabel(currentPlan);
  const safeLimitLabel = String(limitLabel || '').trim() || 'your current usage limit';

  if (Number.isFinite(usedCount) && usedCount > 0) {
    return `You have reached the ${planLabel} plan limit for ${safeLimitLabel} (${usedCount} used).`;
  }

  return `You have reached the ${planLabel} plan limit for ${safeLimitLabel}.`;
}

function buildUsageLimitUpgradeEmail({
  name,
  appUrl,
  currentPlan = 'free',
  limitLabel = 'AI generations today',
  usedCount = null,
  resetNote,
  logoCid,
}) {
  const pricing = getPricingDisplay();
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const normalizedPlan = normalizePlan(currentPlan);
  const billingUrl = `${normalizeAppUrl(appUrl)}/settings?section=billing`;
  const reachedLine = buildUsageLimitReachedLine({
    currentPlan: normalizedPlan,
    limitLabel,
    usedCount,
  });
  const upgradeContext = getUpgradeContext(normalizedPlan);
  const recommendedPlanLabel = getPlanLabel(upgradeContext.recommendedPlan);
  const recommendedPrice = pricing[upgradeContext.recommendedPlan];
  const secondaryPlanLabel = upgradeContext.secondaryPlan ? getPlanLabel(upgradeContext.secondaryPlan) : '';
  const secondaryPrice = upgradeContext.secondaryPlan ? pricing[upgradeContext.secondaryPlan] : '';
  const subject = normalizedPlan === 'pro'
    ? 'You reached your Pro usage limit in VicPods'
    : 'You reached your VicPods usage limit';
  const previewText = `${recommendedPlanLabel} unlocks more room to keep your podcast workflow moving.`;
  const resetLine = String(resetNote || '').trim()
    || 'If you want more room to keep creating today, you can upgrade without losing momentum.';

  const text = [
    `Hi ${safeName},`,
    '',
    reachedLine,
    '',
    'Your work is still there and ready when you come back. If you want to keep moving now, upgrading unlocks more room inside VicPods.',
    '',
    `What ${recommendedPlanLabel} unlocks:`,
    ...upgradeContext.recommendedFeatures.map((item) => `- ${item}`),
    '',
    `${resetLine}`,
    '',
    `Upgrade now: ${billingUrl}`,
    upgradeContext.secondaryPlan
      ? `${secondaryPlanLabel} is also available at ${secondaryPrice} if you want the highest AI and export access.`
      : '',
    recommendedPrice ? `${recommendedPlanLabel} starts at ${recommendedPrice}.` : '',
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
                  Usage limit reached
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a; text-align:center;">
                  Keep your workflow moving
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  ${escapeHtml(reachedLine)}
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:20px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Recommended upgrade
                      </p>
                      <p style="margin:0 0 8px; font-size:22px; line-height:1.4; font-weight:700; color:#0f172a;">
                        ${escapeHtml(recommendedPlanLabel)}
                      </p>
                      ${recommendedPrice ? `
                      <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                        ${escapeHtml(recommendedPrice)}
                      </p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px; font-size:14px; line-height:1.5; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6d28d9;">
                  What you unlock
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                  ${upgradeContext.recommendedFeatures.map((item) => `
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
                <p style="margin:0 0 22px; font-size:15px; line-height:1.7; color:#475569; text-align:left;">
                  ${escapeHtml(resetLine)}
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(billingUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Upgrade now
                      </a>
                    </td>
                  </tr>
                </table>
                ${upgradeContext.secondaryPlan ? `
                <p style="margin:0; font-size:14px; line-height:1.7; color:#475569; text-align:center;">
                  Need more? <strong>${escapeHtml(secondaryPlanLabel)}</strong> adds ${escapeHtml(upgradeContext.secondaryFeatures.join(' and '))}${secondaryPrice ? ` for ${escapeHtml(secondaryPrice)}` : ''}.
                </p>
                ` : ''}
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

async function sendUsageLimitUpgradeEmail(input) {
  const logoAttachment = buildEmailLogoAttachment();
  const email = buildUsageLimitUpgradeEmail({
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
  buildUsageLimitUpgradeEmail,
  sendUsageLimitUpgradeEmail,
};
