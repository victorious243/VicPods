const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    authProvider: {
      type: String,
      enum: ['local', 'mojoauth', 'google'],
      default: 'local',
    },
    oidcSubject: {
      type: String,
      default: '',
      trim: true,
      maxlength: 255,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerificationPinHash: {
      type: String,
      default: '',
      maxlength: 128,
    },
    emailVerificationPinExpiresAt: {
      type: Date,
      default: null,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    termsAcceptedVersion: {
      type: String,
      default: '',
      maxlength: 40,
    },
    termsAcceptedIp: {
      type: String,
      default: '',
      maxlength: 80,
    },
    avatarUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    themePreference: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark',
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'premium'],
      default: 'free',
    },
    planStatus: {
      type: String,
      enum: [
        'active',
        'trialing',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused',
      ],
      default: 'canceled',
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: ['creator', 'admin'],
      default: 'creator',
    },
    aiDailyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiDailyResetDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
