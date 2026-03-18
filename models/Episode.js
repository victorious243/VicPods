const mongoose = require('mongoose');
const { TONE_PRESET_NAMES } = require('../services/tone/tonePresets');
const {
  CTA_STYLE_VALUES,
  FORMAT_TEMPLATE_VALUES,
  HOOK_STYLE_VALUES,
  VALID_TARGET_LENGTHS,
} = require('../services/structure/structureService');
const { DELIVERY_STYLE_VALUES } = require('../services/writing/writingIntelligenceService');

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
    showBlueprint: {
      audienceProblem: {
        type: String,
        default: '',
        maxlength: 240,
        trim: true,
      },
      listenerTransformation: {
        type: String,
        default: '',
        maxlength: 240,
        trim: true,
      },
      contentPillars: {
        type: [String],
        default: [],
      },
      ctaStyle: {
        type: String,
        enum: CTA_STYLE_VALUES,
        default: 'direct_action',
      },
      bannedWords: {
        type: [String],
        default: [],
      },
      brandVoiceRules: {
        type: [String],
        default: [],
      },
    },
    toneOverridePreset: {
      type: String,
      enum: ['', ...TONE_PRESET_NAMES],
      default: '',
    },
    toneOverrideIntensity: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    episodeType: {
      type: String,
      enum: ['solo', 'interview'],
      default: 'solo',
    },
    targetLength: {
      type: String,
      enum: VALID_TARGET_LENGTHS,
      default: '',
    },
    formatTemplate: {
      type: String,
      enum: FORMAT_TEMPLATE_VALUES,
      default: 'signature_framework',
    },
    hookStyle: {
      type: String,
      enum: HOOK_STYLE_VALUES,
      default: 'problem_first',
    },
    deliveryStyle: {
      type: String,
      enum: DELIVERY_STYLE_VALUES,
      default: 'friendly',
    },
    includeFunSegment: {
      type: Boolean,
      default: true,
    },
    isSingle: {
      type: Boolean,
      default: false,
      index: true,
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
    toneScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    toneWarnings: {
      type: [String],
      default: [],
    },
    hookOptions: {
      type: [String],
      default: [],
    },
    timeEstimate: {
      totalMinutes: {
        type: Number,
        default: null,
      },
      spokenWords: {
        type: Number,
        default: null,
      },
      sectionBreakdown: {
        type: [String],
        default: [],
      },
      summary: {
        type: String,
        default: '',
        trim: true,
      },
    },
    scriptDoctor: {
      overallScore: {
        type: Number,
        default: null,
      },
      clarityScore: {
        type: Number,
        default: null,
      },
      pacingScore: {
        type: Number,
        default: null,
      },
      repetitionScore: {
        type: Number,
        default: null,
      },
      transitionScore: {
        type: Number,
        default: null,
      },
      strengths: {
        type: [String],
        default: [],
      },
      issues: {
        type: [String],
        default: [],
      },
      recommendations: {
        type: [String],
        default: [],
      },
      updatedAt: {
        type: Date,
        default: null,
      },
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
