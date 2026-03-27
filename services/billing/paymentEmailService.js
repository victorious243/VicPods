const fs = require('fs');
const path = require('path');
const { sendEmail } = require('../email/emailService');

const EMAIL_LOGO_CID = 'vicpods-logo@vicpods.app';
const EMAIL_LOGO_PATH = path.resolve(__dirname, '../../public/images/logo/vicpods-logo-horizontal-dark.png');

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

function formatCurrencyAmount(amountInMinorUnits, currency) {
  const amount = Number(amountInMinorUnits);
  const normalizedCurrency = String(currency || '').trim().toUpperCase();

  if (!Number.isFinite(amount) || !normalizedCurrency) {
    return '';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount / 100);
  } catch (_error) {
    return `${(amount / 100).toFixed(2)} ${normalizedCurrency}`;
  }
}

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return '';
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getPlanEmailDetails(plan) {
  const normalizedPlan = String(plan || 'free').trim().toLowerCase();

  if (normalizedPlan === 'premium') {
    return {
      key: 'premium',
      label: 'Premium',
      unlocked: [
        'Unlimited AI generations',
        'Tone Fix and Voice Persona controls',
        'Highest continuity workflow access',
        'Episode Brief TXT, PDF, and DOCX exports',
      ],
    };
  }

  if (normalizedPlan === 'pro') {
    return {
      key: 'pro',
      label: 'Pro',
      unlocked: [
        '50 AI generations each day',
        'Continuity refresh and stronger series planning',
        'Tone consistency scoring',
        'Episode Brief TXT and PDF exports',
      ],
    };
  }

  return {
    key: 'free',
    label: 'Free',
    unlocked: [
      'Core Studio, Workspace, and Pantry access',
    ],
  };
}

function buildTrialProgressLine(usage = {}) {
  const seriesCount = Number(usage.seriesCount || 0);
  const episodeCount = Number(usage.episodeCount || 0);
  const themeCount = Number(usage.themeCount || 0);

  if (seriesCount > 0 && episodeCount > 0) {
    return `You’ve already set up ${seriesCount} series and ${episodeCount} episodes inside VicPods.`;
  }

  if (episodeCount > 0) {
    return `You’ve already built ${episodeCount} episode${episodeCount === 1 ? '' : 's'} inside VicPods.`;
  }

  if (seriesCount > 0) {
    return `You’ve already mapped ${seriesCount} series inside VicPods.`;
  }

  if (themeCount > 0) {
    return `You’ve already organized ${themeCount} theme${themeCount === 1 ? '' : 's'} inside VicPods.`;
  }

  return 'You’ve already started building a more structured podcast workflow in VicPods.';
}

function buildPaymentSuccessEmail({
  name,
  plan,
  appUrl,
  receiptUrl,
  amountLabel,
  currentPeriodEnd,
  logoCid,
  isRenewal = false,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const safeReceiptUrl = escapeHtml(receiptUrl);
  const studioUrl = `${appUrl}/studio`;
  const billingUrl = `${appUrl}/settings?section=billing`;
  const planDetails = getPlanEmailDetails(plan);
  const planLabel = planDetails.label;
  const expiryLabel = formatDateLabel(currentPeriodEnd);
  const thanksLine = isRenewal
    ? `Thanks for your payment. Your ${planLabel} plan remains active on VicPods.`
    : `Thanks for your payment. Your ${planLabel} plan is now active on VicPods.`;
  const subject = isRenewal
    ? `Payment received. Your VicPods ${planLabel} plan remains active.`
    : `Payment received. Your VicPods ${planLabel} plan is active.`;
  const previewText = `${planLabel} access is ready in VicPods.`;

  const textLines = [
    `Hi ${safeName},`,
    '',
    thanksLine,
    '',
    `Current plan: ${planLabel}`,
  ];

  if (amountLabel) {
    textLines.push(`Payment confirmed: ${amountLabel}`);
  }

  if (expiryLabel) {
    textLines.push(`Current billing window: through ${expiryLabel}`);
  }

  textLines.push(
    '',
    'What you unlocked:',
    ...planDetails.unlocked.map((item) => `- ${item}`),
    '',
    `Go to Studio: ${studioUrl}`,
    `Manage Billing: ${billingUrl}`
  );

  if (receiptUrl) {
    textLines.push(`View receipt: ${receiptUrl}`);
  } else {
    textLines.push('Invoices and receipts are available from your Billing area.');
  }

  textLines.push(
    '',
    'VicPods Team',
    'Your voice deserves structure.'
  );

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 0 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Payment confirmed
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a;">
                  Your ${escapeHtml(planLabel)} plan is ready
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155;">
                  ${escapeHtml(thanksLine)}
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:18px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 10px; font-size:13px; line-height:1.4; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Account summary
                      </p>
                      <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Current plan:</strong> ${escapeHtml(planLabel)}
                      </p>
                      ${amountLabel ? `
                      <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Payment confirmed:</strong> ${escapeHtml(amountLabel)}
                      </p>
                      ` : ''}
                      ${expiryLabel ? `
                      <p style="margin:0; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Current billing window:</strong> through ${escapeHtml(expiryLabel)}
                      </p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 14px; font-size:14px; line-height:1.5; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#6d28d9;">
                  What you unlocked
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                  ${planDetails.unlocked.map((item) => `
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
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(studioUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Go to Studio
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#64748b;">
                  Manage your plan and invoices anytime:
                </p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.7;">
                  <a href="${escapeHtml(billingUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Billing</a>
                  ${receiptUrl ? `
                  <span style="color:#cbd5e1; padding:0 10px;">|</span>
                  <a href="${safeReceiptUrl}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">View Receipt</a>
                  ` : ''}
                </p>
                <p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">
                  VicPods Team
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b;">
                      Receipts and subscription history remain available in Billing.
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px; line-height:1.7; color:#94a3b8;">
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
    text: textLines.join('\n'),
    html,
  };
}

function buildPaymentFailedEmail({
  name,
  plan,
  appUrl,
  amountLabel,
  dueDate,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const planDetails = getPlanEmailDetails(plan);
  const planLabel = planDetails.label;
  const billingUrl = `${appUrl}/settings?section=billing`;
  const studioUrl = `${appUrl}/studio`;
  const dueDateLabel = formatDateLabel(dueDate);
  const subject = `Payment failed for your VicPods ${planLabel} plan`;
  const previewText = 'Update your payment method to keep your VicPods plan active.';

  const textLines = [
    `Hi ${safeName},`,
    '',
    `We could not process your latest payment for the VicPods ${planLabel} plan.`,
    '',
    'This can happen for simple reasons like an expired card or a temporary bank decline.',
  ];

  if (amountLabel) {
    textLines.push(`Attempted payment: ${amountLabel}`);
  }

  if (dueDateLabel) {
    textLines.push(`Billing date: ${dueDateLabel}`);
  }

  textLines.push(
    '',
    `Update payment method: ${billingUrl}`,
    '',
    'If this is not resolved, paid features may be interrupted until billing is updated.',
    `You can still review your workspace here: ${studioUrl}`,
    '',
    'VicPods Team',
    'Your voice deserves structure.'
  );

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 0 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#fff7ed; color:#c2410c; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Billing update needed
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a;">
                  We couldn’t process your payment
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#334155;">
                  We could not process your latest payment for the VicPods ${escapeHtml(planLabel)} plan.
                </p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.7; color:#64748b;">
                  This can happen for simple reasons like an expired card or a temporary bank decline.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#fffaf5; border:1px solid #fed7aa; border-radius:18px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 10px; font-size:13px; line-height:1.4; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#c2410c;">
                        Payment details
                      </p>
                      <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Plan:</strong> ${escapeHtml(planLabel)}
                      </p>
                      ${amountLabel ? `
                      <p style="margin:0 0 8px; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Attempted payment:</strong> ${escapeHtml(amountLabel)}
                      </p>
                      ` : ''}
                      ${dueDateLabel ? `
                      <p style="margin:0; font-size:16px; line-height:1.6; color:#1e293b;">
                        <strong>Billing date:</strong> ${escapeHtml(dueDateLabel)}
                      </p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(billingUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Update payment method
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#64748b;">
                  If this is not resolved, paid features may be interrupted until billing is updated.
                </p>
                <p style="margin:0 0 24px; font-size:14px; line-height:1.7; color:#64748b;">
                  You can still review your workspace here:
                  <a href="${escapeHtml(studioUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Studio</a>
                </p>
                <p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">
                  VicPods Team
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b;">
                      Update billing to restore uninterrupted access to your paid tools.
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px; line-height:1.7; color:#94a3b8;">
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
    text: textLines.join('\n'),
    html,
  };
}

function buildTrialEndingEmail({
  name,
  plan,
  appUrl,
  daysRemaining = 3,
  trialEndsAt,
  usage,
  logoCid,
}) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const planDetails = getPlanEmailDetails(plan);
  const planLabel = planDetails.label;
  const normalizedDays = Math.max(1, Number.parseInt(String(daysRemaining || 3), 10) || 3);
  const dayLabel = normalizedDays === 1 ? '1 day' : `${normalizedDays} days`;
  const trialEndsLabel = formatDateLabel(trialEndsAt);
  const progressLine = buildTrialProgressLine(usage);
  const billingUrl = `${appUrl}/settings?section=billing`;
  const studioUrl = `${appUrl}/studio`;
  const subject = `Your VicPods ${planLabel} trial ends in ${dayLabel}`;
  const previewText = `Upgrade now to keep your VicPods ${planLabel} workflow active.`;

  const textLines = [
    `Hi ${safeName},`,
    '',
    `Your VicPods ${planLabel} trial ends in ${dayLabel}.`,
    '',
    progressLine,
    '',
    `Keep your structured creation workflow moving with ${planLabel} access, including:`,
    ...planDetails.unlocked.map((item) => `- ${item}`),
  ];

  if (trialEndsLabel) {
    textLines.push('', `Trial end date: ${trialEndsLabel}`);
  }

  textLines.push(
    '',
    `Upgrade now: ${billingUrl}`,
    `Open Studio: ${studioUrl}`,
    '',
    'If you do nothing, your account may move back to Free when the trial ends.',
    '',
    'VicPods Team',
    'Your voice deserves structure.'
  );

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 0 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Trial ending soon
                </div>
                <h1 style="margin:0 0 14px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a;">
                  Keep your workflow moving
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#334155;">
                  Your VicPods ${escapeHtml(planLabel)} trial ends in ${escapeHtml(dayLabel)}.
                </p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.7; color:#64748b;">
                  ${escapeHtml(progressLine)}
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:18px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 10px; font-size:13px; line-height:1.4; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9;">
                        Keep access to
                      </p>
                      ${planDetails.unlocked.map((item) => `
                      <p style="margin:0 0 10px; font-size:16px; line-height:1.6; color:#1e293b;">
                        ${escapeHtml(item)}
                      </p>
                      `).join('')}
                      ${trialEndsLabel ? `
                      <p style="margin:0; font-size:15px; line-height:1.6; color:#64748b;">
                        Trial end date: ${escapeHtml(trialEndsLabel)}
                      </p>
                      ` : ''}
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(billingUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Upgrade now
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.7; color:#64748b;">
                  If you do nothing, your account may move back to Free when the trial ends.
                </p>
                <p style="margin:0 0 24px; font-size:14px; line-height:1.7; color:#64748b;">
                  Want to keep building first?
                  <a href="${escapeHtml(studioUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open Studio</a>
                </p>
                <p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">
                  VicPods Team
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b;">
                      Keep your structured creation workflow active without interruption.
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:13px; line-height:1.7; color:#94a3b8;">
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
    text: textLines.join('\n'),
    html,
  };
}

async function sendPaymentSuccessEmailIfNeeded({ user, invoice, subscription, plan }) {
  if (!user || !invoice) {
    return { sent: false, reason: 'missing_context' };
  }

  const invoiceId = String(invoice.id || '').trim();
  if (!invoiceId) {
    return { sent: false, reason: 'missing_invoice_id' };
  }

  if (user.lastPaymentEmailInvoiceId === invoiceId) {
    return { sent: false, reason: 'already_sent' };
  }

  const planDetails = getPlanEmailDetails(plan || user.plan);
  if (planDetails.key === 'free') {
    return { sent: false, reason: 'unsupported_plan' };
  }

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const amountLabel = formatCurrencyAmount(invoice.amount_paid || invoice.total, invoice.currency);
  const message = buildPaymentSuccessEmail({
    name: user.name,
    plan: planDetails.key,
    appUrl,
    receiptUrl: invoice.hosted_invoice_url || invoice.invoice_pdf || '',
    amountLabel,
    currentPeriodEnd: subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : user.currentPeriodEnd,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
    isRenewal: String(invoice.billing_reason || '').trim() === 'subscription_cycle',
  });

  const emailPayload = {
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  if (logoAttachment) {
    emailPayload.attachments = [logoAttachment];
  }

  try {
    const result = await sendEmail(emailPayload);
    if (result.delivered) {
      user.lastPaymentEmailInvoiceId = invoiceId;
      user.lastPaymentEmailSentAt = new Date();
      await user.save();
      return { sent: true, reason: 'delivered' };
    }

    return {
      sent: false,
      reason: result.devFallback ? 'dev_fallback' : 'not_delivered',
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Payment success email failed for ${user.email}: ${error.message}`);
    return { sent: false, reason: 'error' };
  }
}

async function sendPaymentFailedEmailIfNeeded({ user, invoice, plan }) {
  if (!user || !invoice) {
    return { sent: false, reason: 'missing_context' };
  }

  const invoiceId = String(invoice.id || '').trim();
  if (!invoiceId) {
    return { sent: false, reason: 'missing_invoice_id' };
  }

  if (user.lastPaymentFailureEmailInvoiceId === invoiceId) {
    return { sent: false, reason: 'already_sent' };
  }

  const planDetails = getPlanEmailDetails(plan || user.plan);
  if (planDetails.key === 'free') {
    return { sent: false, reason: 'unsupported_plan' };
  }

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const amountLabel = formatCurrencyAmount(invoice.amount_due || invoice.amount_remaining || invoice.total, invoice.currency);
  const message = buildPaymentFailedEmail({
    name: user.name,
    plan: planDetails.key,
    appUrl,
    amountLabel,
    dueDate: invoice.created ? new Date(invoice.created * 1000) : null,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  const emailPayload = {
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  if (logoAttachment) {
    emailPayload.attachments = [logoAttachment];
  }

  try {
    const result = await sendEmail(emailPayload);
    if (result.delivered) {
      user.lastPaymentFailureEmailInvoiceId = invoiceId;
      user.lastPaymentFailureEmailSentAt = new Date();
      await user.save();
      return { sent: true, reason: 'delivered' };
    }

    return {
      sent: false,
      reason: result.devFallback ? 'dev_fallback' : 'not_delivered',
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Payment failed email failed for ${user.email}: ${error.message}`);
    return { sent: false, reason: 'error' };
  }
}

async function sendTrialEndingEmail({
  user,
  plan,
  daysRemaining,
  trialEndsAt,
  usage,
}) {
  if (!user) {
    return { sent: false, reason: 'missing_user' };
  }

  const planDetails = getPlanEmailDetails(plan || user.plan);
  if (planDetails.key === 'free') {
    return { sent: false, reason: 'unsupported_plan' };
  }

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const message = buildTrialEndingEmail({
    name: user.name,
    plan: planDetails.key,
    appUrl,
    daysRemaining,
    trialEndsAt,
    usage,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });

  const emailPayload = {
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  if (logoAttachment) {
    emailPayload.attachments = [logoAttachment];
  }

  try {
    const result = await sendEmail(emailPayload);
    return {
      sent: Boolean(result.delivered),
      reason: result.delivered ? 'delivered' : (result.devFallback ? 'dev_fallback' : 'not_delivered'),
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Trial ending email failed for ${user.email}: ${error.message}`);
    return { sent: false, reason: 'error' };
  }
}

module.exports = {
  buildPaymentSuccessEmail,
  buildPaymentFailedEmail,
  buildTrialEndingEmail,
  sendPaymentSuccessEmailIfNeeded,
  sendPaymentFailedEmailIfNeeded,
  sendTrialEndingEmail,
};
