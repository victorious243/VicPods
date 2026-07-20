const mongoose = require('mongoose');

const podcastShowSchema = new mongoose.Schema(
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
    slug: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4000,
    },
    authorName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    ownerEmail: {
      type: String,
      default: '',
      trim: true,
      maxlength: 200,
    },
    language: {
      type: String,
      default: 'en-us',
      trim: true,
      maxlength: 20,
    },
    categoryPrimary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    categorySecondary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    coverImageUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    websiteUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    copyright: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    explicit: {
      type: Boolean,
      default: false,
    },
    feedStatus: {
      type: String,
      enum: ['draft', 'live'],
      default: 'draft',
    },
    publishedEpisodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPublishedAt: {
      type: Date,
      default: null,
    },
    monetization: {
      supportLinks: {
        type: [
          {
            label: {
              type: String,
              trim: true,
              maxlength: 80,
            },
            url: {
              type: String,
              trim: true,
              maxlength: 500,
            },
            provider: {
              type: String,
              trim: true,
              maxlength: 80,
              default: '',
            },
          },
        ],
        default: [],
      },
      premiumEnabled: {
        type: Boolean,
        default: false,
      },
      privateFeedsEnabled: {
        type: Boolean,
        default: false,
      },
      sponsorContactEmail: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        maxlength: 200,
      },
      sponsorPitch: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
      audienceSummary: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
      },
      rateCard: {
        preRoll: {
          type: Number,
          default: null,
          min: 0,
        },
        midRoll: {
          type: Number,
          default: null,
          min: 0,
        },
        postRoll: {
          type: Number,
          default: null,
          min: 0,
        },
      },
    },
    brandKit: {
      positioning: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
      },
      voiceRules: {
        type: [String],
        default: [],
      },
      visualNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
      },
      sponsorSafetyNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
      },
      approvedPhrases: {
        type: [String],
        default: [],
      },
      bannedPhrases: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

podcastShowSchema.index({ userId: 1, createdAt: -1 });
podcastShowSchema.index({ userId: 1, slug: 1 });

module.exports = mongoose.model('PodcastShow', podcastShowSchema);
