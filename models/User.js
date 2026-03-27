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
    referralCode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 18,
    },
    referredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    referredByCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 18,
    },
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralBonusCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralRewardAppliedAt: {
      type: Date,
      default: null,
    },
    billingLastSyncedAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    welcomeEmailSentAt: {
      type: Date,
      default: null,
    },
    firstEpisodeOnboardingEmailSentAt: {
      type: Date,
      default: null,
    },
    passwordResetTokenHash: {
      type: String,
      default: '',
      maxlength: 128,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
    },
    lastPaymentEmailInvoiceId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 255,
    },
    lastPaymentEmailSentAt: {
      type: Date,
      default: null,
    },
    lastPaymentFailureEmailInvoiceId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 255,
    },
    lastPaymentFailureEmailSentAt: {
      type: Date,
      default: null,
    },
    lastUsageLimitUpgradeEmailSentAt: {
      type: Date,
      default: null,
    },
    lastUsageLimitUpgradeEmailDateKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 16,
    },
    lastReEngagementEmailSentAt: {
      type: Date,
      default: null,
    },
    lastWeeklySummaryEmailSentAt: {
      type: Date,
      default: null,
    },
    lastWeeklySummaryEmailWeekKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 24,
    },
    lastAiSuggestionsEmailSentAt: {
      type: Date,
      default: null,
    },
    lastAiSuggestionsEmailWeekKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 24,
    },
    lastCreatorTipsEmailSentAt: {
      type: Date,
      default: null,
    },
    lastCreatorTipsEmailWeekKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 24,
    },
    lastTrialEndingEmailSentAt: {
      type: Date,
      default: null,
    },
    lastTrialEndingEmailKey: {
      type: String,
      default: '',
      trim: true,
      maxlength: 48,
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

userSchema.index(
  { referralCode: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      referralCode: { $type: 'string' },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
