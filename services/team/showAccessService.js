const PodcastShow = require('../../models/PodcastShow');
const { ShowCollaborator } = require('../../models/ShowCollaborator');

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function collaboratorToAccess(collaborator) {
  if (!collaborator) {
    return null;
  }

  return {
    isOwner: false,
    role: collaborator.role,
    roleLabel: String(collaborator.role || 'collaborator')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    status: collaborator.status,
    permissions: {
      canEditEpisodes: Boolean(collaborator.permissions?.canEditEpisodes),
      canApproveEpisodes: Boolean(collaborator.permissions?.canApproveEpisodes),
      canViewAnalytics: Boolean(collaborator.permissions?.canViewAnalytics),
      canManagePublishing: Boolean(collaborator.permissions?.canManagePublishing),
    },
    collaborator,
  };
}

async function listAccessibleShowsForUser(userId) {
  const [ownedShows, collaboratorLinks] = await Promise.all([
    PodcastShow.find({ userId }).sort({ updatedAt: -1 }),
    ShowCollaborator.find({
      acceptedUserId: userId,
      status: 'active',
    }).sort({ updatedAt: -1 }),
  ]);

  const ownedShowIds = new Set(ownedShows.map((show) => String(show._id)));
  const collaboratorShowIds = collaboratorLinks
    .map((collaborator) => collaborator.showId)
    .filter((showId) => showId && !ownedShowIds.has(String(showId)));

  const collaboratorShows = collaboratorShowIds.length
    ? await PodcastShow.find({ _id: { $in: collaboratorShowIds } }).sort({ updatedAt: -1 })
    : [];

  return {
    shows: [...ownedShows, ...collaboratorShows],
    collaboratorLinks,
  };
}

async function getShowAccessForUser({ userId, showId }) {
  const show = await PodcastShow.findById(showId);
  if (!show) {
    return { show: null, access: null };
  }

  if (String(show.userId) === String(userId)) {
    return {
      show,
      access: {
        isOwner: true,
        role: 'owner',
        status: 'active',
        permissions: {
          canEditEpisodes: true,
          canApproveEpisodes: true,
          canViewAnalytics: true,
          canManagePublishing: true,
        },
        collaborator: null,
      },
    };
  }

  const collaborator = await ShowCollaborator.findOne({
    showId,
    acceptedUserId: userId,
    status: 'active',
  });

  return {
    show,
    access: collaboratorToAccess(collaborator),
  };
}

async function getCollaboratorAccessForShowMap(userId, showIds = []) {
  const collaboratorLinks = await ShowCollaborator.find({
    acceptedUserId: userId,
    status: 'active',
    showId: { $in: showIds },
  });

  const accessByShowId = new Map();
  collaboratorLinks.forEach((collaborator) => {
    accessByShowId.set(String(collaborator.showId), collaboratorToAccess(collaborator));
  });

  return accessByShowId;
}

module.exports = {
  getCollaboratorAccessForShowMap,
  getShowAccessForUser,
  listAccessibleShowsForUser,
  normalizeEmail,
};
