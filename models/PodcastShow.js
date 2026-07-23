const mongoose = require('mongoose');
const crypto = require('crypto');

function createDomainVerificationToken() {
  return crypto.randomBytes(12).toString('hex');
}

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
    siteSettings: {
      heroLabel: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
      },
      heroTagline: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240,
      },
      featuredLabel: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
      },
      featuredText: {
        type: String,
        default: '',
        trim: true,
        maxlength: 320,
      },
      primaryCtaLabel: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
      },
      primaryCtaUrl: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
      hostIntro: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
      footerNote: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240,
      },
      themeVariant: {
        type: String,
        enum: ['studio', 'signal', 'sunrise', 'forest'],
        default: 'studio',
      },
    },
    customDomain: {
      hostname: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        maxlength: 200,
      },
      status: {
        type: String,
        enum: ['not_configured', 'pending_verification', 'active'],
        default: 'not_configured',
      },
      dnsTarget: {
        type: String,
        default: 'connect.vicpods.app',
        trim: true,
        maxlength: 200,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      lastCheckedAt: {
        type: Date,
        default: null,
      },
      verificationToken: {
        type: String,
        default: createDomainVerificationToken,
        trim: true,
        maxlength: 64,
      },
      verificationError: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240,
      },
    },
    importSource: {
      origin: {
        type: String,
        enum: ['manual', 'rss_import'],
        default: 'manual',
      },
      sourceUrl: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
      importedAt: {
        type: Date,
        default: null,
      },
      itemCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    directorySubmissions: {
      type: [
        {
          platformKey: {
            type: String,
            enum: ['spotify', 'apple', 'youtube', 'amazon', 'pocket-casts', 'overcast'],
            required: true,
            trim: true,
          },
          status: {
            type: String,
            enum: ['not_started', 'submitted', 'listed', 'needs_attention'],
            default: 'not_started',
          },
          submittedAt: {
            type: Date,
            default: null,
          },
          listedAt: {
            type: Date,
            default: null,
          },
          listingUrl: {
            type: String,
            default: '',
            trim: true,
            maxlength: 500,
          },
          notes: {
            type: String,
            default: '',
            trim: true,
            maxlength: 500,
          },
          lastCheckedAt: {
            type: Date,
            default: null,
          },
        },
      ],
      default: [],
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
      privateFeedTitle: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
      },
      privateFeedDescription: {
        type: String,
        default: '',
        trim: true,
        maxlength: 600,
      },
      privateFeedPriceId: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
      },
      privateFeedCtaLabel: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
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
podcastShowSchema.index({ 'customDomain.hostname': 1 }, { sparse: true });

module.exports = mongoose.model('PodcastShow', podcastShowSchema);
