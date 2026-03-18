const crypto = require('crypto');
const User = require('../../models/User');
const { AppError } = require('../../utils/errors');
const { sendEmail, getSmtpConfig } = require('../email/emailService');

const MFA_PIN_TTL_MINUTES = 10;
const DEFAULT_NEW_USER_MFA_DAYS = 14;
const MAX_NEW_USER_MFA_DAYS = 180;

function normalizePin(pin) {
  return String(pin || '').trim().replace(/\D/g, '');
}

function hashPin(pin) {
  const secret = String(process.env.SESSION_SECRET || 'vicpods-mfa-secret');
  return crypto
    .createHmac('sha256', secret)
    .update(String(pin || ''))
    .digest('hex');
}

function generatePin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function getNewUserMfaDays() {
  const raw = Number.parseInt(String(process.env.NEW_USER_MFA_DAYS || DEFAULT_NEW_USER_MFA_DAYS), 10);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_NEW_USER_MFA_DAYS;
  }
  return Math.min(raw, MAX_NEW_USER_MFA_DAYS);
}

function isWithinNewUserWindow(user) {
  if (!user || !user.createdAt) {
    return false;
  }

  const createdAt = new Date(user.createdAt).getTime();
  if (Number.isNaN(createdAt)) {
    return false;
  }

  const ageMs = Date.now() - createdAt;
  const maxAgeMs = getNewUserMfaDays() * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

function shouldRequireNewUserMfa(user) {
  if (!user) {
    return false;
  }

  if (user.emailVerified === false) {
    return false;
  }

  if (user.mfaEnabled === false) {
    return false;
  }

  if (!getSmtpConfig().isReady) {
    return false;
  }

  return isWithinNewUserWindow(user);
}

function buildMfaEmail({ name, pin, appUrl }) {
  const safeName = String(name || 'there').trim() || 'there';
  const subject = 'Your VicPods sign-in security code';
  const text = [
    `Hi ${safeName},`,
    '',
    'Use this 6-digit code to finish your sign-in:',
    pin,
    '',
    `This code expires in ${MFA_PIN_TTL_MINUTES} minutes.`,
    '',
    `Continue sign-in: ${appUrl}/auth/mfa`,
    '',
    'If this was not you, reset your password immediately.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111827;">
      <p>Hi ${safeName},</p>
      <p>Use this 6-digit code to finish your sign-in:</p>
      <p style="font-size:28px; letter-spacing:4px; font-weight:700; margin:12px 0;">${pin}</p>
      <p>This code expires in ${MFA_PIN_TTL_MINUTES} minutes.</p>
      <p><a href="${appUrl}/auth/mfa">Continue sign-in</a></p>
      <p>If this was not you, reset your password immediately.</p>
    </div>
  `;

  return { subject, text, html };
}

function maskEmail(email) {
  const value = String(email || '').trim();
  const [local = '', domain = ''] = value.split('@');
  if (!local || !domain) {
    return value;
  }

  if (local.length <= 2) {
    return `${local[0] || '*'}*@${domain}`;
  }

  const first = local[0];
  const last = local[local.length - 1];
  return `${first}${'*'.repeat(Math.min(6, Math.max(local.length - 2, 1)))}${last}@${domain}`;
}

async function issueMfaPin(user) {
  const pin = generatePin();
  user.mfaPinHash = hashPin(pin);
  user.mfaPinExpiresAt = new Date(Date.now() + MFA_PIN_TTL_MINUTES * 60 * 1000);
  await user.save();

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const message = buildMfaEmail({
    name: user.name,
    pin,
    appUrl,
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    user,
    maskedEmail: maskEmail(user.email),
    pinDevOnly: emailResult.devFallback ? pin : null,
  };
}

async function verifyMfaPin({ userId, pin }) {
  const normalizedPin = normalizePin(pin);
  if (!userId || !normalizedPin) {
    throw new AppError('Security code is required.', 400);
  }

  if (normalizedPin.length !== 6) {
    throw new AppError('Security code must be 6 digits.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('Sign-in session expired. Please log in again.', 400);
  }

  if (!shouldRequireNewUserMfa(user)) {
    user.mfaPinHash = '';
    user.mfaPinExpiresAt = null;
    await user.save();
    return user;
  }

  if (!user.mfaPinHash || !user.mfaPinExpiresAt) {
    throw new AppError('No active security code. Request a new one.', 400);
  }

  if (new Date(user.mfaPinExpiresAt).getTime() <= Date.now()) {
    throw new AppError('This security code has expired. Request a new one.', 400);
  }

  const expectedHash = hashPin(normalizedPin);
  if (user.mfaPinHash !== expectedHash) {
    throw new AppError('Invalid security code. Please try again.', 400);
  }

  user.mfaPinHash = '';
  user.mfaPinExpiresAt = null;
  user.mfaLastVerifiedAt = new Date();
  await user.save();
  return user;
}

async function resendMfaPin({ userId }) {
  if (!userId) {
    throw new AppError('Sign-in session expired. Please log in again.', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('Sign-in session expired. Please log in again.', 400);
  }

  if (!shouldRequireNewUserMfa(user)) {
    throw new AppError('Additional sign-in verification is not required for this account.', 400);
  }

  return issueMfaPin(user);
}

module.exports = {
  shouldRequireNewUserMfa,
  issueMfaPin,
  verifyMfaPin,
  resendMfaPin,
  maskEmail,
  getNewUserMfaDays,
};
