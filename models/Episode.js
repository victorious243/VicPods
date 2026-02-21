const mongoose = require('mongoose');

const episodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
      index: true,
    },
    themeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theme',
      required: true,
      index: true,
    },
    episodeNumberWithinTheme: {
      type: Number,
      required: true,
      min: 1,
    },
    // Legacy compatibility field kept to avoid index conflicts on older databases.
    // Mirrors globalEpisodeNumber when available.
    episodeNumber: {
      type: Number,
      min: 1,
      default: null,
    },
    globalEpisodeNumber: {
      type: Number,
      min: 1,
      default: null,
    },
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    status: {
      type: String,
      enum: ['Planned', 'Draft', 'Ready', 'Served'],
      default: 'Planned',
    },
    hook: {
      type: String,
      default: '',
      trim: true,
      maxlength: 600,
    },
    outline: {
      type: [String],
      default: [],
    },
    talkingPoints: {
      type: [String],
      default: [],
    },
    hostQuestions: {
      type: [String],
      default: [],
    },
    funSegment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 800,
    },
    ending: {
      type: String,
      default: '',
      trim: true,
      maxlength: 800,
    },
    endState: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    transcript: {
      type: String,
      default: '',
    },
    transcriptUpdatedAt: {
      type: Date,
      default: null,
    },
    ideaIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Idea',
      },
    ],
  },
  {
    timestamps: true,
  }
);

episodeSchema.index(
  { userId: 1, themeId: 1, episodeNumberWithinTheme: 1 },
  {
    unique: true,
    partialFilterExpression: {
      themeId: { $exists: true },
      episodeNumberWithinTheme: { $exists: true },
    },
  }
);

episodeSchema.index(
  { userId: 1, seriesId: 1, globalEpisodeNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      globalEpisodeNumber: { $type: 'number' },
    },
  }
);

module.exports = mongoose.model('Episode', episodeSchema);
