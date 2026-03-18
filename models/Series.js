const mongoose = require('mongoose');
const { TONE_PRESET_NAMES } = require('../services/tone/tonePresets');
const {
  CTA_STYLE_VALUES,
  FORMAT_TEMPLATE_VALUES,
  HOOK_STYLE_VALUES,
  VALID_EPISODE_TYPES,
  VALID_TARGET_LENGTHS,
} = require('../services/structure/structureService');
const { DELIVERY_STYLE_VALUES } = require('../services/writing/writingIntelligenceService');

const seriesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
      trim: true,
    },
    tone: {
      type: String,
      enum: ['fun', 'calm', 'serious'],
      default: 'fun',
    },
    audience: {
      type: String,
      default: '',
      maxlength: 240,
      trim: true,
    },
    tonePreset: {
      type: String,
      enum: TONE_PRESET_NAMES,
      default: 'Conversational & Casual',
    },
    toneIntensity: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    audienceType: {
      type: String,
      default: '',
      maxlength: 120,
      trim: true,
    },
    intent: {
      type: String,
      enum: ['educate', 'inspire', 'debate', 'storytell', 'entertain'],
      default: 'educate',
    },
    voicePersona: {
      type: String,
      default: '',
      maxlength: 400,
      trim: true,
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
    seriesBible: {
      seasonGoal: {
        type: String,
        default: '',
        maxlength: 320,
        trim: true,
      },
      audiencePromise: {
        type: String,
        default: '',
        maxlength: 240,
        trim: true,
      },
      recurringThemes: {
        type: [String],
        default: [],
      },
    },
    defaultEpisodeType: {
      type: String,
      enum: VALID_EPISODE_TYPES,
      default: 'solo',
    },
    defaultTargetLength: {
      type: String,
      enum: VALID_TARGET_LENGTHS,
      default: '',
    },
    defaultIncludeFunSegment: {
      type: Boolean,
      default: true,
    },
    defaultFormatTemplate: {
      type: String,
      enum: FORMAT_TEMPLATE_VALUES,
      default: 'signature_framework',
    },
    defaultHookStyle: {
      type: String,
      enum: HOOK_STYLE_VALUES,
      default: 'problem_first',
    },
    defaultDeliveryStyle: {
      type: String,
      enum: DELIVERY_STYLE_VALUES,
      default: 'friendly',
    },
    creationMode: {
      type: String,
      enum: ['series', 'single_collection'],
      default: 'series',
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    goal: {
      type: String,
      default: '',
      maxlength: 320,
      trim: true,
    },
    plannedEpisodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    seriesSummary: {
      type: String,
      default: '',
      maxlength: 1200,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

seriesSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('Series', seriesSchema);
