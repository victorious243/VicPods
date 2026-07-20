const AudioAsset = require('../models/AudioAsset');
const Episode = require('../models/Episode');
const { recordPodcastAnalyticsEvent } = require('../services/analytics/podcastAnalyticsService');

function trackAudioDownload(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 400 || req.method !== 'GET') {
      return;
    }

    const storageKey = ('uploads/audio/' + String(req.path || '').replace(/^\/+/, '')).replace(/\/+/g, '/');

    AudioAsset.findOne({ storageKey })
      .select('_id userId episodeId status')
      .lean()
      .then((audioAsset) => {
        if (!audioAsset || audioAsset.status !== 'ready') {
          return null;
        }

        return Episode.findOne({ _id: audioAsset.episodeId, userId: audioAsset.userId })
          .select('_id userId showId')
          .lean()
          .then((episode) => {
            if (!episode?.showId) {
              return null;
            }

            return recordPodcastAnalyticsEvent({
              userId: episode.userId,
              showId: episode.showId,
              episodeId: episode._id,
              audioAssetId: audioAsset._id,
              eventType: 'audio_download',
              source: 'audio',
              req,
            });
          });
      })
      .catch(() => {});
  });

  return next();
}

module.exports = {
  trackAudioDownload,
};
