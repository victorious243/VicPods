const mongoose = require('mongoose');

const EVENT_TYPES = [
  'feed_request',
  'audio_download',
  'player_play',
  'player_progress',
  'player_complete',
  'share_click',
];

const podcastAnalyticsEventSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    audioAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioAsset',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    source: {
      type: String,
      enum: ['rss', 'audio', 'web_player', 'embed', 'share', 'unknown'],
      default: 'unknown',
      index: true,
    },
    platform: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    country: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    region: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    referrer: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'bot', 'unknown'],
      default: 'unknown',
    },
    userAgentHash: {
      type: String,
      default: '',
      trim: true,
      maxlength: 96,
    },
    visitorHash: {
      type: String,
      default: '',
      trim: true,
      maxlength: 96,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

podcastAnalyticsEventSchema.index({ userId: 1, occurredAt: -1 });
podcastAnalyticsEventSchema.index({ showId: 1, eventType: 1, occurredAt: -1 });
podcastAnalyticsEventSchema.index({ episodeId: 1, eventType: 1, occurredAt: -1 });

module.exports = mongoose.model('PodcastAnalyticsEvent', podcastAnalyticsEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
