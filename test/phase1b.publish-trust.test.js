const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Episode = require('../models/Episode');
const { buildFeedValidation } = require('../services/publish/feedValidationService');
const { importTranscriptToEpisode, parseTimestampedTranscript } = require('../services/transcript/transcriptImportService');

test('Phase 1B transcript import normalizes timestamped text and seeds chapters', () => {
  const episode = {
    _id: new mongoose.Types.ObjectId(),
    outline: ['Cold open', 'Guest story', 'Practical takeaway'],
    durationSeconds: 180,
    recordingWorkflow: {
      status: 'recorded',
      postRecordStatus: 'uploaded',
    },
  };

  const result = importTranscriptToEpisode(episode, {
    transcriptText: [
      '1',
      '00:00:00,000 --> 00:00:20,000',
      'Welcome back to the show.',
      '',
      '2',
      '00:01:00,000 --> 00:01:20,000',
      'Here is the guest story in detail.',
      '',
      '3',
      '00:02:00,000 --> 00:02:20,000',
      'Let us land with a practical takeaway.',
    ].join('\n'),
  });

  assert.equal(result.sourceFormat, 'srt');
  assert.ok(episode.transcript.includes('Welcome back to the show.'));
  assert.equal(episode.chapters.length, 3);
  assert.equal(episode.chapters[0].title, 'Cold open');
  assert.equal(episode.chapters[1].startSeconds, 60);
  assert.equal(episode.chapters[2].title, 'Practical takeaway');
  assert.equal(episode.recordingWorkflow.status, 'transcript_imported');
  assert.equal(episode.recordingWorkflow.postRecordStatus, 'transcript_imported');
  assert.ok(episode.recordingWorkflow.transcriptImportedAt instanceof Date);
});

test('Phase 1B parses WEBVTT cues into plain transcript text', () => {
  const parsed = parseTimestampedTranscript([
    'WEBVTT',
    '',
    '00:00:00.000 --> 00:00:05.000',
    'One clear lesson.',
    '',
    '00:02:10.000 --> 00:02:15.000',
    'A stronger closing idea.',
  ].join('\n'));

  assert.equal(parsed.sourceFormat, 'vtt');
  assert.equal(parsed.cues.length, 2);
  assert.ok(parsed.plainText.includes('One clear lesson.'));
  assert.equal(parsed.cues[1].startSeconds, 130);
});

test('Phase 1B feed validation surfaces richer publish warnings without blocking ready feeds', () => {
  const validation = buildFeedValidation({
    show: {
      name: 'Ready Show',
      slug: 'ready-show',
      description: 'A ready feed.',
      authorName: 'VicPods Creator',
      ownerEmail: 'creator@example.com',
      language: 'en-us',
      categoryPrimary: 'Technology',
      coverImageUrl: 'https://vicpods.example/cover.png',
      websiteUrl: 'https://vicpods.example/podcasts/ready-show',
    },
    episodes: [
      {
        _id: 'episode-1',
        title: 'Launch Episode',
        summary: 'A complete episode.',
        publicSlug: 'launch-episode',
        publishStatus: 'published',
        audioAssetId: {
          storageKey: 'uploads/audio/show/episode.mp3',
        },
      },
    ],
    baseUrl: 'https://vicpods.example',
  });

  assert.equal(validation.passed, true);
  assert.ok(validation.warningCount >= 1);
  assert.ok(validation.checks.some((check) => check.key === 'feed-url' && check.passed));
  assert.ok(validation.checks.some((check) => check.key === 'episode-episode-1-duration' && check.severity === 'warning'));
  assert.ok(validation.checks.some((check) => check.key === 'episode-episode-1-chapters' && check.severity === 'warning'));
});

test('Phase 1B episode schema exposes chapter markers', () => {
  assert.ok(Episode.schema.paths.chapters);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
