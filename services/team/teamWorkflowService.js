const Episode = require('../../models/Episode');
const { EpisodeWorkItem } = require('../../models/EpisodeWorkItem');
const PodcastShow = require('../../models/PodcastShow');
const { COLLABORATOR_ROLES, ShowCollaborator } = require('../../models/ShowCollaborator');

const ROLE_PERMISSIONS = {
  owner: {
    canEditEpisodes: true,
    canApproveEpisodes: true,
    canViewAnalytics: true,
    canManagePublishing: true,
  },
  producer: {
    canEditEpisodes: true,
    canApproveEpisodes: true,
    canViewAnalytics: true,
    canManagePublishing: true,
  },
  editor: {
    canEditEpisodes: true,
    canApproveEpisodes: false,
    canViewAnalytics: false,
    canManagePublishing: false,
  },
  analyst: {
    canEditEpisodes: false,
    canApproveEpisodes: false,
    canViewAnalytics: true,
    canManagePublishing: false,
  },
  guest: {
    canEditEpisodes: false,
    canApproveEpisodes: false,
    canViewAnalytics: false,
    canManagePublishing: false,
  },
};

function compactText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function toLines(value, max = 12) {
  return String(value || '')
    .split('\n')
    .map((line) => compactText(line, 160))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeCollaboratorInput(body) {
  const role = COLLABORATOR_ROLES.includes(body.role) ? body.role : 'producer';

  return {
    name: compactText(body.name, 120),
    email: compactText(body.email, 200).toLowerCase(),
    role,
    status: ['invited', 'active', 'disabled'].includes(body.status) ? body.status : 'invited',
    permissions: { ...ROLE_PERMISSIONS[role] },
  };
}

function normalizeBrandKitInput(body, currentBrandKit = {}) {
  return {
    ...(currentBrandKit?.toObject ? currentBrandKit.toObject() : currentBrandKit || {}),
    positioning: compactText(body.positioning, 1000),
    voiceRules: toLines(body.voiceRules, 12),
    visualNotes: compactText(body.visualNotes, 1000),
    sponsorSafetyNotes: compactText(body.sponsorSafetyNotes, 1000),
    approvedPhrases: toLines(body.approvedPhrases, 16),
    bannedPhrases: toLines(body.bannedPhrases, 16),
  };
}

function parseDate(value) {
  if (!String(value || '').trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeWorkItemInput(body) {
  return {
    type: body.type === 'task' ? 'task' : 'comment',
    body: compactText(body.body, 2000),
    assigneeName: compactText(body.assigneeName, 120),
    dueAt: parseDate(body.dueAt),
  };
}

function normalizeApprovalInput(body) {
  const status = ['not_started', 'in_review', 'changes_requested', 'approved'].includes(body.approvalStatus)
    ? body.approvalStatus
    : 'not_started';

  return {
    status,
    notes: compactText(body.approvalNotes, 1200),
  };
}

function formatRoleLabel(role) {
  return String(role || 'producer')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildShowTeamSummary({ show, collaborators, episodes, workItems }) {
  const showId = String(show._id);
  const showEpisodes = episodes.filter((episode) => String(episode.showId?._id || episode.showId || '') === showId);
  const showCollaborators = collaborators.filter((collaborator) => String(collaborator.showId) === showId);
  const showWorkItems = workItems.filter((item) => String(item.showId || '') === showId);
  const approvals = showEpisodes.reduce((counts, episode) => {
    const status = episode.approvalWorkflow?.status || 'not_started';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  return {
    show,
    collaborators: showCollaborators.map((collaborator) => ({
      id: String(collaborator._id),
      name: collaborator.name || collaborator.email,
      email: collaborator.email,
      role: collaborator.role,
      roleLabel: formatRoleLabel(collaborator.role),
      status: collaborator.status,
      permissions: collaborator.permissions,
    })),
    brandKit: show.brandKit || {},
    metrics: {
      collaborators: showCollaborators.length,
      episodes: showEpisodes.length,
      openTasks: showWorkItems.filter((item) => item.type === 'task' && item.status === 'open').length,
      openComments: showWorkItems.filter((item) => item.type === 'comment' && item.status === 'open').length,
      approvalsInReview: approvals.in_review || 0,
      approvalsApproved: approvals.approved || 0,
      changesRequested: approvals.changes_requested || 0,
    },
    recentWorkItems: showWorkItems.slice(0, 6).map((item) => ({
      id: String(item._id),
      type: item.type,
      body: item.body,
      assigneeName: item.assigneeName,
      status: item.status,
      dueAt: item.dueAt,
    })),
    approvalQueue: showEpisodes
      .filter((episode) => ['in_review', 'changes_requested'].includes(episode.approvalWorkflow?.status))
      .slice(0, 8)
      .map((episode) => ({
        id: String(episode._id),
        title: episode.title || 'Untitled episode',
        status: episode.approvalWorkflow?.status || 'not_started',
        notes: episode.approvalWorkflow?.notes || '',
      })),
  };
}

async function buildTeamWorkflowDashboard({ userId }) {
  const shows = await PodcastShow.find({ userId }).sort({ updatedAt: -1 });
  const showIds = shows.map((show) => show._id);
  const [collaborators, episodes, workItems] = await Promise.all([
    ShowCollaborator.find({ userId, showId: { $in: showIds } }).sort({ updatedAt: -1 }),
    Episode.find({ userId, showId: { $in: showIds } }).sort({ updatedAt: -1 }).populate('showId'),
    EpisodeWorkItem.find({ userId, showId: { $in: showIds } }).sort({ updatedAt: -1 }).limit(100),
  ]);

  const showSummaries = shows.map((show) => buildShowTeamSummary({
    show,
    collaborators,
    episodes,
    workItems,
  }));

  return {
    shows: showSummaries,
    metrics: {
      shows: shows.length,
      collaborators: collaborators.length,
      openTasks: workItems.filter((item) => item.type === 'task' && item.status === 'open').length,
      approvalsInReview: episodes.filter((episode) => episode.approvalWorkflow?.status === 'in_review').length,
      changesRequested: episodes.filter((episode) => episode.approvalWorkflow?.status === 'changes_requested').length,
    },
  };
}

function buildEpisodeWorkflowPanel({ episode, workItems = [] }) {
  const approval = episode.approvalWorkflow || {};

  return {
    approval: {
      status: approval.status || 'not_started',
      notes: approval.notes || '',
      requestedAt: approval.requestedAt || null,
      reviewedAt: approval.reviewedAt || null,
    },
    openTasks: workItems.filter((item) => item.type === 'task' && item.status === 'open'),
    comments: workItems.filter((item) => item.type === 'comment'),
    recentItems: workItems.slice(0, 20),
  };
}

module.exports = {
  COLLABORATOR_ROLES,
  ROLE_PERMISSIONS,
  buildEpisodeWorkflowPanel,
  buildTeamWorkflowDashboard,
  normalizeApprovalInput,
  normalizeBrandKitInput,
  normalizeCollaboratorInput,
  normalizeWorkItemInput,
};
