const crypto = require('crypto');
const User = require('../../models/User');
const { ShowCollaborator, createInviteToken } = require('../../models/ShowCollaborator');
const { sendShowCollaboratorInviteEmail } = require('../email/showCollaboratorInviteEmailService');
const {
  getEffectiveHostingPlanForBilling,
} = require('../billing/usageLimitsService');
const {
  getPlanDefinition,
  getWorkspacePlanForLegacyPlan,
  normalizeWorkspacePlan,
} = require('../billing/planCatalog');
const { normalizeEmail } = require('./showAccessService');
const { AppError } = require('../../utils/errors');

const INVITE_TTL_DAYS = 7;
const BILLING_ACTIVE_STATUSES = new Set(['active', 'trialing']);

function normalizeInviteToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64);
}

function hashInviteToken(inviteToken) {
  const normalizedToken = normalizeInviteToken(inviteToken);
  if (!normalizedToken) {
    return '';
  }

  return crypto.createHash('sha256').update(normalizedToken).digest('hex');
}

function buildCollaboratorInviteUrl(token, { appUrl } = {}) {
  const baseUrl = String(appUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${baseUrl}/auth/collaborator-invite/${encodeURIComponent(token)}`;
}

function addDays(now, days) {
  return new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
}

function formatRoleLabel(role) {
  return String(role || 'producer')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function getCollaboratorInviteByToken(inviteToken, { now = new Date() } = {}) {
  const normalizedToken = normalizeInviteToken(inviteToken);
  if (!normalizedToken) {
    return null;
  }
  const inviteTokenHash = hashInviteToken(normalizedToken);

  const collaborator = await ShowCollaborator.findOne({
    status: { $ne: 'disabled' },
    acceptedUserId: null,
    $and: [
      {
        $or: [
          { inviteTokenHash },
          { inviteToken: normalizedToken },
        ],
      },
      {
        $or: [
          { inviteExpiresAt: null },
          { inviteExpiresAt: { $gte: now } },
        ],
      },
    ],
  }).populate('showId');

  return collaborator || null;
}

function hasActiveBillingStatus(status, periodEnd, now = new Date()) {
  if (!BILLING_ACTIVE_STATUSES.has(String(status || '').trim().toLowerCase())) {
    return false;
  }

  if (!periodEnd) {
    return false;
  }

  return new Date(periodEnd).getTime() > now.getTime();
}

function getEffectiveWorkspacePlanForCollaborators(user, now = new Date()) {
  const legacyWorkspacePlan = getWorkspacePlanForLegacyPlan(user?.plan);
  const explicitWorkspacePlan = normalizeWorkspacePlan(user?.workspacePlan);
  const storedWorkspacePlan = explicitWorkspacePlan === 'free' && legacyWorkspacePlan !== 'free'
    ? legacyWorkspacePlan
    : explicitWorkspacePlan;

  if (storedWorkspacePlan === 'free') {
    return 'free';
  }

  const workspaceActive = hasActiveBillingStatus(
    user?.workspacePlanStatus || user?.planStatus,
    user?.workspaceCurrentPeriodEnd || user?.currentPeriodEnd,
    now
  );

  return workspaceActive ? storedWorkspacePlan : 'free';
}

function getCollaboratorSeatLimitForUser(user, now = new Date()) {
  const workspacePlan = getEffectiveWorkspacePlanForCollaborators(user, now);
  const hostingActive = hasActiveBillingStatus(
    user?.hostingPlanStatus,
    user?.hostingCurrentPeriodEnd,
    now
  );
  const effectiveHostingPlan = getEffectiveHostingPlanForBilling({
    workspacePlan,
    hostingPlan: user?.hostingPlan || 'none',
    hostingActive,
  });
  const hostingLimit = getPlanDefinition('hosting', effectiveHostingPlan).limits.collaborators || 0;
  const workspaceLimit = getPlanDefinition('workspace', workspacePlan).limits.collaborators || 0;

  return Math.max(hostingLimit, workspaceLimit);
}

async function assertCollaboratorSeatAvailable({ ownerUser, showId, email, now = new Date() }) {
  if (ownerUser?.role === 'admin') {
    return {
      allowed: true,
      used: 0,
      limit: Infinity,
    };
  }

  const limit = getCollaboratorSeatLimitForUser(ownerUser, now);
  if (limit === Infinity) {
    return {
      allowed: true,
      used: 0,
      limit,
    };
  }

  const existingCollaborator = await ShowCollaborator.findOne({
    userId: ownerUser._id,
    showId,
    email,
    status: { $in: ['invited', 'active'] },
  }).select('_id');

  if (existingCollaborator) {
    return {
      allowed: true,
      used: null,
      limit,
    };
  }

  const used = await ShowCollaborator.countDocuments({
    userId: ownerUser._id,
    status: { $in: ['invited', 'active'] },
  });

  if (used >= limit) {
    throw new AppError(`Your current plan includes ${limit} collaborator seat${limit === 1 ? '' : 's'}. Upgrade hosting or workspace seats before inviting another person.`, 403);
  }

  return {
    allowed: true,
    used,
    limit,
  };
}

async function inviteShowCollaborator({
  ownerUser,
  show,
  input,
  appUrl,
  now = new Date(),
}) {
  const email = normalizeEmail(input.email);
  const existingUser = email ? await User.findOne({ email }).select('_id email name') : null;

  await assertCollaboratorSeatAvailable({
    ownerUser,
    showId: show._id,
    email,
    now,
  });

  const collaborator = await ShowCollaborator.findOne({
    userId: ownerUser._id,
    showId: show._id,
    email,
  }) || new ShowCollaborator({
    userId: ownerUser._id,
    showId: show._id,
    email,
    invitedAt: now,
  });

  collaborator.name = input.name;
  collaborator.role = input.role;
  collaborator.permissions = input.permissions;
  collaborator.invitedByUserId = ownerUser._id;
  collaborator.inviteMessage = String(input.inviteMessage || '').trim().slice(0, 500);

  const sameUser = existingUser && String(existingUser._id) === String(ownerUser._id);
  if (sameUser) {
    collaborator.acceptedUserId = ownerUser._id;
    collaborator.acceptedAt = now;
    collaborator.status = 'active';
    collaborator.inviteToken = '';
    collaborator.inviteTokenHash = '';
    collaborator.inviteExpiresAt = null;
    await collaborator.save();
    return {
      collaborator,
      emailResult: { delivered: false, skipped: true },
      acceptedImmediately: true,
    };
  }

  collaborator.status = input.status === 'disabled' ? 'disabled' : 'invited';
  collaborator.acceptedUserId = existingUser && input.status === 'active' ? existingUser._id : collaborator.acceptedUserId || null;
  collaborator.acceptedAt = collaborator.acceptedUserId && input.status === 'active' ? (collaborator.acceptedAt || now) : null;

  if (collaborator.status === 'disabled') {
    collaborator.inviteToken = '';
    collaborator.inviteTokenHash = '';
    collaborator.inviteExpiresAt = null;
    await collaborator.save();
    return {
      collaborator,
      emailResult: { delivered: false, skipped: true },
      acceptedImmediately: false,
    };
  }

  const rawInviteToken = createInviteToken();
  collaborator.inviteToken = '';
  collaborator.inviteTokenHash = hashInviteToken(rawInviteToken);
  collaborator.inviteExpiresAt = addDays(now, INVITE_TTL_DAYS);
  collaborator.lastInviteSentAt = now;
  await collaborator.save();

  const emailResult = await sendShowCollaboratorInviteEmail({
    to: collaborator.email,
    collaboratorName: collaborator.name,
    inviterName: ownerUser.name,
    showName: show.name,
    roleLabel: formatRoleLabel(collaborator.role),
    inviteUrl: buildCollaboratorInviteUrl(rawInviteToken, { appUrl }),
    inviteMessage: collaborator.inviteMessage,
  });

  return {
    collaborator,
    emailResult,
    acceptedImmediately: false,
  };
}

async function acceptPendingCollaboratorInvitesForUser(user, {
  inviteToken = '',
  now = new Date(),
} = {}) {
  const email = normalizeEmail(user?.email);
  if (!user?._id || !email) {
    return { acceptedCount: 0, mismatch: false, invites: [] };
  }

  const normalizedToken = normalizeInviteToken(inviteToken);
  const query = {
    email,
    status: { $ne: 'disabled' },
  };

  if (normalizedToken) {
    query.$and = [
      {
        $or: [
          { inviteTokenHash: hashInviteToken(normalizedToken) },
          { inviteToken: normalizedToken },
        ],
      },
      {
        $or: [
          { inviteExpiresAt: null },
          { inviteExpiresAt: { $gte: now } },
        ],
      },
    ];
  }

  const pendingInvites = await ShowCollaborator.find(query).populate('showId');
  if (!pendingInvites.length && normalizedToken) {
    const mismatchedInvite = await getCollaboratorInviteByToken(normalizedToken, { now });
    if (mismatchedInvite && normalizeEmail(mismatchedInvite.email) !== email) {
      return {
        acceptedCount: 0,
        mismatch: true,
        invites: [],
        expectedEmail: mismatchedInvite.email,
        showName: mismatchedInvite.showId?.name || '',
      };
    }
  }

  const acceptedInvites = [];
  for (const collaborator of pendingInvites) {
    collaborator.acceptedUserId = user._id;
    collaborator.acceptedAt = now;
    collaborator.status = 'active';
    collaborator.inviteToken = '';
    collaborator.inviteTokenHash = '';
    collaborator.inviteExpiresAt = null;
    await collaborator.save();
    acceptedInvites.push(collaborator);
  }

  return {
    acceptedCount: acceptedInvites.length,
    mismatch: false,
    invites: acceptedInvites,
  };
}

module.exports = {
  acceptPendingCollaboratorInvitesForUser,
  assertCollaboratorSeatAvailable,
  buildCollaboratorInviteUrl,
  getCollaboratorInviteByToken,
  getCollaboratorSeatLimitForUser,
  hashInviteToken,
  inviteShowCollaborator,
  normalizeInviteToken,
};
