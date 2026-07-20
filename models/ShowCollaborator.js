const mongoose = require('mongoose');

const COLLABORATOR_ROLES = ['owner', 'producer', 'editor', 'analyst', 'guest'];
const COLLABORATOR_STATUSES = ['invited', 'active', 'disabled'];

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
  },
  {
    timestamps: true,
  }
);

showCollaboratorSchema.index({ showId: 1, email: 1 }, { unique: true });
showCollaboratorSchema.index({ userId: 1, role: 1 });

module.exports = {
  COLLABORATOR_ROLES,
  COLLABORATOR_STATUSES,
  ShowCollaborator: mongoose.model('ShowCollaborator', showCollaboratorSchema),
};
