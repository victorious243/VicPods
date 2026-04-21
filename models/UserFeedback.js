const mongoose = require('mongoose');

const FEEDBACK_TYPES = ['feedback', 'feature_request', 'bug', 'other'];
const FEEDBACK_STATUSES = ['new', 'reviewing', 'planned', 'shipped', 'closed'];
const FEEDBACK_PRIORITIES = ['low', 'normal', 'high'];

const userFeedbackSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: FEEDBACK_TYPES,
      default: 'feedback',
      index: true,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: 'new',
      index: true,
    },
    priority: {
      type: String,
      enum: FEEDBACK_PRIORITIES,
      default: 'normal',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2400,
    },
    pageContext: {
      type: String,
      default: '',
      trim: true,
      maxlength: 420,
    },
    contactEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    visitorId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
      index: true,
    },
    source: {
      type: String,
      enum: ['app', 'public'],
      default: 'app',
      index: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
      maxlength: 600,
    },
    adminNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1600,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userFeedbackSchema.index({ createdAt: -1 });
userFeedbackSchema.index({ status: 1, createdAt: -1 });
userFeedbackSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('UserFeedback', userFeedbackSchema);
module.exports.FEEDBACK_TYPES = FEEDBACK_TYPES;
module.exports.FEEDBACK_STATUSES = FEEDBACK_STATUSES;
module.exports.FEEDBACK_PRIORITIES = FEEDBACK_PRIORITIES;
