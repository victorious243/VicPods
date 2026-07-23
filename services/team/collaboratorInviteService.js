const User = require('../../models/User');
const { ShowCollaborator } = require('../../models/ShowCollaborator');
const { sendShowCollaboratorInviteEmail } = require('../email/showCollaboratorInviteEmailService');
const { normalizeEmail } = require('./showAccessService');

const INVITE_TTL_DAYS = 7;

function normalizeInviteToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-f0-9]/g, '').slice(0, 64);
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

  const collaborator = await ShowCollaborator.findOne({
    inviteToken: normalizedToken,
    status: { $ne: 'disabled' },
    $or: [
      { inviteExpiresAt: null },
      { inviteExpiresAt: { $gte: now } },
    ],
  }).populate('showId');

  return collaborator || null;
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
    collaborator.inviteExpiresAt = null;
    await collaborator.save();
    return {
      collaborator,
      emailResult: { delivered: false, skipped: true },
      acceptedImmediately: false,
    };
  }

  collaborator.inviteToken = normalizeInviteToken(collaborator.inviteToken) || collaborator.schema.path('inviteToken').defaultValue();
  collaborator.inviteExpiresAt = addDays(now, INVITE_TTL_DAYS);
  collaborator.lastInviteSentAt = now;
  await collaborator.save();

  const emailResult = await sendShowCollaboratorInviteEmail({
    to: collaborator.email,
    collaboratorName: collaborator.name,
    inviterName: ownerUser.name,
    showName: show.name,
    roleLabel: formatRoleLabel(collaborator.role),
    inviteUrl: buildCollaboratorInviteUrl(collaborator.inviteToken, { appUrl }),
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
    query.inviteToken = normalizedToken;
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
  buildCollaboratorInviteUrl,
  getCollaboratorInviteByToken,
  inviteShowCollaborator,
  normalizeInviteToken,
};
