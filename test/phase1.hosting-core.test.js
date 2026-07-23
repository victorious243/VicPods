const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const AudioAsset = require('../models/AudioAsset');
const Episode = require('../models/Episode');
const { MediaProcessingJob } = require('../models/MediaProcessingJob');
const { processQueuedMediaJobs } = require('../services/media/mediaJobWorkerService');
const { extractAudioMetadataFromBuffer } = require('../services/publish/audioMetadataService');

function buildFakeMp3Buffer({ seconds = 3, withId3 = true } = {}) {
  const header = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
  const audioByteLength = Math.max(16000, Math.round((128 * 1000 * seconds) / 8));
  const payload = Buffer.concat([header, Buffer.alloc(Math.max(0, audioByteLength - header.length), 0)]);
  const id3Tag = withId3
    ? Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    : Buffer.alloc(0);

  return Buffer.concat([id3Tag, payload]);
}

test('Phase 1 audio metadata extraction reads MP3 frame details', () => {
  const metadata = extractAudioMetadataFromBuffer(buildFakeMp3Buffer({ seconds: 3 }), {
    mimeType: 'audio/mpeg',
  });

  assert.equal(metadata.mimeType, 'audio/mpeg');
  assert.equal(metadata.audioPayloadOffset, 10);
  assert.equal(metadata.bitrateKbps, 128);
  assert.equal(metadata.sampleRateHz, 44100);
  assert.equal(metadata.durationSeconds, 3);
  assert.equal(metadata.mpegVersion, '1');
  assert.equal(metadata.mpegLayer, 'III');
});

test('Phase 1 media worker processes queued audio metadata jobs', async () => {
  const originalClaim = MediaProcessingJob.findOneAndUpdate;
  const originalAssetFindOne = AudioAsset.findOne;
  const originalEpisodeFindOne = Episode.findOne;
  const testFolder = path.join(process.cwd(), 'public', 'uploads', 'audio', '__phase1-tests__', 'episode-1');
  const absolutePath = path.join(testFolder, 'sample.mp3');
  const storageKey = 'uploads/audio/__phase1-tests__/episode-1/sample.mp3';
  const errors = [];

  fs.mkdirSync(testFolder, { recursive: true });
  fs.writeFileSync(absolutePath, buildFakeMp3Buffer({ seconds: 2 }));

  const job = {
    _id: 'job-1',
    userId: 'user-1',
    episodeId: 'episode-1',
    jobType: 'audio_metadata',
    status: 'processing',
    lastError: '',
    resultUrl: '',
    metadata: new Map([
      ['audioAssetId', 'asset-1'],
      ['storageKey', storageKey],
      ['mimeType', 'audio/mpeg'],
    ]),
    async save() {
      return this;
    },
  };

  const asset = {
    _id: 'asset-1',
    userId: 'user-1',
    episodeId: 'episode-1',
    storageKey,
    mimeType: 'audio/mpeg',
    byteSize: 0,
    metadataStatus: 'pending',
    durationSeconds: null,
    bitrateKbps: null,
    processedAt: null,
    async save() {
      return this;
    },
  };

  const episode = {
    _id: 'episode-1',
    userId: 'user-1',
    durationSeconds: null,
    async save() {
      return this;
    },
  };

  let claimCount = 0;
  MediaProcessingJob.findOneAndUpdate = async () => {
    claimCount += 1;
    return claimCount === 1 ? job : null;
  };
  AudioAsset.findOne = async () => asset;
  Episode.findOne = async () => episode;

  try {
    const summary = await processQueuedMediaJobs({
      limit: 1,
      logger: {
        error(message) {
          errors.push(message);
        },
      },
    });

    assert.deepEqual(summary, {
      claimed: 1,
      completed: 1,
      failed: 0,
    });
    assert.equal(errors.length, 0);
    assert.equal(asset.metadataStatus, 'ready');
    assert.equal(asset.durationSeconds, 2);
    assert.equal(asset.bitrateKbps, 128);
    assert.ok(asset.processedAt instanceof Date);
    assert.equal(episode.durationSeconds, 2);
    assert.equal(job.status, 'ready');
    assert.equal(job.lastError, '');
    assert.equal(job.resultUrl, '/uploads/audio/__phase1-tests__/episode-1/sample.mp3');
    assert.equal(job.metadata.get('sampleRateHz'), '44100');
    assert.equal(job.metadata.get('durationSeconds'), '2');
  } finally {
    MediaProcessingJob.findOneAndUpdate = originalClaim;
    AudioAsset.findOne = originalAssetFindOne;
    Episode.findOne = originalEpisodeFindOne;
    fs.rmSync(path.join(process.cwd(), 'public', 'uploads', 'audio', '__phase1-tests__'), {
      force: true,
      recursive: true,
    });
  }
});

test('Phase 1 schemas expose hosting-core metadata fields', () => {
  assert.ok(AudioAsset.schema.paths.metadataStatus);
  assert.ok(MediaProcessingJob.schema.paths.lastError);
  assert.ok(MediaProcessingJob.schema.paths.jobType.enumValues.includes('audio_metadata'));
});
