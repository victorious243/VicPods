const Episode = require('../../models/Episode');
const { syncPodcastShowStats } = require('./publishService');

let schedulerHandle = null;
let schedulerRunning = false;

async function publishDueEpisodes(now = new Date()) {
  const dueEpisodes = await Episode.find({
    showId: { $ne: null },
    publishStatus: 'scheduled',
    publicPageEnabled: true,
    scheduledFor: { $lte: now },
  }).select('_id showId scheduledFor publishedAt');

  if (!dueEpisodes.length) {
    return { publishedCount: 0, showIds: [] };
  }

  const showIds = new Set();

  await Promise.all(dueEpisodes.map((episode) => {
    episode.publishStatus = 'published';
    episode.publishedAt = episode.publishedAt || episode.scheduledFor || now;
    episode.scheduledFor = null;
    showIds.add(String(episode.showId));
    return episode.save();
  }));

  await Promise.all(Array.from(showIds).map((showId) => syncPodcastShowStats(showId)));

  return {
    publishedCount: dueEpisodes.length,
    showIds: Array.from(showIds),
  };
}

function startPublishScheduler({ intervalMs = 60 * 1000, logger = console } = {}) {
  if (schedulerHandle || process.env.PUBLISH_SCHEDULER_DISABLED === 'true') {
    return schedulerHandle;
  }

  schedulerHandle = setInterval(async () => {
    if (schedulerRunning) {
      return;
    }

    schedulerRunning = true;
    try {
      const result = await publishDueEpisodes();
      if (result.publishedCount > 0) {
        logger.info('Published ' + result.publishedCount + ' scheduled VicPods episode(s).');
      }
    } catch (error) {
      logger.error('VicPods publish scheduler failed: ' + error.message);
    } finally {
      schedulerRunning = false;
    }
  }, Math.max(15 * 1000, intervalMs));

  if (typeof schedulerHandle.unref === 'function') {
    schedulerHandle.unref();
  }

  return schedulerHandle;
}

function stopPublishScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}

module.exports = {
  publishDueEpisodes,
  startPublishScheduler,
  stopPublishScheduler,
};
