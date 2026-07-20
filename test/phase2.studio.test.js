const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  buildEpisodeTabs,
  buildEpisodeDetailTabs,
  buildGlobalSearchIndex,
  buildCalendarItems,
  buildShowDashboard,
} = require('../services/studio/studioCommandCenterService');

function makeEpisode(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    title: overrides.title || 'Audience Research Sprint',
    status: overrides.status || 'Draft',
    publishStatus: overrides.publishStatus || 'draft',
    seriesId: overrides.seriesId || { _id: new mongoose.Types.ObjectId(), name: 'Creator Growth' },
    themeId: overrides.themeId || { _id: new mongoose.Types.ObjectId(), name: 'Launch System' },
    episodeNumberWithinTheme: overrides.episodeNumberWithinTheme || 1,
    hook: overrides.hook || 'How podcasters can understand listeners before recording.',
    outline: overrides.outline || ['Open', 'Framework', 'Close'],
    talkingPoints: overrides.talkingPoints || ['Research', 'Positioning'],
    summary: overrides.summary || 'A practical planning episode.',
    audioAssetId: overrides.audioAssetId,
    showId: overrides.showId,
    publicSlug: overrides.publicSlug,
    scheduledFor: overrides.scheduledFor,
    publishedAt: overrides.publishedAt,
    createdAt: overrides.createdAt || new Date('2026-07-20T09:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2026-07-20T10:00:00.000Z'),
  };
}

test('Phase 2 episode tabs group Studio work by production stage', () => {
  const scheduledShowId = new mongoose.Types.ObjectId();
  const tabs = buildEpisodeTabs([
    makeEpisode({ _id: new mongoose.Types.ObjectId(), status: 'Draft' }),
    makeEpisode({ _id: new mongoose.Types.ObjectId(), status: 'Ready' }),
    makeEpisode({ _id: new mongoose.Types.ObjectId(), status: 'Ready', audioAssetId: new mongoose.Types.ObjectId() }),
    makeEpisode({
      _id: new mongoose.Types.ObjectId(),
      status: 'Ready',
      publishStatus: 'scheduled',
      showId: scheduledShowId,
      scheduledFor: new Date('2026-07-22T09:00:00.000Z'),
    }),
    makeEpisode({ _id: new mongoose.Types.ObjectId(), publishStatus: 'published', publishedAt: new Date('2026-07-19T09:00:00.000Z') }),
  ]);

  const byKey = Object.fromEntries(tabs.map((tab) => [tab.key, tab]));

  assert.equal(byKey.all.count, 5);
  assert.equal(byKey.draft.count, 1);
  assert.equal(byKey.ready.count, 1);
  assert.equal(byKey.recorded.count, 1);
  assert.equal(byKey.scheduled.count, 1);
  assert.equal(byKey.live.count, 1);
  assert.ok(byKey.scheduled.items[0].href.includes('/kitchen/'));
});

test('Phase 2 episode detail tabs expose Plan Script Record Publish Grow workflow', () => {
  const tabs = buildEpisodeDetailTabs({
    episode: makeEpisode({
      title: 'Launch Week',
      hook: 'A focused publishing sprint.',
      outline: ['Plan', 'Record', 'Publish'],
      talkingPoints: ['Feed', 'Growth'],
      summary: 'A practical publishing episode.',
      audioAssetId: new mongoose.Types.ObjectId(),
      showId: new mongoose.Types.ObjectId(),
      publicSlug: 'launch-week',
      publishStatus: 'scheduled',
      launchPack: { updatedAt: new Date('2026-07-20T10:00:00.000Z') },
    }),
    releaseReadiness: { overallScore: 86 },
  });

  assert.deepEqual(tabs.map((tab) => tab.label), ['Plan', 'Script', 'Record', 'Publish', 'Grow']);
  assert.ok(tabs.every((tab) => tab.href.startsWith('#episode-')));
  assert.equal(tabs.find((tab) => tab.key === 'script').status, '86% ready');
  assert.equal(tabs.find((tab) => tab.key === 'record').complete, true);
  assert.equal(tabs.find((tab) => tab.key === 'publish').status, 'Configured');
});

test('Phase 2 global search indexes episodes, ideas, series, and shows', () => {
  const searchItems = buildGlobalSearchIndex({
    series: [{
      _id: new mongoose.Types.ObjectId(),
      name: 'Creator Growth',
      description: 'Growth strategy for independent podcasters',
      creationMode: 'series',
    }],
    episodes: [makeEpisode({ title: 'Monetization Sprint' })],
    ideas: [{
      hook: 'Membership bonus episode',
      tag: 'monetization',
      notes: 'Turn loyal listeners into paying supporters.',
    }],
    shows: [{
      _id: new mongoose.Types.ObjectId(),
      name: 'VicPods Weekly',
      description: 'A show about podcast operating systems.',
      feedStatus: 'live',
    }],
  });

  assert.equal(searchItems.length, 4);
  assert.ok(searchItems.some((item) => item.type === 'Episode' && item.searchText.includes('monetization sprint')));
  assert.ok(searchItems.some((item) => item.type === 'Idea' && item.searchText.includes('paying supporters')));
  assert.ok(searchItems.every((item) => item.href));
});

test('Phase 2 show dashboard summarizes feed health and release momentum', () => {
  const showId = new mongoose.Types.ObjectId();
  const show = {
    _id: showId,
    name: 'VicPods Weekly',
    slug: 'vicpods-weekly',
    description: 'A tactical show for creators.',
    feedStatus: 'live',
  };
  const dashboard = buildShowDashboard({
    shows: [show],
    feedHealth: [{
      show,
      errorCount: 1,
      warningCount: 1,
      totalChecks: 10,
      passedChecks: 8,
      passed: false,
    }],
    episodes: [
      makeEpisode({
        showId,
        publishStatus: 'published',
        publishedAt: new Date('2026-07-18T09:00:00.000Z'),
        title: 'Launch Week',
      }),
      makeEpisode({
        showId,
        publishStatus: 'scheduled',
        scheduledFor: new Date('2026-07-25T09:00:00.000Z'),
        title: 'Retention Week',
      }),
    ],
  });

  assert.equal(dashboard.summary.totalShows, 1);
  assert.equal(dashboard.summary.liveShows, 1);
  assert.equal(dashboard.summary.averageFeedScore, 80);
  assert.equal(dashboard.summary.scheduledEpisodes, 1);
  assert.equal(dashboard.shows[0].issueCount, 2);
  assert.equal(dashboard.shows[0].publishedCount, 1);
  assert.equal(dashboard.shows[0].scheduledCount, 1);
  assert.equal(dashboard.shows[0].latestEpisodeTitle, 'Launch Week');
});

test('Phase 2 creator calendar covers planned, recording, scheduled, and published work', () => {
  const calendar = buildCalendarItems([
    makeEpisode({ status: 'Planned', createdAt: new Date('2026-07-21T09:00:00.000Z') }),
    makeEpisode({ status: 'Ready', createdAt: new Date('2026-07-22T09:00:00.000Z') }),
    makeEpisode({
      publishStatus: 'scheduled',
      scheduledFor: new Date('2026-07-23T09:00:00.000Z'),
    }),
    makeEpisode({
      publishStatus: 'published',
      publishedAt: new Date('2026-07-24T09:00:00.000Z'),
    }),
  ]);

  assert.deepEqual(
    calendar.map((item) => item.statusLabel),
    ['Planned', 'Recording Prep', 'Scheduled', 'Published']
  );
  assert.ok(calendar.every((item) => item.id && item.href));
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
