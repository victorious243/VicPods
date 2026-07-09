const crypto = require('crypto');
const { TrialInvite, TRIAL_INVITE_PLANS } = require('../../models/TrialInvite');
const { AppError } = require('../../utils/errors');

const TRIAL_INVITE_CODE_MAX_LENGTH = 24;
const DEFAULT_TESTER_TRIAL_DAYS = 14;
const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing']);

function normalizeAppUrl(value = process.env.APP_URL || '') {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');

  if (normalized) {
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL is required to build real tester trial links in production.');
  }

  return 'http://localhost:3000';
}

function normalizeTrialInviteCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, TRIAL_INVITE_CODE_MAX_LENGTH);
}

function cleanText(value, maxLength = 160) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanSeed(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return (normalized || 'TEST').slice(0, 10);
}

function normalizePlan(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return TRIAL_INVITE_PLANS.includes(normalized) ? normalized : 'premium';
}

function normalizeDurationDays(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TESTER_TRIAL_DAYS;
  }

  return Math.min(90, Math.max(1, parsed));
}

function normalizeMaxRedemptions(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(10000, parsed);
}

function normalizeExpiryDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function buildCandidateCode(seed) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return normalizeTrialInviteCode(`${seed}${suffix}`);
}

async function generateUniqueTrialInviteCode(seedInput = 'TEST') {
  const seed = cleanSeed(seedInput);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildCandidateCode(seed);
    const existing = await TrialInvite.exists({ code });
    if (!existing) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique tester trial code.');
}

function buildTrialInviteUrl(code, appUrl) {
  const normalizedCode = normalizeTrialInviteCode(code);
  if (!normalizedCode) {
    return '';
  }

  return `${normalizeAppUrl(appUrl)}/auth/register?trial=${encodeURIComponent(normalizedCode)}`;
}

function hasActivePaidAccess(user, now = new Date()) {
  if (!user || user.plan === 'free') {
    return false;
  }

  if (!ACTIVE_BILLING_STATUSES.has(String(user.planStatus || '').trim().toLowerCase())) {
    return false;
  }

  if (!user.currentPeriodEnd) {
    return false;
  }

  return new Date(user.currentPeriodEnd).getTime() > now.getTime();
}

function getTesterTrialExpiry(user) {
  if (!user) {
    return null;
  }

  const expiry = user.testerTrialExpiresAt || user.currentPeriodEnd || null;
  if (!expiry) {
    return null;
  }

  const expiryDate = new Date(expiry);
  return Number.isNaN(expiryDate.getTime()) ? null : expiryDate;
}

async function enforceTesterTrialExpiry(user, { now = new Date() } = {}) {
  if (!user || user.role === 'admin') {
    return { expired: false, reason: 'missing_or_admin' };
  }

  if (!user.testerTrialInviteId && !user.testerTrialGrantedAt) {
    return { expired: false, reason: 'not_tester_trial' };
  }

  if (user.stripeSubscriptionId) {
    return { expired: false, reason: 'stripe_subscription_linked' };
  }

  if (String(user.planStatus || '').trim().toLowerCase() !== 'trialing') {
    return { expired: false, reason: 'not_trialing' };
  }

  const expiryDate = getTesterTrialExpiry(user);
  if (!expiryDate || expiryDate.getTime() > now.getTime()) {
    return { expired: false, reason: 'still_active', expiresAt: expiryDate };
  }

  user.plan = 'free';
  user.planStatus = 'canceled';
  user.currentPeriodEnd = expiryDate;
  user.cancelAtPeriodEnd = false;
  await user.save();

  return { expired: true, reason: 'tester_trial_expired', expiresAt: expiryDate };
}

function isInviteRedeemable(invite, now = new Date()) {
  if (!invite) {
    return { allowed: false, reason: 'missing' };
  }

  if (!invite.active) {
    return { allowed: false, reason: 'inactive' };
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now.getTime()) {
    return { allowed: false, reason: 'expired' };
  }

  const maxRedemptions = Number.parseInt(invite.maxRedemptions, 10) || 0;
  const redeemedCount = Number.parseInt(invite.redeemedCount, 10) || 0;
  if (maxRedemptions > 0 && redeemedCount >= maxRedemptions) {
    return { allowed: false, reason: 'fully_redeemed' };
  }

  return { allowed: true, reason: 'ok' };
}

async function createTesterTrialInviteFromAdmin({ body, adminUser }) {
  const name = cleanText(body.name, 100);
  if (!name) {
    throw new AppError('Trial name is required.', 400);
  }

  const invite = new TrialInvite({
    name,
    code: await generateUniqueTrialInviteCode(name),
    plan: normalizePlan(body.plan),
    durationDays: normalizeDurationDays(body.durationDays),
    maxRedemptions: normalizeMaxRedemptions(body.maxRedemptions),
    expiresAt: normalizeExpiryDate(body.expiresAt),
    notes: cleanText(body.notes, 1200),
    active: true,
    createdByUserId: adminUser?._id || null,
  });

  await invite.save();
  return invite;
}

async function toggleTesterTrialInvite({ inviteId }) {
  const invite = await TrialInvite.findById(inviteId);
  if (!invite) {
    throw new AppError('Tester trial invite not found.', 404);
  }

  invite.active = !invite.active;
  await invite.save();
  return invite;
}

async function recordTesterTrialInviteEmailSent({ inviteId, email }) {
  const invite = await TrialInvite.findById(inviteId);
  if (!invite) {
    throw new AppError('Tester trial invite not found.', 404);
  }

  invite.inviteEmailSentCount = (Number.parseInt(invite.inviteEmailSentCount, 10) || 0) + 1;
  invite.lastInviteEmailSentAt = new Date();
  invite.lastInviteEmailSentTo = normalizeEmail(email);
  await invite.save();
  return invite;
}

async function applyTrialInviteToUser(user, trialInviteCode, { now = new Date() } = {}) {
  if (!user) {
    return { applied: false, reason: 'missing_user' };
  }

  const code = normalizeTrialInviteCode(trialInviteCode);
  if (!code) {
    return { applied: false, reason: 'missing_code' };
  }

  if (user.role === 'admin') {
    return { applied: false, reason: 'admin_user' };
  }

  if (user.testerTrialInviteId || user.testerTrialGrantedAt) {
    return { applied: false, reason: 'already_redeemed' };
  }

  if (hasActivePaidAccess(user, now)) {
    return { applied: false, reason: 'active_paid_access' };
  }

  const invite = await TrialInvite.findOne({ code });
  const redeemable = isInviteRedeemable(invite, now);
  if (!redeemable.allowed) {
    return {
      applied: false,
      reason: redeemable.reason,
      invite,
    };
  }

  const durationDays = normalizeDurationDays(invite.durationDays);
  const expiresAt = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));

  user.plan = normalizePlan(invite.plan);
  user.planStatus = 'trialing';
  user.currentPeriodStart = now;
  user.currentPeriodEnd = expiresAt;
  user.cancelAtPeriodEnd = true;
  user.testerTrialInviteId = invite._id;
  user.testerTrialCode = invite.code;
  user.testerTrialGrantedAt = now;
  user.testerTrialExpiresAt = expiresAt;

  invite.redeemedCount = (Number.parseInt(invite.redeemedCount, 10) || 0) + 1;
  invite.lastRedeemedAt = now;

  await Promise.all([
    user.save(),
    invite.save(),
  ]);

  return {
    applied: true,
    invite,
    plan: user.plan,
    expiresAt,
  };
}

async function listTesterTrialInvitesForAdmin({ appUrl } = {}) {
  const now = new Date();
  const invites = await TrialInvite.find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(50)
    .lean();

  return invites.map((invite) => {
    const redeemable = isInviteRedeemable(invite, now);
    const maxRedemptions = Number.parseInt(invite.maxRedemptions, 10) || 0;
    const redeemedCount = Number.parseInt(invite.redeemedCount, 10) || 0;

    return {
      ...invite,
      inviteUrl: buildTrialInviteUrl(invite.code, appUrl),
      statusLabel: redeemable.allowed ? 'Active' : redeemable.reason.replace(/_/g, ' '),
      isRedeemable: redeemable.allowed,
      remainingRedemptions: maxRedemptions > 0 ? Math.max(0, maxRedemptions - redeemedCount) : null,
    };
  });
}

module.exports = {
  DEFAULT_TESTER_TRIAL_DAYS,
  TRIAL_INVITE_PLANS,
  applyTrialInviteToUser,
  buildTrialInviteUrl,
  createTesterTrialInviteFromAdmin,
  enforceTesterTrialExpiry,
  listTesterTrialInvitesForAdmin,
  normalizeTrialInviteCode,
  recordTesterTrialInviteEmailSent,
  toggleTesterTrialInvite,
};
