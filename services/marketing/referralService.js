const crypto = require('crypto');
const User = require('../../models/User');
const { CreatorPartner } = require('../../models/CreatorPartner');

const REFERRAL_CODE_MAX_LENGTH = 18;
const REFERRAL_BONUS_CREDITS = 10;

function normalizeAppUrl(value = process.env.APP_URL || '') {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');

  if (normalized) {
    return normalized;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_URL is required to build real referral invite links in production.');
  }

  return 'http://localhost:3000';
}

function normalizeReferralCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, REFERRAL_CODE_MAX_LENGTH);
}

function cleanReferralSeed(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!normalized) {
    return 'VICPODS';
  }

  return normalized.slice(0, 8);
}

function buildCandidate(seed) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return normalizeReferralCode(`${seed}${suffix}`);
}

async function generateUniqueReferralCode(seedInput = 'VICPODS') {
  const seed = cleanReferralSeed(seedInput);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildCandidate(seed);
    const [existingUser, existingCreator] = await Promise.all([
      User.exists({ referralCode: code }),
      CreatorPartner.exists({ referralCode: code }),
    ]);
    if (!existingUser && !existingCreator) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique referral code.');
}

async function ensureUserReferralCode(user) {
  if (!user) {
    return '';
  }

  const existingCode = normalizeReferralCode(user.referralCode);
  if (existingCode) {
    if (existingCode !== user.referralCode) {
      user.referralCode = existingCode;
      await user.save();
    }
    return existingCode;
  }

  const seed = cleanReferralSeed(user.name || user.email || 'VICPODS');
  user.referralCode = await generateUniqueReferralCode(seed);
  await user.save();
  return user.referralCode;
}

async function ensureCreatorPartnerReferralCode(partner) {
  if (!partner) {
    return '';
  }

  const existingCode = normalizeReferralCode(partner.referralCode);
  if (existingCode) {
    if (existingCode !== partner.referralCode) {
      partner.referralCode = existingCode;
      await partner.save();
    }
    return existingCode;
  }

  const seed = cleanReferralSeed(partner.name || partner.contactEmail || partner.handle || 'VICPODS');
  partner.referralCode = await generateUniqueReferralCode(seed);
  return partner.referralCode;
}

function buildReferralInviteUrl(referralCode, appUrl) {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return '';
  }

  return `${normalizeAppUrl(appUrl)}/auth/register?ref=${encodeURIComponent(normalizedCode)}`;
}

function getReferralBonusCredits(user) {
  const value = Number.parseInt(user?.referralBonusCredits, 10);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

async function resolveReferrerByCode(referralCode) {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return null;
  }

  return User.findOne({ referralCode: normalizedCode }).select('_id email referralCode referralCount referralBonusCredits');
}

async function resolveCreatorPartnerByCode(referralCode) {
  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return null;
  }

  return CreatorPartner.findOne({ referralCode: normalizedCode }).select('_id contactEmail referralCode name status');
}

async function attachReferralToUser(user, referralCode) {
  if (!user || user.referredByUserId || user.referredByCreatorPartnerId || user.referralRewardAppliedAt) {
    return null;
  }

  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return null;
  }

  const referrer = await resolveReferrerByCode(normalizedCode);
  if (!referrer) {
    return null;
  }

  if (String(referrer._id) === String(user._id)) {
    return null;
  }

  if (String(referrer.email || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase()) {
    return null;
  }

  user.referredByUserId = referrer._id;
  user.referredByCode = referrer.referralCode;
  return {
    type: 'user',
    referrer,
  };
}

async function attachCreatorPartnerReferralToUser(user, referralCode) {
  if (!user || user.referredByUserId || user.referredByCreatorPartnerId || user.referralRewardAppliedAt) {
    return null;
  }

  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return null;
  }

  const creatorPartner = await resolveCreatorPartnerByCode(normalizedCode);
  if (!creatorPartner) {
    return null;
  }

  if (
    String(creatorPartner.contactEmail || '').trim().toLowerCase()
    && String(creatorPartner.contactEmail || '').trim().toLowerCase() === String(user.email || '').trim().toLowerCase()
  ) {
    return null;
  }

  user.referredByCreatorPartnerId = creatorPartner._id;
  user.referredByCode = creatorPartner.referralCode;
  return {
    type: 'creator_partner',
    creatorPartner,
  };
}

async function attachAnyReferralToUser(user, referralCode) {
  const userReferral = await attachReferralToUser(user, referralCode);
  if (userReferral) {
    return userReferral;
  }

  return attachCreatorPartnerReferralToUser(user, referralCode);
}

async function applyReferralRewardIfEligible(user) {
  if (!user?.referredByUserId || user.referralRewardAppliedAt) {
    return {
      applied: false,
      reason: 'not_eligible',
    };
  }

  const referrer = await User.findById(user.referredByUserId);
  if (!referrer) {
    return {
      applied: false,
      reason: 'missing_referrer',
    };
  }

  if (String(referrer._id) === String(user._id)) {
    return {
      applied: false,
      reason: 'self_referral',
    };
  }

  referrer.referralCount = (Number.parseInt(referrer.referralCount, 10) || 0) + 1;
  referrer.referralBonusCredits = getReferralBonusCredits(referrer) + REFERRAL_BONUS_CREDITS;
  user.referralRewardAppliedAt = new Date();

  await Promise.all([
    referrer.save(),
    user.save(),
  ]);

  return {
    applied: true,
    referrerId: referrer._id.toString(),
    referralCount: referrer.referralCount,
    referralBonusCredits: referrer.referralBonusCredits,
  };
}

async function buildReferralProgramViewModel(user, { appUrl } = {}) {
  const referralCode = await ensureUserReferralCode(user);
  return {
    referralCode,
    inviteUrl: buildReferralInviteUrl(referralCode, appUrl),
    rewardPerReferral: REFERRAL_BONUS_CREDITS,
    referralCount: Number.parseInt(user?.referralCount, 10) || 0,
    referralBonusCredits: getReferralBonusCredits(user),
  };
}

module.exports = {
  REFERRAL_BONUS_CREDITS,
  attachReferralToUser: attachAnyReferralToUser,
  attachCreatorPartnerReferralToUser,
  applyReferralRewardIfEligible,
  buildReferralInviteUrl,
  buildReferralProgramViewModel,
  ensureCreatorPartnerReferralCode,
  ensureUserReferralCode,
  getReferralBonusCredits,
  normalizeReferralCode,
  normalizeAppUrl,
  resolveCreatorPartnerByCode,
  resolveReferrerByCode,
};
