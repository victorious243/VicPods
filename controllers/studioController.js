const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const Series = require('../models/Series');
const { getDailyLimitForPlan } = require('../services/limitService');
const { renderPage } = require('../utils/render');

const INSPECT_KEYS = new Set(['series', 'episodes', 'single', 'ready', 'served', 'ideas', 'ai']);

function getEpisodeInspectQuery(userId, inspectKey) {
  const query = { userId };

  if (inspectKey === 'single') {
    query.isSingle = true;
  } else if (inspectKey === 'ready') {
    query.status = 'Ready';
  } else if (inspectKey === 'served') {
    query.status = 'Served';
  }

  return query;
}

async function getInspectPanel({ userId, inspectKey, t = (key, fallback) => fallback }) {
  if (!INSPECT_KEYS.has(inspectKey)) {
    return null;
  }

  if (inspectKey === 'series') {
    const items = await Series.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('name description createdAt updatedAt creationMode');

    return {
      key: inspectKey,
      title: t('studio.inspect.series', 'Series List'),
      items,
    };
  }

  if (inspectKey === 'ideas') {
    const items = await Idea.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('hook tag notes updatedAt');

    return {
      key: inspectKey,
      title: t('studio.inspect.ideas', 'Ideas List'),
      items,
    };
  }

  if (inspectKey === 'ai') {
    return {
      key: inspectKey,
      title: t('studio.inspect.ai', 'Chef AI Usage'),
      items: [],
    };
  }

  const items = await Episode.find(getEpisodeInspectQuery(userId, inspectKey))
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate('seriesId')
    .populate('themeId');

  const titleByKey = {
    episodes: t('studio.inspect.episodes', 'All Episodes'),
    single: t('studio.inspect.single', 'Single Episodes'),
    ready: t('studio.inspect.ready', 'Ready Episodes'),
    served: t('studio.inspect.served', 'Served Episodes'),
  };

  return {
    key: inspectKey,
    title: titleByKey[inspectKey] || t('studio.inspect.default', 'Episodes'),
    items,
  };
}

async function showStudio(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const effectivePlan = req.effectivePlan || req.currentUser.plan || 'free';
    const planLimit = getDailyLimitForPlan(effectivePlan);
    const selectedFilter = String(req.query.filter || 'all').toLowerCase();
    const selectedInspect = String(req.query.inspect || '').toLowerCase();

    const episodeQuery = { userId };
    if (selectedFilter === 'single') {
      episodeQuery.isSingle = true;
    } else if (selectedFilter === 'series') {
      episodeQuery.isSingle = { $ne: true };
    } else if (selectedFilter === 'ready') {
      episodeQuery.status = 'Ready';
    } else if (selectedFilter === 'served') {
      episodeQuery.status = 'Served';
    }

    const [
      seriesCount,
      episodeCount,
      servedCount,
      readyCount,
      singleEpisodeCount,
      ideaCount,
      latestEpisodes,
      inspectPanel,
    ] = await Promise.all([
      Series.countDocuments({ userId }),
      Episode.countDocuments({ userId }),
      Episode.countDocuments({ userId, status: 'Served' }),
      Episode.countDocuments({ userId, status: 'Ready' }),
      Episode.countDocuments({ userId, isSingle: true }),
      Idea.countDocuments({ userId }),
      Episode.find(episodeQuery)
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('seriesId')
        .populate('themeId'),
      getInspectPanel({ userId, inspectKey: selectedInspect, t: req.t }),
    ]);

    return renderPage(res, {
      title: req.t('page.studio.title', 'Studio - VicPods'),
      pageTitle: req.t('page.studio.header', 'Studio'),
      subtitle: req.t('page.studio.subtitle', 'Your podcast command center.'),
      view: 'studio/index',
      data: {
        stats: {
          seriesCount,
          episodeCount,
          servedCount,
          readyCount,
          singleEpisodeCount,
          ideaCount,
          aiRemaining: planLimit === Infinity
            ? req.t('studio.ai.unlimited', 'Unlimited')
            : Math.max(planLimit - req.currentUser.aiDailyCount, 0),
        },
        latestEpisodes,
        selectedFilter,
        selectedInspect,
        inspectPanel,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showStudio,
};
