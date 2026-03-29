const mongoose = require('mongoose');

const EVENT_TYPES = [
  'page_view',
  'signup_started',
  'signup_completed',
  'login_success',
  'login_mfa_required',
  'logout',
  'public_episode_preview_generated',
  'public_podcast_ideas_generated',
  'public_preview_saved',
  'public_preview_exported',
  'episode_created',
  'episode_draft_generated',
  'billing_page_viewed',
  'billing_checkout_started',
  'billing_checkout_completed',
];

const AUTH_PROVIDERS = ['local', 'google', 'unknown'];

const appActivityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
      index: true,
    },
    visitorId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
      index: true,
    },
    sessionId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
      index: true,
    },
    requestPath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
      index: true,
    },
    method: {
      type: String,
      default: 'GET',
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    statusCode: {
      type: Number,
      default: null,
      min: 100,
      max: 599,
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
      index: true,
    },
    forwardedFor: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
      maxlength: 600,
    },
    referer: {
      type: String,
      default: '',
      trim: true,
      maxlength: 600,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    userRole: {
      type: String,
      default: 'guest',
      trim: true,
      maxlength: 40,
    },
    authProvider: {
      type: String,
      enum: AUTH_PROVIDERS,
      default: 'unknown',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

appActivityEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AppActivityEvent', appActivityEventSchema);
