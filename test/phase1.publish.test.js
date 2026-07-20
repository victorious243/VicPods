const assert = require('node:assert/strict');
const test = require('node:test');
const { buildDirectoryChecklist } = require('../services/publish/directoryChecklistService');
const { buildFeedValidation } = require('../services/publish/feedValidationService');
const { buildPublicCoverPath, buildPublicCoverUrl, MAX_COVER_BYTES } = require('../services/publish/coverStorageService');

test('feed validation blocks incomplete shows before directory submission', () => {
  const validation = buildFeedValidation({
    show: {
      name: 'Incomplete Show',
      slug: 'incomplete-show',
      language: 'en-us',
    },
    episodes: [],
    baseUrl: 'https://vicpods.example',
  });

  assert.equal(validation.passed, false);
  assert.ok(validation.errorCount > 0);
  assert.ok(validation.checks.some((check) => check.key === 'description' && !check.passed));
  assert.ok(validation.checks.some((check) => check.key === 'episodes' && !check.passed));
});

test('feed validation passes a complete publish-ready show', () => {
  const validation = buildFeedValidation({
    show: {
      name: 'Complete Show',
      slug: 'complete-show',
      description: 'A complete podcast feed.',
      authorName: 'VicPods Creator',
      ownerEmail: 'creator@example.com',
      language: 'en-us',
      categoryPrimary: 'Technology',
      coverImageUrl: 'https://vicpods.example/cover.png',
      websiteUrl: 'https://vicpods.example/podcasts/complete-show',
    },
    episodes: [
      {
        _id: 'episode1',
        title: 'Launch Episode',
        summary: 'A complete episode.',
        publishStatus: 'published',
        audioAssetId: {
          storageKey: 'uploads/audio/show/episode.mp3',
        },
      },
    ],
    baseUrl: 'https://vicpods.example',
  });

  assert.equal(validation.passed, true);
  assert.equal(validation.errorCount, 0);
});

test('directory checklist is blocked until feed health passes', () => {
  const blocked = buildDirectoryChecklist({
    feedUrl: 'https://vicpods.example/podcasts/show/feed.xml',
    feedValidation: { passed: false },
  });
  const ready = buildDirectoryChecklist({
    feedUrl: 'https://vicpods.example/podcasts/show/feed.xml',
    feedValidation: { passed: true },
  });

  assert.ok(blocked.every((platform) => platform.status === 'blocked'));
  assert.ok(ready.every((platform) => platform.status === 'ready'));
  assert.ok(ready.some((platform) => platform.key === 'spotify'));
  assert.ok(ready.some((platform) => platform.key === 'apple'));
});

test('cover storage helpers expose public cover paths and limits', () => {
  assert.equal(MAX_COVER_BYTES, 5 * 1024 * 1024);
  assert.equal(buildPublicCoverPath('/uploads/covers/user/show/cover.png'), '/uploads/covers/user/show/cover.png');
  assert.equal(
    buildPublicCoverUrl('uploads/covers/user/show/cover.png', 'https://vicpods.example'),
    'https://vicpods.example/uploads/covers/user/show/cover.png'
  );
});
