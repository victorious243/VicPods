const mongoose = require('mongoose');

const ADMIN_ACCESS_OUTCOMES = [
  'redirect_login',
  'redirect_verify',
  'denied_guest',
  'denied_unverified',
  'denied_role',
  'denied_key',
  'denied_config',
  'granted',
  'granted_dev',
];

const adminAccessLogSchema = new mongoose.Schema(
  {
    outcome: {
      type: String,
      enum: ADMIN_ACCESS_OUTCOMES,
      required: true,
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
    hasAdminKey: {
      type: Boolean,
      default: false,
    },
    keySource: {
      type: String,
      enum: ['none', 'query', 'header'],
      default: 'none',
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
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

adminAccessLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAccessLog', adminAccessLogSchema);
