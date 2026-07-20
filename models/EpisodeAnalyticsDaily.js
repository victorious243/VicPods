const mongoose = require('mongoose');

const episodeAnalyticsDailySchema = new mongoose.Schema(
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
    episodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Episode',
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
      index: true,
    },
    feedRequests: {
      type: Number,
      default: 0,
      min: 0,
    },
    audioDownloads: {
      type: Number,
      default: 0,
      min: 0,
    },
    playerPlays: {
      type: Number,
      default: 0,
      min: 0,
    },
    playerCompletions: {
      type: Number,
      default: 0,
      min: 0,
    },
    shareClicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    platforms: {
      type: Map,
      of: Number,
      default: {},
    },
    countries: {
      type: Map,
      of: Number,
      default: {},
    },
    referrers: {
      type: Map,
      of: Number,
      default: {},
    },
    devices: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

episodeAnalyticsDailySchema.index({ userId: 1, dateKey: -1 });
episodeAnalyticsDailySchema.index({ episodeId: 1, dateKey: -1 }, { unique: true });
episodeAnalyticsDailySchema.index({ showId: 1, dateKey: -1 });

module.exports = mongoose.model('EpisodeAnalyticsDaily', episodeAnalyticsDailySchema);
