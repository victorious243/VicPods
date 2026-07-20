const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { validateEnvironment } = require('../config/envValidation');
const PodcastShow = require('../models/PodcastShow');
const Episode = require('../models/Episode');
const AudioAsset = require('../models/AudioAsset');
const {
  buildPodcastFeedPath,
  buildPodcastFeedUrl,
  buildPodcastShowPath,
  buildPublishedEpisodePath,
  buildPublishedEpisodeUrl,
  slugifySegment,
} = require('../services/publish/publishService');
const { buildPodcastFeedXml } = require('../services/publish/rssFeedService');
const { MAX_AUDIO_BYTES, buildPublicAudioPath, buildPublicAudioUrl } = require('../services/publish/audioStorageService');

test('environment validation catches missing production requirements', () => {
  const originalEnv = { ...process.env };

  try {
    process.env = {
      NODE_ENV: 'production',
    };

    const result = validateEnvironment({ isProduction: true });

    assert.ok(result.errors.includes('MONGO_URI is required.'));
    assert.ok(result.errors.includes('SESSION_SECRET is required in production.'));
    assert.ok(result.errors.includes('APP_URL is required.'));
  } finally {
    process.env = originalEnv;
  }
});

test('publish helpers build stable public paths and URLs', () => {
  const show = { slug: 'phase-0-demo-show' };
  const episode = { publicSlug: 'from-idea-to-published-podcast' };

  assert.equal(slugifySegment('From Idea To Published Podcast!'), 'from-idea-to-published-podcast');
  assert.equal(buildPodcastShowPath(show), '/podcasts/phase-0-demo-show');
  assert.equal(buildPodcastFeedPath(show), '/podcasts/phase-0-demo-show/feed.xml');
  assert.equal(
    buildPublishedEpisodePath(show, episode),
    '/podcasts/phase-0-demo-show/from-idea-to-published-podcast'
  );
  assert.equal(
    buildPodcastFeedUrl(show, 'https://vicpods.example'),
    'https://vicpods.example/podcasts/phase-0-demo-show/feed.xml'
  );
  assert.equal(
    buildPublishedEpisodeUrl(show, episode, 'https://vicpods.example'),
    'https://vicpods.example/podcasts/phase-0-demo-show/from-idea-to-published-podcast'
  );
});

test('RSS feed generation includes required podcast and episode metadata', () => {
  const show = {
    name: 'Phase 0 Demo Show',
    slug: 'phase-0-demo-show',
    description: 'A seeded show for publish smoke tests.',
    authorName: 'Phase 0 Creator',
    ownerEmail: 'phase0@vicpods.local',
    language: 'en-us',
    categoryPrimary: 'Technology',
    categorySecondary: 'Podcasting',
    explicit: false,
    websiteUrl: 'https://vicpods.example',
    coverImageUrl: 'https://vicpods.example/cover.png',
    updatedAt: new Date('2026-07-20T12:00:00.000Z'),
  };
  const episode = {
    title: 'From Idea To Published Podcast',
    publicSlug: 'from-idea-to-published-podcast',
    summary: 'A practical walkthrough of the VicPods publishing workflow.',
    publishedAt: new Date('2026-07-20T12:05:00.000Z'),
    durationSeconds: 180,
    episodeNumberForFeed: 1,
    explicit: false,
    audioAssetId: {
      storageKey: 'uploads/audio/phase0/episode.mp3',
      byteSize: 52,
      mimeType: 'audio/mpeg',
      durationSeconds: 180,
    },
    launchPack: {
      showNotes: 'Seeded show notes for RSS rendering.',
    },
  };

  const xml = buildPodcastFeedXml({
    show,
    episodes: [episode],
    baseUrl: 'https://vicpods.example',
  });

  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2.0"/);
  assert.match(xml, /<channel>/);
  assert.match(xml, /<title>Phase 0 Demo Show<\/title>/);
  assert.match(xml, /<itunes:owner><itunes:name>Phase 0 Creator<\/itunes:name><itunes:email>phase0@vicpods.local<\/itunes:email><\/itunes:owner>/);
  assert.match(xml, /<itunes:category text="Technology"><itunes:category text="Podcasting" \/><\/itunes:category>/);
  assert.match(xml, /<item>/);
  assert.match(xml, /<enclosure url="https:\/\/vicpods.example\/uploads\/audio\/phase0\/episode.mp3" length="52" type="audio\/mpeg" \/>/);
});

test('audio public URL helpers keep uploads inside the public audio namespace', () => {
  assert.equal(MAX_AUDIO_BYTES, 50 * 1024 * 1024);
  assert.equal(buildPublicAudioPath('/uploads/audio/demo/file.mp3'), '/uploads/audio/demo/file.mp3');
  assert.equal(
    buildPublicAudioUrl('uploads/audio/demo/file.mp3', 'https://vicpods.example'),
    'https://vicpods.example/uploads/audio/demo/file.mp3'
  );
});

test('publish-critical schemas expose expected indexes', () => {
  const showIndexes = PodcastShow.schema.indexes().map(([fields]) => fields);
  const episodeIndexes = Episode.schema.indexes().map(([fields]) => fields);
  const audioIndexes = AudioAsset.schema.indexes().map(([fields]) => fields);

  assert.ok(showIndexes.some((fields) => fields.userId === 1 && fields.slug === 1));
  assert.ok(episodeIndexes.some((fields) => fields.showId === 1 && fields.publicSlug === 1));
  assert.ok(
    episodeIndexes.some((fields) => (
      fields.showId === 1
      && fields.publishStatus === 1
      && fields.publishedAt === -1
      && fields.scheduledFor === 1
    ))
  );
  assert.ok(audioIndexes.some((fields) => fields.userId === 1 && fields.episodeId === 1 && fields.createdAt === -1));
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
