const crypto = require('crypto');
const mongoose = require('mongoose');
const { TONE_PRESET_NAMES } = require('../services/tone/tonePresets');
const { PODCAST_TEMPLATE_KEYS } = require('../services/templates/podcastTemplateService');
const {
  CTA_STYLE_VALUES,
  FORMAT_TEMPLATE_VALUES,
  HOOK_STYLE_VALUES,
  VALID_TARGET_LENGTHS,
} = require('../services/structure/structureService');
const { DELIVERY_STYLE_VALUES } = require('../services/writing/writingIntelligenceService');

const SHARE_TOKEN_BYTES = 18;

function createShareToken() {
  return crypto.randomBytes(SHARE_TOKEN_BYTES).toString('hex');
}

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
    templateType: {
      type: String,
      enum: ['', ...PODCAST_TEMPLATE_KEYS],
      default: '',
    },
    shareToken: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    shareLinkCopiedAt: {
      type: Date,
      default: null,
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
    showId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PodcastShow',
      default: null,
      index: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 3000,
    },
    publicSlug: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    publishStatus: {
      type: String,
      enum: ['draft', 'scheduled', 'published'],
      default: 'draft',
      index: true,
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    audioAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AudioAsset',
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    seasonNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    episodeNumberForFeed: {
      type: Number,
      default: null,
      min: 1,
    },
    explicit: {
      type: Boolean,
      default: null,
    },
    publicPageEnabled: {
      type: Boolean,
      default: false,
    },
    rssGuid: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
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
    chapters: {
      type: [
        {
          title: {
            type: String,
            trim: true,
            maxlength: 180,
          },
          startSeconds: {
            type: Number,
            default: null,
            min: 0,
          },
          endSeconds: {
            type: Number,
            default: null,
            min: 0,
          },
          source: {
            type: String,
            enum: ['manual', 'outline', 'transcript'],
            default: 'manual',
          },
        },
      ],
      default: [],
    },
    recordingWorkflow: {
      status: {
        type: String,
        enum: ['planned', 'prepped', 'recorded', 'uploaded', 'transcript_imported'],
        default: 'planned',
      },
      scheduledFor: {
        type: Date,
        default: null,
      },
      location: {
        type: String,
        default: '',
        trim: true,
        maxlength: 180,
      },
      guestName: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
      },
      guestEmail: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        maxlength: 220,
      },
      guestBio: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
      prepNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
      },
      interviewQuestions: {
        type: [String],
        default: [],
      },
      checklistCompleted: {
        type: [String],
        default: [],
      },
      sessionNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 5000,
      },
      postRecordStatus: {
        type: String,
        enum: ['planned', 'prepped', 'recorded', 'uploaded', 'transcript_imported'],
        default: 'planned',
      },
      transcriptImportedAt: {
        type: Date,
        default: null,
      },
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
    showNotesPack: {
      summary: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
      description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1800,
      },
      keyTakeaways: {
        type: [String],
        default: [],
      },
      listenerCTA: {
        type: String,
        default: '',
        trim: true,
        maxlength: 600,
      },
      socialPosts: {
        type: [String],
        default: [],
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      stale: {
        type: Boolean,
        default: false,
      },
      sourceSignature: {
        type: String,
        default: '',
        trim: true,
        maxlength: 64,
      },
    },
    launchPack: {
      titles: {
        type: [String],
        default: [],
      },
      description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1800,
      },
      showNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 4000,
      },
      socialCaptions: {
        type: [String],
        default: [],
      },
      cta: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
      updatedAt: {
        type: Date,
        default: null,
      },
      stale: {
        type: Boolean,
        default: false,
      },
      sourceSignature: {
        type: String,
        default: '',
        trim: true,
        maxlength: 64,
      },
    },
    monetization: {
      visibility: {
        type: String,
        enum: ['public', 'premium', 'private'],
        default: 'public',
        index: true,
      },
      supportLinkOverride: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
      sponsorName: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
      },
      sponsorCampaign: {
        type: String,
        default: '',
        trim: true,
        maxlength: 160,
      },
      adSlots: {
        type: [
          {
            position: {
              type: String,
              enum: ['pre_roll', 'mid_roll', 'post_roll'],
              default: 'mid_roll',
            },
            timestampSeconds: {
              type: Number,
              default: null,
              min: 0,
            },
            sponsorName: {
              type: String,
              default: '',
              trim: true,
              maxlength: 160,
            },
            copy: {
              type: String,
              default: '',
              trim: true,
              maxlength: 1000,
            },
            status: {
              type: String,
              enum: ['planned', 'sold', 'delivered'],
              default: 'planned',
            },
          },
        ],
        default: [],
      },
    },
    approvalWorkflow: {
      status: {
        type: String,
        enum: ['not_started', 'in_review', 'changes_requested', 'approved'],
        default: 'not_started',
        index: true,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
    },
    advancedMedia: {
      externalProject: {
        provider: {
          type: String,
          enum: ['', 'descript', 'riverside'],
          default: '',
        },
        projectUrl: {
          type: String,
          default: '',
          trim: true,
          maxlength: 500,
        },
        externalId: {
          type: String,
          default: '',
          trim: true,
          maxlength: 200,
        },
        lastImportedAt: {
          type: Date,
          default: null,
        },
        lastExportedAt: {
          type: Date,
          default: null,
        },
      },
      clipSuggestions: {
        type: [
          {
            title: {
              type: String,
              trim: true,
              maxlength: 160,
            },
            startSeconds: {
              type: Number,
              min: 0,
              default: 0,
            },
            endSeconds: {
              type: Number,
              min: 0,
              default: 0,
            },
            hook: {
              type: String,
              trim: true,
              maxlength: 300,
            },
            platform: {
              type: String,
              enum: ['shorts', 'tiktok', 'reels', 'linkedin', 'youtube'],
              default: 'shorts',
            },
          },
        ],
        default: [],
      },
      captions: {
        format: {
          type: String,
          enum: ['srt', 'vtt'],
          default: 'srt',
        },
        content: {
          type: String,
          default: '',
          maxlength: 50000,
        },
        updatedAt: {
          type: Date,
          default: null,
        },
      },
      quoteCards: {
        type: [
          {
            title: {
              type: String,
              trim: true,
              maxlength: 160,
            },
            quoteText: {
              type: String,
              trim: true,
              maxlength: 320,
            },
            platform: {
              type: String,
              enum: ['instagram', 'linkedin', 'x'],
              default: 'instagram',
            },
            accentKey: {
              type: String,
              enum: ['sunrise', 'lagoon', 'midnight'],
              default: 'sunrise',
            },
            svgMarkup: {
              type: String,
              default: '',
              maxlength: 24000,
            },
            downloadUrl: {
              type: String,
              default: '',
              maxlength: 32000,
            },
            updatedAt: {
              type: Date,
              default: null,
            },
          },
        ],
        default: [],
      },
      cleanupRequest: {
        status: {
          type: String,
          enum: ['none', 'requested', 'processing', 'completed', 'failed'],
          default: 'none',
          index: true,
        },
        provider: {
          type: String,
          default: '',
          trim: true,
          maxlength: 120,
        },
        notes: {
          type: String,
          default: '',
          trim: true,
          maxlength: 1200,
        },
        requestedAt: {
          type: Date,
          default: null,
        },
      },
      recorderSession: {
        status: {
          type: String,
          enum: ['not_started', 'planned', 'recorded'],
          default: 'not_started',
        },
        roomUrl: {
          type: String,
          default: '',
          trim: true,
          maxlength: 500,
        },
        notes: {
          type: String,
          default: '',
          trim: true,
          maxlength: 1200,
        },
      },
    },
    ideaIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Idea',
      },
    ],
    readyEmailSentAt: {
      type: Date,
      default: null,
    },
    lastDraftReminderEmailSentAt: {
      type: Date,
      default: null,
    },
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

episodeSchema.index(
  { shareToken: 1 },
  {
    unique: true,
    sparse: true,
  }
);

episodeSchema.index(
  { showId: 1, publicSlug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      showId: { $type: 'objectId' },
      publicSlug: { $gt: '' },
    },
  }
);

episodeSchema.index(
  { showId: 1, publishStatus: 1, publishedAt: -1, scheduledFor: 1 },
  {
    partialFilterExpression: {
      showId: { $type: 'objectId' },
    },
  }
);

episodeSchema.statics.generateUniqueShareToken = async function generateUniqueShareToken() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = createShareToken();
    const existingEpisode = await this.exists({ shareToken: token });

    if (!existingEpisode) {
      return token;
    }
  }

  throw new Error('Unable to allocate a unique episode share token.');
};

episodeSchema.methods.ensureShareToken = async function ensureShareToken() {
  if (this.shareToken) {
    return this.shareToken;
  }

  const token = await this.constructor.generateUniqueShareToken();
  const updatedEpisode = await this.constructor.findOneAndUpdate(
    {
      _id: this._id,
      $or: [
        { shareToken: { $exists: false } },
        { shareToken: '' },
        { shareToken: null },
      ],
    },
    {
      $set: { shareToken: token },
    },
    {
      new: true,
      timestamps: false,
    }
  ).select('shareToken');

  if (updatedEpisode?.shareToken) {
    this.shareToken = updatedEpisode.shareToken;
    return this.shareToken;
  }

  const latestEpisode = await this.constructor.findById(this._id).select('shareToken');
  this.shareToken = latestEpisode?.shareToken || token;
  return this.shareToken;
};

episodeSchema.pre('validate', async function assignShareToken() {
  if (!this.isNew || this.shareToken) {
    return;
  }

  this.shareToken = await this.constructor.generateUniqueShareToken();
});

module.exports = mongoose.model('Episode', episodeSchema);
