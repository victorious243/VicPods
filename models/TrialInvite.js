const mongoose = require('mongoose');

const TRIAL_INVITE_PLANS = ['pro', 'premium'];

const trialInviteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 24,
    },
    plan: {
      type: String,
      enum: TRIAL_INVITE_PLANS,
      default: 'premium',
    },
    durationDays: {
      type: Number,
      default: 14,
      min: 1,
      max: 90,
    },
    maxRedemptions: {
      type: Number,
      default: 0,
      min: 0,
    },
    redeemedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastRedeemedAt: {
      type: Date,
      default: null,
    },
    inviteEmailSentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastInviteEmailSentAt: {
      type: Date,
      default: null,
    },
    lastInviteEmailSentTo: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = {
  TrialInvite: mongoose.model('TrialInvite', trialInviteSchema),
  TRIAL_INVITE_PLANS,
};
