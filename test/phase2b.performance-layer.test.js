const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { buildPodcastPerformanceEmail } = require('../services/email/podcastPerformanceEmailService');
const {
  buildDirectoryChecklist,
} = require('../services/publish/directoryChecklistService');
const {
  getIsoWeekKey,
  isWeeklyPerformanceSendDay,
} = require('../services/analytics/podcastPerformanceWorkerService');

test('Phase 2B directory tracker keeps submitted and listed platform states', () => {
  const checklist = buildDirectoryChecklist({
    feedUrl: 'https://vicpods.example/podcasts/show/feed.xml',
    feedValidation: { passed: true },
    show: {
      directorySubmissions: [
        {
          platformKey: 'spotify',
          status: 'submitted',
          submittedAt: new Date('2026-07-18T09:00:00.000Z'),
        },
        {
          platformKey: 'apple',
          status: 'listed',
          listedAt: new Date('2026-07-20T09:00:00.000Z'),
          listingUrl: 'https://podcasts.apple.com/show/vicpods-weekly',
        },
      ],
    },
  });

  const spotify = checklist.find((platform) => platform.key === 'spotify');
  const apple = checklist.find((platform) => platform.key === 'apple');
  const youtube = checklist.find((platform) => platform.key === 'youtube');

  assert.equal(spotify.status, 'submitted');
  assert.match(spotify.detail, /Submitted on 2026-07-18/);
  assert.equal(apple.status, 'listed');
  assert.equal(apple.actionLabel, 'View listing');
  assert.equal(youtube.status, 'ready');
});

test('Phase 2B performance email carries the reporting range and episode winners', () => {
  const email = buildPodcastPerformanceEmail({
    name: 'VicPods Creator',
    appUrl: 'https://app.vicpods.com',
    analytics: {
      range: {
        from: '2026-07-16',
        to: '2026-07-22',
      },
      totals: {
        audioDownloads: 120,
        playerPlays: 80,
        playerCompletions: 44,
        shareClicks: 12,
      },
      topEpisodes: [
        {
          title: 'Audience Trust Sprint',
          audioDownloads: 70,
          playerPlays: 40,
        },
      ],
      recommendations: [
        {
          title: 'Double down on the winning angle',
          body: 'Turn the strongest hook into the next episode teaser.',
        },
      ],
    },
  });

  assert.match(email.text, /2026-07-16 to 2026-07-22/);
  assert.match(email.text, /Audience Trust Sprint/);
  assert.match(email.html, /Your podcast performance report/);
  assert.match(email.html, /2026-07-16 to 2026-07-22/);
});

test('Phase 2B weekly performance scheduling uses stable ISO week keys', () => {
  assert.equal(getIsoWeekKey(new Date('2026-07-22T12:00:00.000Z')), '2026-W30');
  assert.equal(isWeeklyPerformanceSendDay(new Date('2026-07-22T12:00:00.000Z')), true);
  assert.equal(isWeeklyPerformanceSendDay(new Date('2026-07-23T12:00:00.000Z')), false);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
