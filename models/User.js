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
      trim: true,
      maxlength: 40,
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
    onboardingCompletedAt: {
      type: Date,
      default: null,
    },
    mfaEnabled: {
      type: Boolean,
      default: true,
    },
    mfaPinHash: {
      type: String,
      default: '',
      maxlength: 128,
    },
    mfaPinExpiresAt: {
      type: Date,
      default: null,
    },
    mfaLastVerifiedAt: {
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
    languagePreference: {
      type: String,
      enum: ['en', 'es', 'pt'],
      default: 'en',
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
    billingLastSyncedAt: {
      type: Date,
      default: null,
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
