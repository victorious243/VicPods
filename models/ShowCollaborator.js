const mongoose = require('mongoose');
const crypto = require('crypto');

const COLLABORATOR_ROLES = ['owner', 'producer', 'editor', 'analyst', 'guest'];
const COLLABORATOR_STATUSES = ['invited', 'active', 'disabled'];

function createInviteToken() {
  return crypto.randomBytes(24).toString('hex');
}

const showCollaboratorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PodcastShow',
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    role: {
      type: String,
      enum: COLLABORATOR_ROLES,
      default: 'producer',
      index: true,
    },
    status: {
      type: String,
      enum: COLLABORATOR_STATUSES,
      default: 'invited',
      index: true,
    },
    permissions: {
      canEditEpisodes: {
        type: Boolean,
        default: true,
      },
      canApproveEpisodes: {
        type: Boolean,
        default: false,
      },
      canViewAnalytics: {
        type: Boolean,
        default: false,
      },
      canManagePublishing: {
        type: Boolean,
        default: false,
      },
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    acceptedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    inviteToken: {
      type: String,
      default: '',
      trim: true,
      maxlength: 64,
      index: true,
    },
    inviteTokenHash: {
      type: String,
      default: '',
      trim: true,
      maxlength: 64,
      index: true,
    },
    inviteExpiresAt: {
      type: Date,
      default: null,
    },
    lastInviteSentAt: {
      type: Date,
      default: null,
    },
    inviteMessage: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

showCollaboratorSchema.index({ showId: 1, email: 1 }, { unique: true });
showCollaboratorSchema.index({ userId: 1, role: 1 });
showCollaboratorSchema.index({ acceptedUserId: 1, status: 1 });
showCollaboratorSchema.index({ inviteTokenHash: 1, status: 1 });

module.exports = {
  COLLABORATOR_ROLES,
  COLLABORATOR_STATUSES,
  createInviteToken,
  ShowCollaborator: mongoose.model('ShowCollaborator', showCollaboratorSchema),
};
