const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const PrivateFeedToken = require('../models/PrivateFeedToken');
const { MediaProcessingJob } = require('../models/MediaProcessingJob');
const {
  getPrivateFeedOfferConfig,
  isPrivateFeedCheckoutSession,
  isPrivateFeedSubscription,
  isPrivateFeedTokenAccessible,
} = require('../services/monetization/privateFeedEntitlementService');
const { buildQuoteCardAssets } = require('../services/promotion/socialAssetService');

function makeEpisode(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    title: 'Audience Trust Before You Sell',
    hook: 'Strong podcasts win because the angle is clear before the microphone turns on.',
    summary: 'A production-minded episode about recording clarity, trust, and launch readiness.',
    transcript: 'Strong podcasts win because the angle is clear before the microphone turns on. Listeners trust creators who organize the story before they sell. A clean structure becomes the difference between noise and momentum.',
    advancedMedia: {
      clipSuggestions: [
        {
          title: 'Clear angle',
          hook: 'Listeners trust creators who organize the story before they sell.',
        },
      ],
    },
    ...overrides,
  };
}

test('Phase 8 private feed offer config returns polished defaults', () => {
  const offer = getPrivateFeedOfferConfig({
    monetization: {
      privateFeedsEnabled: true,
      privateFeedTitle: ' Founder feed ',
      privateFeedDescription: ' Premium weekly debriefs for subscribers. ',
      privateFeedPriceId: 'price_123',
      privateFeedCtaLabel: ' Join now ',
    },
  });

  assert.equal(offer.enabled, true);
  assert.equal(offer.title, 'Founder feed');
  assert.equal(offer.description, 'Premium weekly debriefs for subscribers.');
  assert.equal(offer.priceId, 'price_123');
  assert.equal(offer.ctaLabel, 'Join now');
});

test('Phase 8 private feed access rules distinguish creator tokens from entitlements', () => {
  assert.equal(isPrivateFeedCheckoutSession({
    mode: 'subscription',
    metadata: { flowType: 'private_feed_subscription' },
  }), true);
  assert.equal(isPrivateFeedSubscription({
    metadata: { flowType: 'private_feed_subscription' },
  }), true);
  assert.equal(isPrivateFeedTokenAccessible({
    status: 'active',
    accessType: 'creator_managed',
    entitlementStatus: 'active',
  }), true);
  assert.equal(isPrivateFeedTokenAccessible({
    status: 'active',
    accessType: 'subscriber_entitlement',
    entitlementStatus: 'past_due',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }), true);
  assert.equal(isPrivateFeedTokenAccessible({
    status: 'revoked',
    accessType: 'subscriber_entitlement',
    entitlementStatus: 'active',
  }), false);
});

test('Phase 8 quote card generator creates social-ready SVG assets', () => {
  const cards = buildQuoteCardAssets(makeEpisode(), {
    show: { name: 'VicPods Weekly' },
  });

  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((card) => card.platform), ['instagram', 'linkedin', 'x']);
  assert.ok(cards[0].svgMarkup.includes('<svg'));
  assert.ok(cards[1].downloadUrl.startsWith('data:image/svg+xml'));
  assert.ok(cards[2].quoteText.length >= 24);
});

test('Phase 8 schemas expose entitlement and promotional media fields', () => {
  assert.ok(PodcastShow.schema.paths['monetization.privateFeedTitle']);
  assert.ok(PodcastShow.schema.paths['monetization.privateFeedPriceId']);
  assert.ok(PrivateFeedToken.schema.paths.accessType);
  assert.ok(PrivateFeedToken.schema.paths.entitlementStatus);
  assert.ok(Episode.schema.paths['advancedMedia.quoteCards']);
  assert.ok(MediaProcessingJob.schema.paths.jobType.enumValues.includes('quote_cards'));
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
