const User = require('../../models/User');
const { CreatorPartner, CREATOR_PARTNER_STATUSES } = require('../../models/CreatorPartner');
const {
  buildReferralInviteUrl,
  ensureCreatorPartnerReferralCode,
} = require('./referralService');
const { AppError } = require('../../utils/errors');

const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing']);
const DEFAULT_CREATOR_PREMIUM_DAYS = 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText(value, maxLength = 160) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeStatus(value) {
  const normalized = cleanText(value, 40).toLowerCase();
  return CREATOR_PARTNER_STATUSES.includes(normalized) ? normalized : 'contacted';
}

function normalizeFollowerCount(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function normalizeHandle(value) {
  const trimmed = cleanText(value, 80);
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

async function syncAssignedUser(partner) {
  const contactEmail = normalizeEmail(partner.contactEmail);
  if (!contactEmail) {
    partner.assignedUserId = null;
    return null;
  }

  const user = await User.findOne({ email: contactEmail }).select('_id email role plan planStatus currentPeriodEnd');
  partner.assignedUserId = user?._id || null;
  return user;
}

function buildCreatorPartnerInviteUrl(partner, { appUrl } = {}) {
  return buildReferralInviteUrl(partner?.referralCode, appUrl);
}

async function upsertCreatorPartnerFromAdmin({ partnerId, body, adminUser }) {
  const existingPartner = partnerId
    ? await CreatorPartner.findById(partnerId)
    : null;

  const partner = existingPartner || new CreatorPartner({
    createdByUserId: adminUser?._id || null,
  });

  const name = cleanText(body.name, 80);
  if (!name) {
    throw new AppError('Creator name is required.', 400);
  }

  partner.name = name;
  partner.contactEmail = normalizeEmail(body.contactEmail);
  partner.platform = cleanText(body.platform, 40);
  partner.handle = normalizeHandle(body.handle);
  partner.followerCount = normalizeFollowerCount(body.followerCount);
  partner.audienceNiche = cleanText(body.audienceNiche, 160);
  partner.status = normalizeStatus(body.status);
  partner.notes = cleanText(body.notes, 2400);

  if (String(body.markContacted || '').trim() === 'on') {
    partner.lastContactedAt = new Date();
  }

  await syncAssignedUser(partner);
  await ensureCreatorPartnerReferralCode(partner);
  await partner.save();

  return partner;
}

function hasActivePaidAccess(user, now = new Date()) {
  if (!user) {
    return false;
  }

  if (!ACTIVE_BILLING_STATUSES.has(String(user.planStatus || '').toLowerCase())) {
    return false;
  }

  if (!user.currentPeriodEnd) {
    return false;
  }

  return new Date(user.currentPeriodEnd).getTime() > now.getTime();
}

async function grantCreatorPartnerPremiumAccess({ partnerId, adminUser, durationDays = DEFAULT_CREATOR_PREMIUM_DAYS }) {
  const partner = await CreatorPartner.findById(partnerId);
  if (!partner) {
    throw new AppError('Creator partner not found.', 404);
  }

  const user = await syncAssignedUser(partner) || (partner.assignedUserId
    ? await User.findById(partner.assignedUserId)
    : null);

  if (!user) {
    throw new AppError('This creator does not have a VicPods account yet. Ask them to sign up first with the same email.', 400);
  }

  if (user.role === 'admin') {
    throw new AppError('Admin accounts cannot be granted creator premium access.', 400);
  }

  const now = new Date();
  const hasPaidAccess = hasActivePaidAccess(user, now);

  if (hasPaidAccess && user.plan !== 'premium') {
    throw new AppError('This creator already has an active paid subscription. Keep billing unchanged or upgrade them directly in Stripe.', 400);
  }

  const expiresAt = hasPaidAccess
    ? new Date(user.currentPeriodEnd)
    : new Date(now.getTime() + (Math.max(1, durationDays) * 24 * 60 * 60 * 1000));

  if (!hasPaidAccess) {
    user.plan = 'premium';
    user.planStatus = 'trialing';
    user.currentPeriodStart = now;
    user.currentPeriodEnd = expiresAt;
    user.cancelAtPeriodEnd = true;
    await user.save();
  }

  partner.assignedUserId = user._id;
  partner.premiumAccessGrantedAt = now;
  partner.premiumAccessExpiresAt = expiresAt;
  if (['contacted', 'interested', 'access_sent'].includes(partner.status)) {
    partner.status = 'testing';
  }
  partner.lastContactedAt = now;
  if (!partner.createdByUserId && adminUser?._id) {
    partner.createdByUserId = adminUser._id;
  }
  await partner.save();

  return {
    partner,
    user,
    expiresAt,
    alreadyActive: hasPaidAccess,
  };
}

module.exports = {
  CreatorPartner,
  CREATOR_PARTNER_STATUSES,
  DEFAULT_CREATOR_PREMIUM_DAYS,
  buildCreatorPartnerInviteUrl,
  upsertCreatorPartnerFromAdmin,
  grantCreatorPartnerPremiumAccess,
  normalizeStatus,
};
