const AudioAsset = require('../../models/AudioAsset');
const Episode = require('../../models/Episode');
const { MediaProcessingJob } = require('../../models/MediaProcessingJob');
const { buildPublicAudioPath } = require('../publish/audioStorageService');
const { extractAudioMetadataFromStorageKey } = require('../publish/audioMetadataService');

let workerHandle = null;
let workerRunning = false;
const WORKER_JOB_TYPES = ['audio_metadata'];

function setJobMetadata(job, values) {
  const nextMetadata = new Map();
  const currentEntries = job.metadata instanceof Map
    ? Array.from(job.metadata.entries())
    : Object.entries(job.metadata || {});

  currentEntries.forEach(([key, value]) => {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      nextMetadata.set(key, String(value));
    }
  });

  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === null || typeof value === 'undefined' || value === '') {
      return;
    }

    nextMetadata.set(key, String(value));
  });

  job.metadata = nextMetadata;
}

function getJobMetadataValue(job, key) {
  if (job.metadata instanceof Map) {
    return job.metadata.get(key);
  }

  return job.metadata?.[key];
}

async function enqueueAudioMetadataJob({ userId, episodeId, audioAsset }) {
  return MediaProcessingJob.create({
    userId,
    episodeId,
    jobType: 'audio_metadata',
    provider: audioAsset.storageProvider || 'local_public',
    status: 'queued',
    resultUrl: buildPublicAudioPath(audioAsset.storageKey),
    metadata: {
      audioAssetId: String(audioAsset._id),
      storageKey: audioAsset.storageKey,
      byteSize: String(audioAsset.byteSize || 0),
      mimeType: audioAsset.mimeType || 'audio/mpeg',
      originalFilename: audioAsset.originalFilename || '',
    },
  });
}

async function markAudioMetadataFailure(job, asset, error) {
  if (asset) {
    asset.metadataStatus = 'failed';
    await asset.save();
  }

  job.status = 'failed';
  job.lastError = error.message;
  setJobMetadata(job, {
    errorMessage: error.message,
    failedAt: new Date().toISOString(),
  });
  await job.save();
}

async function processAudioMetadataJob(job) {
  const audioAssetId = getJobMetadataValue(job, 'audioAssetId');

  if (!audioAssetId) {
    throw new Error('Audio metadata job is missing audioAssetId.');
  }

  const asset = await AudioAsset.findOne({
    _id: audioAssetId,
    userId: job.userId,
    episodeId: job.episodeId,
  });

  if (!asset) {
    throw new Error('Audio asset not found for metadata extraction.');
  }

  asset.metadataStatus = 'processing';
  await asset.save();

  try {
    const metadata = await extractAudioMetadataFromStorageKey(asset.storageKey, {
      mimeType: asset.mimeType,
    });

    asset.byteSize = metadata.byteSize || asset.byteSize;
    asset.durationSeconds = metadata.durationSeconds || asset.durationSeconds;
    asset.bitrateKbps = metadata.bitrateKbps || asset.bitrateKbps;
    asset.processedAt = new Date();
    asset.metadataStatus = 'ready';
    await asset.save();

    const episode = await Episode.findOne({
      _id: asset.episodeId,
      userId: asset.userId,
    });

    if (episode && metadata.durationSeconds) {
      episode.durationSeconds = metadata.durationSeconds;
      await episode.save();
    }

    job.status = 'ready';
    job.lastError = '';
    job.resultUrl = buildPublicAudioPath(asset.storageKey);
    setJobMetadata(job, {
      durationSeconds: metadata.durationSeconds,
      bitrateKbps: metadata.bitrateKbps,
      sampleRateHz: metadata.sampleRateHz,
      audioByteLength: metadata.audioByteLength,
      processedAt: asset.processedAt.toISOString(),
    });
    await job.save();

    return {
      jobId: String(job._id),
      audioAssetId: String(asset._id),
      durationSeconds: asset.durationSeconds,
      bitrateKbps: asset.bitrateKbps,
    };
  } catch (error) {
    await markAudioMetadataFailure(job, asset, error);
    throw error;
  }
}

async function processMediaJob(job) {
  if (job.jobType === 'audio_metadata') {
    return processAudioMetadataJob(job);
  }

  job.status = 'ready';
  job.lastError = '';
  setJobMetadata(job, {
    skippedAt: new Date().toISOString(),
    skipReason: 'No worker handler registered for this job type yet.',
  });
  await job.save();
  return {
    jobId: String(job._id),
    skipped: true,
  };
}

async function claimNextMediaJob() {
  return MediaProcessingJob.findOneAndUpdate(
    {
      status: 'queued',
      jobType: { $in: WORKER_JOB_TYPES },
    },
    { $set: { status: 'processing', lastError: '' } },
    {
      new: true,
      sort: { createdAt: 1 },
    }
  );
}

async function processQueuedMediaJobs({ limit = 5, logger = console } = {}) {
  const summary = {
    claimed: 0,
    completed: 0,
    failed: 0,
  };

  for (let index = 0; index < Math.max(1, limit); index += 1) {
    const job = await claimNextMediaJob();
    if (!job) {
      break;
    }

    summary.claimed += 1;

    try {
      await processMediaJob(job);
      summary.completed += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error('VicPods media job failed: ' + error.message);
    }
  }

  return summary;
}

function kickMediaJobWorker(logger = console) {
  setImmediate(() => {
    processQueuedMediaJobs({ limit: 1, logger }).catch((error) => {
      logger.error('VicPods media job kick failed: ' + error.message);
    });
  });
}

function startMediaJobWorker({ intervalMs = 20 * 1000, logger = console } = {}) {
  if (workerHandle || process.env.MEDIA_JOB_WORKER_DISABLED === 'true') {
    return workerHandle;
  }

  workerHandle = setInterval(async () => {
    if (workerRunning) {
      return;
    }

    workerRunning = true;
    try {
      await processQueuedMediaJobs({ logger });
    } catch (error) {
      logger.error('VicPods media job worker failed: ' + error.message);
    } finally {
      workerRunning = false;
    }
  }, Math.max(10 * 1000, intervalMs));

  if (typeof workerHandle.unref === 'function') {
    workerHandle.unref();
  }

  kickMediaJobWorker(logger);
  return workerHandle;
}

function stopMediaJobWorker() {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

module.exports = {
  claimNextMediaJob,
  enqueueAudioMetadataJob,
  kickMediaJobWorker,
  processAudioMetadataJob,
  processMediaJob,
  processQueuedMediaJobs,
  startMediaJobWorker,
  stopMediaJobWorker,
};
