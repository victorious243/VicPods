const mongoose = require('mongoose');

const WORK_ITEM_TYPES = ['comment', 'task'];
const WORK_ITEM_STATUSES = ['open', 'resolved'];

const episodeWorkItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    episodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Episode',
      required: true,
      index: true,
    },
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PodcastShow',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: WORK_ITEM_TYPES,
      default: 'comment',
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    assigneeName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    dueAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: WORK_ITEM_STATUSES,
      default: 'open',
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

episodeWorkItemSchema.index({ episodeId: 1, status: 1, createdAt: -1 });
episodeWorkItemSchema.index({ userId: 1, status: 1, dueAt: 1 });

module.exports = {
  EpisodeWorkItem: mongoose.model('EpisodeWorkItem', episodeWorkItemSchema),
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
};
