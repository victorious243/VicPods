#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Series = require('../models/Series');
const Theme = require('../models/Theme');
const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const AudioAsset = require('../models/AudioAsset');
const { syncPodcastShowStats } = require('../services/publish/publishService');

const SEED_EMAIL = process.env.PHASE0_SEED_EMAIL || 'phase0@vicpods.local';
const SEED_PASSWORD = process.env.PHASE0_SEED_PASSWORD || 'Phase0Password123!';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function ensureUser() {
  const existing = await User.findOne({ email: SEED_EMAIL });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  return User.create({
    email: SEED_EMAIL,
    passwordHash,
    name: 'Phase 0 Creator',
    emailVerified: true,
    mfaEnabled: false,
    termsAcceptedAt: new Date(),
    termsAcceptedVersion: 'phase-0-seed',
    plan: 'premium',
    planStatus: 'active',
    onboardingCompletedAt: new Date(),
  });
}

async function ensureSeries(user) {
  return Series.findOneAndUpdate(
    { userId: user._id, name: 'VicPods Phase 0 Demo Show Plan' },
    {
      $setOnInsert: {
        userId: user._id,
        name: 'VicPods Phase 0 Demo Show Plan',
        description: 'A seeded series used to verify the complete idea-to-publish workflow.',
        audience: 'Independent podcasters who want a repeatable publishing system.',
        goal: 'Validate that VicPods can move from planning into publish-ready hosting.',
        plannedEpisodeCount: 1,
        seriesSummary: 'This demo series proves the planning, scripting, and publishing baseline.',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureTheme(user, series) {
  return Theme.findOneAndUpdate(
    { userId: user._id, seriesId: series._id, name: 'Launch Workflow' },
    {
      $setOnInsert: {
        userId: user._id,
        seriesId: series._id,
        name: 'Launch Workflow',
        description: 'Episodes about turning podcast plans into live published assets.',
        orderIndex: 1,
        themeSummary: 'Focuses on practical steps from idea to public release.',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureShow(user) {
  return PodcastShow.findOneAndUpdate(
    { slug: 'phase-0-demo-show' },
    {
      $set: {
        userId: user._id,
        name: 'Phase 0 Demo Show',
        description: 'A seeded VicPods show for verifying RSS, public pages, and publish workflows.',
        authorName: user.name,
        ownerEmail: user.email,
        language: 'en-us',
        categoryPrimary: 'Technology',
        categorySecondary: 'Podcasting',
        websiteUrl: APP_URL,
        copyright: 'Copyright Phase 0 Demo Show',
        explicit: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureEpisode(user, series, theme, show) {
  return Episode.findOneAndUpdate(
    { userId: user._id, themeId: theme._id, episodeNumberWithinTheme: 1 },
    {
      $set: {
        seriesId: series._id,
        showId: show._id,
        title: 'From Idea To Published Podcast',
        summary: 'A practical walkthrough of the VicPods idea-to-publish workflow.',
        publicSlug: 'from-idea-to-published-podcast',
        status: 'Ready',
        publishStatus: 'published',
        publicPageEnabled: true,
        publishedAt: new Date('2026-07-20T12:00:00.000Z'),
        durationSeconds: 180,
        episodeNumber: 1,
        globalEpisodeNumber: 1,
        episodeNumberForFeed: 1,
        explicit: false,
        hook: 'Most podcast tools start after the audio exists. VicPods starts when the idea is still rough.',
        outline: [
          'Define the audience promise',
          'Shape the episode structure',
          'Prepare the publish metadata',
          'Launch with a feed and public page',
        ],
        launchPack: {
          description: 'A seeded launch pack that verifies public episode and RSS rendering.',
          showNotes: 'This seeded episode demonstrates the baseline VicPods publishing workflow for Phase 0 verification.',
          socialCaptions: ['From rough idea to live podcast in one VicPods workflow.'],
          cta: 'Use this seeded episode to verify publishing readiness.',
          updatedAt: new Date(),
          stale: false,
        },
      },
      $setOnInsert: {
        userId: user._id,
        themeId: theme._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function ensureAudioAsset(user, episode) {
  const storageKey = path.posix.join(
    'uploads',
    'audio',
    String(user._id),
    String(episode._id),
    'phase-0-demo.mp3'
  );
  const absolutePath = path.join(process.cwd(), 'public', storageKey);
  const existing = await AudioAsset.findOne({
    userId: user._id,
    episodeId: episode._id,
    originalFilename: 'phase-0-demo.mp3',
  });

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(
    absolutePath,
    Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00Phase 0 VicPods demo audio placeholder\n')
  );

  const asset = existing || await AudioAsset.create({
    userId: user._id,
    episodeId: episode._id,
    storageProvider: 'local_public',
    storageKey,
    originalFilename: 'phase-0-demo.mp3',
    mimeType: 'audio/mpeg',
    byteSize: 52,
    durationSeconds: 180,
    bitrateKbps: 128,
    status: 'ready',
    processedAt: new Date(),
  });

  if (existing) {
    existing.storageKey = storageKey;
    existing.mimeType = 'audio/mpeg';
    existing.byteSize = 52;
    existing.durationSeconds = 180;
    existing.bitrateKbps = 128;
    existing.status = 'ready';
    existing.processedAt = existing.processedAt || new Date();
    await existing.save();
  }

  episode.audioAssetId = asset._id;
  await episode.save();
  return asset;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required to seed Phase 0 data.');
    process.exit(1);
  }

  await connectDatabase(process.env.MONGO_URI);

  const user = await ensureUser();
  const series = await ensureSeries(user);
  const theme = await ensureTheme(user, series);
  const show = await ensureShow(user);
  const episode = await ensureEpisode(user, series, theme, show);
  const asset = await ensureAudioAsset(user, episode);
  await syncPodcastShowStats(show._id);

  console.log('Phase 0 seed complete.');
  console.log('User: ' + user.email);
  console.log('Password: ' + SEED_PASSWORD);
  console.log('Show: /podcasts/' + show.slug);
  console.log('Feed: /podcasts/' + show.slug + '/feed.xml');
  console.log('Episode: /podcasts/' + show.slug + '/' + episode.publicSlug);
  console.log('Audio asset: ' + asset.storageKey);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
