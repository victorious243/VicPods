const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const { AppError } = require('../utils/errors');
const { sendEmail } = require('./email/emailService');

const SALT_ROUNDS = 12;
const EMAIL_PIN_TTL_MINUTES = 15;
const TERMS_VERSION = 'v1.0-2026-02-25';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePin(pin) {
  return String(pin || '').trim().replace(/\D/g, '');
}

function hashVerificationPin(pin) {
  const secret = String(process.env.SESSION_SECRET || 'vicpods-pin-secret');
  return crypto
    .createHmac('sha256', secret)
    .update(String(pin || ''))
    .digest('hex');
}

function generateVerificationPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function normalizeIp(value) {
  return String(value || '')
    .trim()
    .slice(0, 80);
}

function buildPinEmail({ name, pin, appUrl }) {
  const safeName = String(name || 'there').trim() || 'there';
  const subject = 'Your VicPods verification PIN';
  const text = [
    `Hi ${safeName},`,
    '',
    'Use this PIN to activate your VicPods account:',
    `${pin}`,
    '',
    `This PIN expires in ${EMAIL_PIN_TTL_MINUTES} minutes.`,
    '',
    `Verify here: ${appUrl}/auth/verify`,
    '',
    'If you did not create this account, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111827;">
      <p>Hi ${safeName},</p>
      <p>Use this PIN to activate your VicPods account:</p>
      <p style="font-size:28px; letter-spacing:4px; font-weight:700; margin:12px 0;">${pin}</p>
      <p>This PIN expires in ${EMAIL_PIN_TTL_MINUTES} minutes.</p>
      <p><a href="${appUrl}/auth/verify">Verify your account</a></p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

async function issueVerificationPin(user) {
  const pin = generateVerificationPin();
  user.emailVerificationPinHash = hashVerificationPin(pin);
  user.emailVerificationPinExpiresAt = new Date(Date.now() + EMAIL_PIN_TTL_MINUTES * 60 * 1000);
  await user.save();

  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const message = buildPinEmail({
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
    pinDevOnly: emailResult.devFallback ? pin : null,
  };
}

async function registerUser({ name, email, password, acceptedTerms, requestIp }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = String(name || '').trim();

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
      throw new AppError('This email is pending verification. Enter the PIN sent to your inbox.', 409);
    }
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash,
    emailVerified: false,
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: TERMS_VERSION,
    termsAcceptedIp: normalizeIp(requestIp),
  });

  return issueVerificationPin(user);
}

async function authenticateUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    throw new AppError('Email and password are required.', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
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
  if (!user) {
    throw new AppError('No account found for that email.', 404);
  }

  if (user.emailVerified !== false) {
    throw new AppError('This account is already verified. Please log in.', 409);
  }

  return issueVerificationPin(user);
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

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new AppError('No account found for that email.', 404);
  }

  if (user.emailVerified !== false) {
    return user;
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
  user.emailVerificationPinHash = '';
  user.emailVerificationPinExpiresAt = null;
  await user.save();

  return user;
}

module.exports = {
  registerUser,
  authenticateUser,
  resendVerificationPin,
  verifyEmailPin,
  TERMS_VERSION,
  normalizeEmail,
};
