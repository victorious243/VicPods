const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  buildAdSlotPlanner,
  buildMediaKit,
  buildPrivateFeedUrl,
  buildSponsorOutreachTemplates,
  normalizeSupportLinks,
} = require('../services/monetization/creatorMonetizationService');
const { buildPodcastFeedXml } = require('../services/publish/rssFeedService');

function makeShow(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    name: overrides.name || 'VicPods Growth',
    slug: overrides.slug || 'vicpods-growth',
    description: 'A show about building better podcasts.',
    authorName: 'Brandon',
    ownerEmail: 'creator@example.com',
    language: 'en-us',
    explicit: false,
    monetization: {
      supportLinks: [
        { label: 'Support the show', url: 'https://buymeacoffee.com/vicpods', provider: 'Coffee' },
        { label: 'Bad link', url: 'ftp://example.com', provider: 'Ignored' },
      ],
      audienceSummary: 'ambitious independent podcasters',
      sponsorPitch: 'Reach creators who are improving their shows every week.',
      sponsorContactEmail: 'sponsor@example.com',
      rateCard: {
        preRoll: 250,
        midRoll: 500,
        postRoll: 150,
      },
    },
    ...overrides,
  };
}

function makeEpisode(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    title: overrides.title || 'How Podcasts Make Money',
    publicSlug: overrides.publicSlug || 'how-podcasts-make-money',
    publishStatus: 'published',
    publicPageEnabled: true,
    publishedAt: new Date('2026-07-20T10:00:00Z'),
    durationSeconds: 1800,
    audioAssetId: {
      byteSize: 1234,
      mimeType: 'audio/mpeg',
      storageKey: '/tmp/fake.mp3',
    },
    monetization: {
      visibility: 'public',
      adSlots: [],
    },
    ...overrides,
  };
}

test('Phase 5 normalizes listener support links', () => {
  const links = normalizeSupportLinks([
    { label: ' Patreon ', url: 'https://patreon.com/vicpods', provider: 'Patreon' },
    { label: 'Invalid', url: 'mailto:test@example.com' },
    { label: '', url: 'https://example.com' },
  ]);

  assert.deepEqual(links, [
    { label: 'Patreon', url: 'https://patreon.com/vicpods', provider: 'Patreon' },
  ]);
});

test('Phase 5 builds a sponsor-ready media kit and outreach templates', async () => {
  const mediaKit = await buildMediaKit({
    show: makeShow(),
    episodes: [makeEpisode()],
    analytics: { totals: { audioDownloads: 1200, playerPlays: 450 } },
    baseUrl: 'https://app.vicpods.com',
  });
  const templates = buildSponsorOutreachTemplates(mediaKit);

  assert.equal(mediaKit.metrics.find((metric) => metric.label === 'Published Episodes').value, 1);
  assert.equal(mediaKit.metrics.find((metric) => metric.label === 'Audio Downloads').value, 1200);
  assert.equal(mediaKit.rateCard.find((rate) => rate.key === 'mid_roll').price, '$500');
  assert.ok(templates[0].body.includes('https://app.vicpods.com/podcasts/vicpods-growth'));
});

test('Phase 5 plans default ad inventory for episodes', () => {
  const planner = buildAdSlotPlanner([makeEpisode()]);

  assert.equal(planner[0].slots.length, 3);
  assert.deepEqual(planner[0].slots.map((slot) => slot.position), ['pre_roll', 'mid_roll', 'post_roll']);
});

test('Phase 5 private feed URL carries an opaque token', () => {
  const url = buildPrivateFeedUrl({
    show: makeShow(),
    token: { token: 'abc123private' },
    baseUrl: 'https://app.vicpods.com/',
  });

  assert.equal(url, 'https://app.vicpods.com/podcasts/vicpods-growth/private/abc123private/feed.xml');
});

test('Phase 5 premium episodes can be kept out of a public feed set', () => {
  const show = makeShow();
  const publicEpisode = makeEpisode({ title: 'Public episode' });
  const premiumEpisode = makeEpisode({
    title: 'Premium episode',
    monetization: { visibility: 'premium' },
  });
  const publicOnlyEpisodes = [publicEpisode, premiumEpisode].filter((episode) => (
    !episode.monetization?.visibility || episode.monetization.visibility === 'public'
  ));
  const feedXml = buildPodcastFeedXml({
    show,
    episodes: publicOnlyEpisodes,
    baseUrl: 'https://app.vicpods.com',
  });

  assert.ok(feedXml.includes('Public episode'));
  assert.ok(!feedXml.includes('Premium episode'));
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
