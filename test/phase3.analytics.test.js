const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  buildAnalyticsCsv,
  buildGrowthRecommendations,
  dateKey,
  detectDeviceType,
  detectPlatform,
  summarizeDailyAnalytics,
} = require('../services/analytics/podcastAnalyticsService');

function objectId() {
  return new mongoose.Types.ObjectId();
}

test('Phase 3 analytics summarizes downloads, plays, shares, and source breakdowns', () => {
  const showId = objectId();
  const firstEpisodeId = objectId();
  const secondEpisodeId = objectId();
  const summary = summarizeDailyAnalytics({
    shows: [{ _id: showId, name: 'VicPods Weekly' }],
    episodes: [
      { _id: firstEpisodeId, showId, title: 'Launch Week' },
      { _id: secondEpisodeId, showId, title: 'Growth Week' },
    ],
    dailyRows: [
      {
        showId,
        episodeId: firstEpisodeId,
        dateKey: '2026-07-20',
        feedRequests: 3,
        audioDownloads: 12,
        playerPlays: 8,
        playerCompletions: 4,
        shareClicks: 2,
        platforms: { Spotify: 7, 'Apple Podcasts': 5 },
        countries: { Ireland: 9, Nigeria: 3 },
        referrers: { Direct: 8, LinkedIn: 4 },
        devices: { mobile: 8, desktop: 4 },
      },
      {
        showId,
        episodeId: secondEpisodeId,
        dateKey: '2026-07-21',
        feedRequests: 1,
        audioDownloads: 3,
        playerPlays: 15,
        playerCompletions: 12,
        shareClicks: 6,
        platforms: { 'Web Player': 15 },
        countries: { Ireland: 15 },
        referrers: { LinkedIn: 15 },
        devices: { desktop: 15 },
      },
    ],
  });

  assert.equal(summary.totals.feedRequests, 4);
  assert.equal(summary.totals.audioDownloads, 15);
  assert.equal(summary.totals.playerPlays, 23);
  assert.equal(summary.totals.playerCompletions, 16);
  assert.equal(summary.totals.shareClicks, 8);
  assert.equal(summary.timeline.length, 2);
  assert.equal(summary.topEpisodes[0].title, 'Growth Week');
  assert.equal(summary.topEpisodes[0].completionRate, 80);
  assert.deepEqual(summary.breakdowns.countries[0], { label: 'Ireland', count: 24 });
  assert.deepEqual(summary.breakdowns.referrers[0], { label: 'LinkedIn', count: 19 });
});

test('Phase 3 recommendations convert analytics into next actions', () => {
  const recommendations = buildGrowthRecommendations({
    totals: {
      audioDownloads: 20,
      playerPlays: 10,
      shareClicks: 0,
    },
    topEpisodes: [{
      title: 'Founder Interview',
    }],
    breakdowns: {
      platforms: [{ label: 'Spotify', count: 12 }],
      referrers: [{ label: 'Newsletter', count: 9 }],
    },
  });

  assert.ok(recommendations.some((item) => item.title.includes('Founder Interview')));
  assert.ok(recommendations.some((item) => item.title.includes('Newsletter') || item.body.includes('Newsletter')));
  assert.ok(recommendations.some((item) => item.title.includes('Spotify')));
  assert.ok(recommendations.some((item) => item.title.includes('share CTA')));
});

test('Phase 3 analytics detects podcast platforms and devices from user agents', () => {
  assert.equal(detectPlatform('Spotify/8.9 podcast downloader'), 'Spotify');
  assert.equal(detectPlatform('AppleCoreMedia/1.0 Podcasts/1820'), 'Apple Podcasts');
  assert.equal(detectDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'mobile');
  assert.equal(detectDeviceType('Googlebot/2.1'), 'bot');
});

test('Phase 3 CSV export includes daily analytics rows', () => {
  const csv = buildAnalyticsCsv({
    timeline: [{
      dateKey: '2026-07-20',
      feedRequests: 1,
      audioDownloads: 2,
      playerPlays: 3,
      playerCompletions: 4,
      shareClicks: 5,
    }],
  });

  assert.ok(csv.includes('"date","feed_requests","audio_downloads"'));
  assert.ok(csv.includes('"2026-07-20","1","2","3","4","5"'));
});

test('Phase 3 date keys are stable UTC day keys', () => {
  assert.equal(dateKey(new Date('2026-07-20T23:59:00.000Z')), '2026-07-20');
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
