const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { AppError } = require('../utils/errors');
const { sendEmail } = require('./email/emailService');

const SALT_ROUNDS = 12;
const EMAIL_PIN_TTL_MINUTES = 15;
const PENDING_REGISTRATION_TTL_HOURS = 24;
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

function buildPendingRegistrationExpiryDate() {
  return new Date(Date.now() + PENDING_REGISTRATION_TTL_HOURS * 60 * 60 * 1000);
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

async function sendVerificationPin({ email, name, pin }) {
  const appUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  const message = buildPinEmail({
    name,
    pin,
    appUrl,
  });

  const emailResult = await sendEmail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return {
    pinDevOnly: emailResult.devFallback ? pin : null,
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
  } else {
    user.emailVerified = true;
  }

  await pendingRegistration.deleteOne();
  return user;
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
      await PendingRegistration.deleteOne({ email: normalizedEmail });
      existingUser.name = normalizedName;
      existingUser.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      existingUser.termsAcceptedAt = new Date();
      existingUser.termsAcceptedVersion = TERMS_VERSION;
      existingUser.termsAcceptedIp = normalizeIp(requestIp);
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
  user.emailVerificationPinHash = '';
  user.emailVerificationPinExpiresAt = null;
  await user.save();

  return user;
}

module.exports = {
  EMAIL_PIN_TTL_MINUTES,
  registerUser,
  authenticateUser,
  resendVerificationPin,
  verifyEmailPin,
  TERMS_VERSION,
  normalizeEmail,
};
