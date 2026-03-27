const mongoose = require('mongoose');

const ideaPreviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: '',
      trim: true,
      maxlength: 160,
    },
    hookAngle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 320,
    },
  },
  {
    _id: false,
  }
);

const publicPreviewLeadSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      index: true,
    },
    source: {
      type: String,
      enum: ['episode_preview', 'podcast_ideas'],
      required: true,
      index: true,
    },
    sourceInput: {
      type: String,
      default: '',
      trim: true,
      maxlength: 900,
    },
    episodePreview: {
      title: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
      },
      hook: {
        type: String,
        default: '',
        trim: true,
        maxlength: 640,
      },
      outline: {
        type: [String],
        default: [],
      },
      cta: {
        type: String,
        default: '',
        trim: true,
        maxlength: 400,
      },
      launchPackTitles: {
        type: [String],
        default: [],
      },
      launchPackDescription: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
    },
    podcastIdeas: {
      niche: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
      },
      ideas: {
        type: [ideaPreviewSchema],
        default: [],
      },
    },
    captureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSavedAt: {
      type: Date,
      default: null,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

publicPreviewLeadSchema.index(
  { email: 1, source: 1 },
  {
    unique: true,
  }
);

module.exports = mongoose.model('PublicPreviewLead', publicPreviewLeadSchema);
