const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { AppError } = require('../utils/errors');
const { sendEmail } = require('./email/emailService');
const {
  applyReferralRewardIfEligible,
  attachReferralToUser,
  normalizeReferralCode,
} = require('./marketing/referralService');

const SALT_ROUNDS = 12;
const EMAIL_PIN_TTL_MINUTES = 15;
const PASSWORD_RESET_TTL_MINUTES = 45;
const PENDING_REGISTRATION_TTL_HOURS = 24;
const TERMS_VERSION = 'v1.0-2026-02-25';
const EMAIL_LOGO_CID = 'vicpods-logo@vicpods.app';
const EMAIL_LOGO_PATH = path.resolve(__dirname, '../public/images/logo/vicpods-logo-horizontal-dark.png');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePin(pin) {
  return String(pin || '').trim().replace(/\D/g, '');
}

function normalizeToken(token) {
  return String(token || '').trim();
}

function hashVerificationPin(pin) {
  const secret = String(process.env.SESSION_SECRET || 'vicpods-pin-secret');
  return crypto
    .createHmac('sha256', secret)
    .update(String(pin || ''))
    .digest('hex');
}

function hashPasswordResetToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}

function generateVerificationPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildPendingRegistrationExpiryDate() {
  return new Date(Date.now() + PENDING_REGISTRATION_TTL_HOURS * 60 * 60 * 1000);
}

function normalizeIp(value) {
  return String(value || '')
    .trim()
    .slice(0, 80);
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

function formatPinForDisplay(pin) {
  const normalized = normalizePin(pin).slice(0, 6);
  if (normalized.length !== 6) {
    return String(pin || '').trim();
  }

  return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

function buildPinEmail({ name, pin, appUrl, logoCid }) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const pinDisplay = formatPinForDisplay(pin);
  const pinDisplayHtml = escapeHtml(pinDisplay);
  const verifyUrl = `${appUrl}/auth/verify`;
  const subject = 'Your VicPods verification code';
  const previewText = 'Use this secure code to verify your VicPods account.';
  const text = [
    `Hi ${safeName},`,
    '',
    'Use the verification code below to confirm your email address and finish setting up your VicPods account.',
    '',
    `${pinDisplay}`,
    '',
    `This code expires in ${EMAIL_PIN_TTL_MINUTES} minutes.`,
    '',
    `Verify account: ${verifyUrl}`,
    '',
    'You can also copy and paste the code into the verification screen manually.',
    '',
    `If the code expires, request a new one from ${verifyUrl}.`,
    '',
    'If you did not request this verification code, you can safely ignore this email. Your email address will not be verified unless the code is entered.',
    '',
    'VicPods Security',
    'Your voice deserves structure.',
  ].join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td align="center" style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Secure verification
                </div>
                <h1 style="margin:0 0 14px; font-size:30px; line-height:1.15; font-weight:700; color:#0f172a;">
                  Verify your VicPods account
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Use the verification code below to confirm your email address and finish setting up your VicPods account.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px; background:#f8f7ff; border:1px solid #e6e1ff; border-radius:20px;">
                  <tr>
                    <td align="center" style="padding:24px 20px;">
                      <div style="font-size:13px; line-height:1.4; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6d28d9; margin:0 0 10px;">
                        Verification code
                      </div>
                      <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace; font-size:36px; line-height:1.1; font-weight:700; letter-spacing:0.18em; color:#0f172a;">
                        ${pinDisplayHtml}
                      </div>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px; font-size:14px; line-height:1.7; color:#64748b;">
                  This code expires in ${EMAIL_PIN_TTL_MINUTES} minutes.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${verifyUrl}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Verify account
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px; font-size:14px; line-height:1.7; color:#475569; text-align:left;">
                  You can also copy and paste this code into the verification screen manually if the button does not open automatically.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px; text-align:left;">
                      <p style="margin:0 0 6px; font-size:13px; line-height:1.5; font-weight:700; color:#0f172a;">
                        Didn’t request this?
                      </p>
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#64748b;">
                        You can safely ignore this email. Your email address will not be verified unless this code is entered.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:13px; line-height:1.7; color:#94a3b8; text-align:left;">
                  If this code expires, return to the verification screen and request a new one.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b; text-align:center;">
                      VicPods Security
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

function buildWelcomeEmail({ name, appUrl, logoCid }) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const studioUrl = `${appUrl}/studio`;
  const billingUrl = `${appUrl}/settings?section=billing`;
  const helpUrl = `${appUrl}/help`;
  const subject = 'Welcome to VicPods. Your Studio is ready.';
  const previewText = 'Start building structured podcast episodes inside VicPods.';
  const text = [
    `Hi ${safeName},`,
    '',
    'Welcome to VicPods. Your podcast creation studio is ready.',
    '',
    'VicPods helps you turn rough ideas into structured podcast episodes, with a workflow built to move from first concept to recording day.',
    '',
    'What you can do now:',
    '- Create your first Series or Episode in Studio',
    '- Organize ideas and planning inside Kitchen',
    '- Generate structured outlines, scripts, and episode prep with AI',
    '- Move your workflow from draft to ready to record',
    '',
    `Open Studio: ${studioUrl}`,
    `Manage Billing: ${billingUrl}`,
    `Visit Help Center: ${helpUrl}`,
    '',
    'Welcome aboard,',
    'VicPods Team',
    '',
    'Your voice deserves structure.',
  ].join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 0 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Welcome to VicPods
                </div>
                <h1 style="margin:0 0 16px; font-size:32px; line-height:1.15; font-weight:700; color:#0f172a;">
                  Your podcast creation studio is ready.
                </h1>
                <p style="margin:0 0 14px; font-size:17px; line-height:1.7; color:#334155;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:17px; line-height:1.7; color:#334155;">
                  VicPods helps you turn rough ideas into structured podcast episodes, with a workflow built to move from first concept to recording day.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${studioUrl}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Open Studio
                      </a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8f7ff; border:1px solid #ebe9fe; border-radius:18px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="margin:0 0 16px; font-size:14px; line-height:1.4; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#6d28d9;">
                        What you can do now
                      </p>
                      <p style="margin:0 0 12px; font-size:16px; line-height:1.6; color:#1e293b;">
                        Create your first <strong>Series</strong> or <strong>Episode</strong> in Studio
                      </p>
                      <p style="margin:0 0 12px; font-size:16px; line-height:1.6; color:#1e293b;">
                        Organize ideas, themes, and planning inside <strong>Kitchen</strong>
                      </p>
                      <p style="margin:0 0 12px; font-size:16px; line-height:1.6; color:#1e293b;">
                        Generate structured outlines, scripts, and episode prep with AI
                      </p>
                      <p style="margin:0; font-size:16px; line-height:1.6; color:#1e293b;">
                        Move your podcast workflow from <strong>draft</strong> to <strong>ready to record</strong>
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; line-height:1.6; color:#64748b;">
                  Quick links
                </p>
                <p style="margin:0 0 28px; font-size:15px; line-height:1.7;">
                  <a href="${billingUrl}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Manage Billing</a>
                  <span style="color:#cbd5e1; padding:0 10px;">|</span>
                  <a href="${helpUrl}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Visit Help Center</a>
                </p>
                <p style="margin:0 0 8px; font-size:16px; line-height:1.7; color:#334155;">
                  Welcome aboard,
                </p>
                <p style="margin:0; font-size:16px; line-height:1.7; font-weight:700; color:#0f172a;">
                  VicPods Team
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e2e8f0;">
                  <tr>
                    <td style="padding-top:20px; font-size:13px; line-height:1.7; color:#64748b;">
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

function buildPasswordResetEmail({ name, resetUrl, logoCid }) {
  const safeName = String(name || 'there').trim() || 'there';
  const safeNameHtml = escapeHtml(safeName);
  const safeResetUrl = escapeHtml(resetUrl);
  const subject = 'Reset your VicPods password';
  const previewText = 'Use this secure link to reset your VicPods password.';
  const text = [
    `Hi ${safeName},`,
    '',
    'We received a request to reset the password for your VicPods account.',
    '',
    `Reset Password: ${resetUrl}`,
    '',
    `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
    '',
    'If the button does not work, copy and paste the link above into your browser.',
    '',
    'If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.',
    '',
    'VicPods Security',
    'Your voice deserves structure.',
  ].join('\n');

  const html = `
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; margin:0; padding:0; background:#f4f6fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td align="center" style="padding:32px 32px 24px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                ${logoCid ? `
                <img src="cid:${logoCid}" alt="VicPods" width="148" style="display:block; width:148px; max-width:100%; height:auto; margin:0 auto 24px;" />
                ` : ''}
                <div style="display:inline-block; margin-bottom:20px; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                  Account security
                </div>
                <h1 style="margin:0 0 14px; font-size:30px; line-height:1.15; font-weight:700; color:#0f172a;">
                  Reset your password
                </h1>
                <p style="margin:0 0 12px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  Hi ${safeNameHtml},
                </p>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#334155; text-align:left;">
                  We received a request to reset the password for your VicPods account.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 20px;">
                  <tr>
                    <td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${safeResetUrl}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px; font-size:14px; line-height:1.7; color:#64748b; text-align:left;">
                  This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px; text-align:left;">
                      <p style="margin:0 0 8px; font-size:13px; line-height:1.5; font-weight:700; color:#0f172a;">
                        Use this link instead
                      </p>
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#64748b; word-break:break-word;">
                        <a href="${safeResetUrl}" style="color:#5b5ff8; text-decoration:none;">${safeResetUrl}</a>
                      </p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px;">
                  <tr>
                    <td style="padding:18px 20px; text-align:left;">
                      <p style="margin:0 0 6px; font-size:13px; line-height:1.5; font-weight:700; color:#0f172a;">
                        Didn’t request this?
                      </p>
                      <p style="margin:0; font-size:13px; line-height:1.7; color:#64748b;">
                        You can safely ignore this email. Your password will remain unchanged unless you complete the reset.
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
                      VicPods Security
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

async function sendWelcomeEmailOnce(user) {
  if (!user || user.welcomeEmailSentAt) {
    return {
      sent: false,
      reason: 'already_sent',
    };
  }

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const message = buildWelcomeEmail({
    name: user.name,
    appUrl,
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
    const emailResult = await sendEmail(emailPayload);
    if (emailResult.delivered) {
      user.welcomeEmailSentAt = new Date();
      await user.save();
      return {
        sent: true,
        reason: 'delivered',
      };
    }

    return {
      sent: false,
      reason: emailResult.devFallback ? 'dev_fallback' : 'not_delivered',
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Welcome email failed for ${user.email}: ${error.message}`);
    return {
      sent: false,
      reason: 'error',
    };
  }
}

async function sendVerificationPin({ email, name, pin }) {
  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const message = buildPinEmail({
    name,
    pin,
    appUrl,
    logoCid: logoAttachment ? EMAIL_LOGO_CID : '',
  });
  const emailPayload = {
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  };

  if (logoAttachment) {
    emailPayload.attachments = [logoAttachment];
  }

  const emailResult = await sendEmail(emailPayload);

  return {
    pinDevOnly: emailResult.devFallback ? pin : null,
  };
}

async function sendPasswordResetEmail({ user, token }) {
  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const logoAttachment = buildEmailLogoAttachment();
  const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const message = buildPasswordResetEmail({
    name: user.name,
    resetUrl,
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

  const emailResult = await sendEmail(emailPayload);
  return {
    resetUrlDevOnly: emailResult.devFallback ? resetUrl : null,
  };
}

async function issueVerificationPinForUser(user) {
  const pin = generateVerificationPin();
  user.emailVerificationPinHash = hashVerificationPin(pin);
  user.emailVerificationPinExpiresAt = new Date(Date.now() + EMAIL_PIN_TTL_MINUTES * 60 * 1000);
  await user.save();

  const emailResult = await sendVerificationPin({
    email: user.email,
    name: user.name,
    pin,
  });

  return {
    user,
    email: user.email,
    pinDevOnly: emailResult.pinDevOnly,
  };
}

async function issueVerificationPinForPendingRegistration(pendingRegistration) {
  const pin = generateVerificationPin();
  pendingRegistration.pinHash = hashVerificationPin(pin);
  pendingRegistration.pinExpiresAt = new Date(Date.now() + EMAIL_PIN_TTL_MINUTES * 60 * 1000);
  pendingRegistration.expiresAt = buildPendingRegistrationExpiryDate();
  await pendingRegistration.save();

  const emailResult = await sendVerificationPin({
    email: pendingRegistration.email,
    name: pendingRegistration.name,
    pin,
  });

  return {
    pendingRegistration,
    email: pendingRegistration.email,
    pinDevOnly: emailResult.pinDevOnly,
  };
}

async function activatePendingRegistration(pendingRegistration, existingUser = null) {
  let user = existingUser;
  let shouldSendWelcomeEmail = false;

  if (!user) {
    try {
      user = await User.create({
        name: pendingRegistration.name,
        email: pendingRegistration.email,
        passwordHash: pendingRegistration.passwordHash,
        emailVerified: true,
        termsAcceptedAt: pendingRegistration.termsAcceptedAt,
        termsAcceptedVersion: pendingRegistration.termsAcceptedVersion,
        termsAcceptedIp: pendingRegistration.termsAcceptedIp,
      });
      shouldSendWelcomeEmail = true;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      user = await User.findOne({ email: pendingRegistration.email });
      if (!user) {
        throw error;
      }
    }
  }

  if (user.emailVerified === false) {
    user.name = pendingRegistration.name;
    user.passwordHash = pendingRegistration.passwordHash;
    user.emailVerified = true;
    user.authProvider = 'local';
    user.termsAcceptedAt = pendingRegistration.termsAcceptedAt || user.termsAcceptedAt;
    user.termsAcceptedVersion = pendingRegistration.termsAcceptedVersion || user.termsAcceptedVersion;
    user.termsAcceptedIp = pendingRegistration.termsAcceptedIp || user.termsAcceptedIp;
    user.emailVerificationPinHash = '';
    user.emailVerificationPinExpiresAt = null;
    await user.save();
    shouldSendWelcomeEmail = true;
  } else {
    user.emailVerified = true;
  }

  const pendingReferralCode = normalizeReferralCode(pendingRegistration.referredByCode || user.referredByCode || '');
  await attachReferralToUser(user, pendingReferralCode);

  if (user.isModified()) {
    await user.save();
  }

  await pendingRegistration.deleteOne();
  await applyReferralRewardIfEligible(user);
  if (shouldSendWelcomeEmail) {
    await sendWelcomeEmailOnce(user);
  }
  return user;
}

async function registerUser({ name, email, password, acceptedTerms, requestIp, referralCode }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || '').trim();
  const normalizedReferralCode = normalizeReferralCode(referralCode);

  if (!normalizedName || !normalizedEmail || !password) {
    throw new AppError('Name, email, and password are required.', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters.', 400);
  }

  if (!acceptedTerms) {
    throw new AppError('You must accept the Terms and Conditions to create an account.', 400);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.emailVerified === false) {
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      existingUser.name = normalizedName;
      existingUser.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      existingUser.termsAcceptedAt = new Date();
      existingUser.termsAcceptedVersion = TERMS_VERSION;
      existingUser.termsAcceptedIp = normalizeIp(requestIp);
      if (!existingUser.referredByUserId && !existingUser.referralRewardAppliedAt) {
        existingUser.referredByCode = normalizedReferralCode || existingUser.referredByCode || '';
      }
      return issueVerificationPinForUser(existingUser);
    }
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let pendingRegistration = await PendingRegistration.findOne({ email: normalizedEmail });

  if (!pendingRegistration) {
    pendingRegistration = new PendingRegistration({
      email: normalizedEmail,
      expiresAt: buildPendingRegistrationExpiryDate(),
    });
  }

  pendingRegistration.name = normalizedName;
  pendingRegistration.passwordHash = passwordHash;
  pendingRegistration.termsAcceptedAt = new Date();
  pendingRegistration.termsAcceptedVersion = TERMS_VERSION;
  pendingRegistration.termsAcceptedIp = normalizeIp(requestIp);
  pendingRegistration.referredByCode = normalizedReferralCode || pendingRegistration.referredByCode || '';
  pendingRegistration.expiresAt = buildPendingRegistrationExpiryDate();

  return issueVerificationPinForPendingRegistration(pendingRegistration);
}

async function authenticateUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const pendingRegistration = await PendingRegistration.findOne({ email: normalizedEmail });
    if (pendingRegistration) {
      const isPendingPasswordMatch = await bcrypt.compare(password, pendingRegistration.passwordHash);
      if (isPendingPasswordMatch) {
        throw new AppError('Please verify your email with the PIN before logging in.', 403);
      }
    }
    throw new AppError('Invalid email or password.', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.emailVerified === false) {
    throw new AppError('Please verify your email with the PIN before logging in.', 403);
  }

  return user;
}

async function resendVerificationPin({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new AppError('Email is required.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (user && user.emailVerified !== false) {
    throw new AppError('This account is already verified. Please log in.', 409);
  }

  if (user) {
    await PendingRegistration.deleteOne({ email: normalizedEmail });
    return issueVerificationPinForUser(user);
  }

  const pendingRegistration = await PendingRegistration.findOne({ email: normalizedEmail });
  if (pendingRegistration) {
    return issueVerificationPinForPendingRegistration(pendingRegistration);
  }

  throw new AppError('No account found for that email.', 404);
}

async function requestPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new AppError('Email is required.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return {
      email: normalizedEmail,
      resetUrlDevOnly: null,
    };
  }

  const token = generatePasswordResetToken();
  user.passwordResetTokenHash = hashPasswordResetToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  await user.save();

  const emailResult = await sendPasswordResetEmail({ user, token });

  return {
    email: user.email,
    resetUrlDevOnly: emailResult.resetUrlDevOnly,
  };
}

async function resetPassword({ email, token, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = normalizeToken(token);
  const password = String(newPassword || '');
  const expectedHash = hashPasswordResetToken(normalizedToken);

  if (!normalizedToken || !password) {
    throw new AppError('Reset token and new password are required.', 400);
  }

  if (password.length < 8) {
    throw new AppError('New password must be at least 8 characters.', 400);
  }

  const invalidResetError = new AppError('This password reset link is invalid or has expired. Request a new one.', 400);
  const user = normalizedEmail
    ? await User.findOne({ email: normalizedEmail })
    : await User.findOne({ passwordResetTokenHash: expectedHash });

  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    throw invalidResetError;
  }

  if (new Date(user.passwordResetExpiresAt).getTime() <= Date.now()) {
    user.passwordResetTokenHash = '';
    user.passwordResetExpiresAt = null;
    await user.save();
    throw invalidResetError;
  }

  if (user.passwordResetTokenHash !== expectedHash) {
    throw invalidResetError;
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.passwordResetTokenHash = '';
  user.passwordResetExpiresAt = null;
  await user.save();

  return user;
}

async function verifyEmailPin({ email, pin }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPin = normalizePin(pin);

  if (!normalizedEmail || !normalizedPin) {
    throw new AppError('Email and PIN are required.', 400);
  }

  if (normalizedPin.length !== 6) {
    throw new AppError('PIN must be 6 digits.', 400);
  }

  const [user, pendingRegistration] = await Promise.all([
    User.findOne({ email: normalizedEmail }),
    PendingRegistration.findOne({ email: normalizedEmail }),
  ]);

  if (user && user.emailVerified !== false) {
    if (pendingRegistration) {
      await pendingRegistration.deleteOne();
    }
    return user;
  }

  if (pendingRegistration) {
    if (!pendingRegistration.pinHash || !pendingRegistration.pinExpiresAt) {
      throw new AppError('No active PIN found. Request a new one.', 400);
    }

    if (new Date(pendingRegistration.pinExpiresAt).getTime() <= Date.now()) {
      throw new AppError('This PIN has expired. Request a new one.', 400);
    }

    const expectedHash = hashVerificationPin(normalizedPin);
    if (pendingRegistration.pinHash !== expectedHash) {
      throw new AppError('Invalid PIN. Please try again.', 400);
    }

    return activatePendingRegistration(pendingRegistration, user || null);
  }

  if (!user) {
    throw new AppError('No account found for that email.', 404);
  }

  if (!user.emailVerificationPinHash || !user.emailVerificationPinExpiresAt) {
    throw new AppError('No active PIN found. Request a new one.', 400);
  }

  if (new Date(user.emailVerificationPinExpiresAt).getTime() <= Date.now()) {
    throw new AppError('This PIN has expired. Request a new one.', 400);
  }

  const expectedHash = hashVerificationPin(normalizedPin);
  if (user.emailVerificationPinHash !== expectedHash) {
    throw new AppError('Invalid PIN. Please try again.', 400);
  }

  user.emailVerified = true;
  await attachReferralToUser(user, user.referredByCode);
  user.emailVerificationPinHash = '';
  user.emailVerificationPinExpiresAt = null;
  await user.save();
  await applyReferralRewardIfEligible(user);
  await sendWelcomeEmailOnce(user);

  return user;
}

module.exports = {
  EMAIL_PIN_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  registerUser,
  authenticateUser,
  resendVerificationPin,
  requestPasswordReset,
  resetPassword,
  verifyEmailPin,
  sendWelcomeEmailOnce,
  TERMS_VERSION,
  normalizeEmail,
};
