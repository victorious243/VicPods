const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const Series = require('../models/Series');
const { FREE_DAILY_LIMIT } = require('../services/limitService');
const { renderPage } = require('../utils/render');

async function showStudio(req, res, next) {
  try {
    const userId = req.currentUser._id;

    const [seriesCount, episodeCount, servedCount, ideaCount, latestEpisodes] = await Promise.all([
      Series.countDocuments({ userId }),
      Episode.countDocuments({ userId }),
      Episode.countDocuments({ userId, status: 'Served' }),
      Idea.countDocuments({ userId }),
      Episode.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('seriesId')
        .populate('themeId'),
    ]);

    return renderPage(res, {
      title: 'Studio - VicPods',
      pageTitle: 'Studio',
      subtitle: 'Your podcast command center.',
      view: 'studio/index',
      data: {
        stats: {
          seriesCount,
          episodeCount,
          servedCount,
          ideaCount,
          aiRemaining: req.currentUser.plan === 'free'
            ? Math.max(FREE_DAILY_LIMIT - req.currentUser.aiDailyCount, 0)
            : 'Unlimited',
        },
        latestEpisodes,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showStudio,
};
