const Episode = require('../../models/Episode');
const Idea = require('../../models/Idea');
const PodcastShow = require('../../models/PodcastShow');
const Series = require('../../models/Series');
const { buildFeedValidation } = require('../publish/feedValidationService');

const PIPELINE_STAGES = [
  {
    key: 'idea',
    label: 'Idea',
    detail: 'Captured topics',
    href: '/pantry',
  },
  {
    key: 'draft',
    label: 'Draft',
    detail: 'Scripts in progress',
    href: '/kitchen',
  },
  {
    key: 'ready',
    label: 'Ready',
    detail: 'Approved prep',
    href: '/studio?inspect=ready',
  },
  {
    key: 'recorded',
    label: 'Recorded',
    detail: 'Audio attached',
    href: '/publish/shows',
  },
  {
    key: 'scheduled',
    label: 'Scheduled',
    detail: 'Launch queued',
    href: '/publish/shows',
  },
  {
    key: 'live',
    label: 'Live',
    detail: 'Public episodes',
    href: '/studio?inspect=served',
  },
];

function episodeStage(episode) {
  if (episode.publishStatus === 'published' || episode.status === 'Served') {
    return 'live';
  }
  if (episode.publishStatus === 'scheduled') {
    return 'scheduled';
  }
  if (episode.audioAssetId) {
    return 'recorded';
  }
  if (episode.status === 'Ready') {
    return 'ready';
  }
  return 'draft';
}

function episodeEditorHref(episode) {
  const seriesId = episode.seriesId?._id || episode.seriesId;
  const themeId = episode.themeId?._id || episode.themeId;

  if (seriesId && themeId) {
    return '/kitchen/' + seriesId + '/themes/' + themeId + '/episodes/' + episode._id;
  }

  if (seriesId) {
    return '/kitchen/' + seriesId;
  }

  return '/kitchen';
}

function episodeTitle(episode) {
  return episode.title || 'Episode ' + (episode.episodeNumberWithinTheme || '?');
}

function formatDateLabel(date) {
  if (!date) {
    return 'No date';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function buildPipeline({ ideas = [], episodes = [] }) {
  const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.key, 0]));
  const featured = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage.key, null]));

  counts.idea = ideas.length;
  featured.idea = ideas[0]
    ? {
      title: ideas[0].hook || 'Untitled idea',
      meta: ideas[0].tag || 'Idea bank',
      href: '/pantry',
    }
    : null;

  episodes.forEach((episode) => {
    const stageKey = episodeStage(episode);
    counts[stageKey] += 1;

    if (!featured[stageKey]) {
      featured[stageKey] = {
        title: episodeTitle(episode),
        meta: episode.seriesId?.name || (episode.isSingle ? 'Single episode' : 'Series'),
        href: episodeEditorHref(episode),
      };
    }
  });

  return PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: counts[stage.key] || 0,
    featured: featured[stage.key],
  }));
}

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function buildEpisodeReadinessScore(episode) {
  const checks = [
    hasText(episode.title),
    hasText(episode.hook),
    Array.isArray(episode.outline) && episode.outline.length > 0,
    Array.isArray(episode.talkingPoints) && episode.talkingPoints.length > 0,
    hasText(episode.summary) || hasText(episode.launchPack?.description),
    Boolean(episode.audioAssetId) || episode.status === 'Ready' || episode.status === 'Served',
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function buildNextActions({ seriesCount, episodes = [], shows = [], feedHealth = [] }) {
  const actions = [];
  const latestEpisode = episodes[0] || null;
  const draftEpisode = episodes.find((episode) => ['Planned', 'Draft'].includes(episode.status));
  const readyEpisode = episodes.find((episode) => episode.status === 'Ready' && episode.publishStatus === 'draft');
  const episodeWithoutAudio = episodes.find((episode) => episode.status === 'Ready' && !episode.audioAssetId);
  const unhealthyFeed = feedHealth.find((item) => item.errorCount > 0);

  if (!seriesCount) {
    actions.push({
      eyebrow: 'Start',
      title: 'Create your first show structure',
      body: 'Set up a series so Studio can organize your podcast pipeline.',
      href: '/create/series',
      cta: 'Start Series',
      tone: 'primary',
    });
  }

  if (!episodes.length) {
    actions.push({
      eyebrow: 'Draft',
      title: 'Generate your first episode',
      body: 'Move from a topic to a prepared script and launch assets.',
      href: '/create/single',
      cta: 'New Episode',
      tone: 'warm',
    });
  }

  if (draftEpisode) {
    actions.push({
      eyebrow: 'Write',
      title: 'Finish "' + episodeTitle(draftEpisode) + '"',
      body: 'Tighten the hook, outline, talking points, and show notes before recording.',
      href: episodeEditorHref(draftEpisode),
      cta: 'Continue Draft',
      tone: 'primary',
    });
  }

  if (episodeWithoutAudio) {
    actions.push({
      eyebrow: 'Record',
      title: 'Attach audio to "' + episodeTitle(episodeWithoutAudio) + '"',
      body: 'Ready episodes become publishable once final audio is uploaded.',
      href: '/publish/shows',
      cta: 'Upload Audio',
      tone: 'green',
    });
  }

  if (readyEpisode && shows.length) {
    actions.push({
      eyebrow: 'Publish',
      title: 'Schedule "' + episodeTitle(readyEpisode) + '"',
      body: 'Place the episode into a hosted show and queue its release.',
      href: '/publish/shows',
      cta: 'Schedule',
      tone: 'pink',
    });
  }

  if (unhealthyFeed) {
    actions.push({
      eyebrow: 'Feed Health',
      title: 'Fix ' + unhealthyFeed.show.name + ' metadata',
      body: unhealthyFeed.errorCount + ' publishing checks need attention before directory submission.',
      href: '/publish/shows',
      cta: 'Fix Feed',
      tone: 'warning',
    });
  }

  if (!shows.length && episodes.length) {
    actions.push({
      eyebrow: 'Launch',
      title: 'Create a hosted show',
      body: 'Turn your prepared episodes into a real feed with public pages.',
      href: '/publish/shows',
      cta: 'Create Show',
      tone: 'green',
    });
  }

  if (!actions.length && latestEpisode) {
    actions.push({
      eyebrow: 'Grow',
      title: 'Review the next best move',
      body: 'Your pipeline is moving. Check publishing status and prepare the next release.',
      href: '/publish/shows',
      cta: 'Open Publish',
      tone: 'primary',
    });
  }

  return actions.slice(0, 4);
}

function buildCalendarItems(episodes = []) {
  return episodes
    .filter((episode) => episode.scheduledFor || episode.publishedAt || episode.updatedAt)
    .sort((a, b) => new Date(a.scheduledFor || a.publishedAt || a.updatedAt) - new Date(b.scheduledFor || b.publishedAt || b.updatedAt))
    .slice(0, 5)
    .map((episode) => {
      const date = episode.scheduledFor || episode.publishedAt || episode.updatedAt;
      const stage = episodeStage(episode);
      return {
        title: episodeTitle(episode),
        date,
        dateLabel: formatDateLabel(date),
        stage,
        statusLabel: stage === 'scheduled' ? 'Scheduled' : (stage === 'live' ? 'Live' : 'Updated'),
        href: episodeEditorHref(episode),
      };
    });
}

function buildShowHealth({ shows = [], feedHealth = [] }) {
  if (!shows.length) {
    return {
      label: 'No hosted show',
      score: 0,
      detail: 'Create a hosted show to unlock feed health.',
      href: '/publish/shows',
    };
  }

  const totalChecks = feedHealth.reduce((sum, item) => sum + item.totalChecks, 0);
  const passedChecks = feedHealth.reduce((sum, item) => sum + item.passedChecks, 0);
  const score = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;
  const weakest = [...feedHealth].sort((a, b) => b.errorCount - a.errorCount)[0];

  return {
    label: score >= 90 ? 'Directory ready' : 'Needs polish',
    score,
    detail: weakest && weakest.errorCount
      ? weakest.show.name + ' has ' + weakest.errorCount + ' feed gaps.'
      : 'Core publishing metadata looks healthy.',
    href: '/publish/shows',
  };
}

async function buildStudioCommandCenter({ userId, baseUrl }) {
  const [seriesCount, ideas, episodes, shows] = await Promise.all([
    Series.countDocuments({ userId }),
    Idea.find({ userId }).sort({ updatedAt: -1 }).limit(20),
    Episode.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(80)
      .populate('seriesId')
      .populate('themeId')
      .populate('audioAssetId'),
    PodcastShow.find({ userId }).sort({ updatedAt: -1 }).limit(12),
  ]);

  const showIds = shows.map((show) => show._id);
  const publishEpisodes = showIds.length
    ? await Episode.find({
      userId,
      showId: { $in: showIds },
      publicPageEnabled: true,
      publishStatus: { $in: ['published', 'scheduled'] },
    }).populate('audioAssetId')
    : [];

  const episodesByShow = publishEpisodes.reduce((map, episode) => {
    const key = String(episode.showId);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(episode);
    return map;
  }, new Map());

  const feedHealth = shows.map((show) => {
    const validation = buildFeedValidation({
      show,
      episodes: episodesByShow.get(String(show._id)) || [],
      baseUrl,
    });

    return {
      show,
      errorCount: validation.errorCount,
      warningCount: validation.warningCount,
      totalChecks: validation.checks.length,
      passedChecks: validation.checks.filter((check) => check.passed).length,
      passed: validation.passed,
    };
  });

  const latestEpisode = episodes[0] || null;
  const readinessScore = latestEpisode ? buildEpisodeReadinessScore(latestEpisode) : 0;
  const liveEpisodes = episodes.filter((episode) => episode.publishStatus === 'published' || episode.status === 'Served').length;
  const scheduledEpisodes = episodes.filter((episode) => episode.publishStatus === 'scheduled').length;

  return {
    pipeline: buildPipeline({ ideas, episodes }),
    nextActions: buildNextActions({ seriesCount, episodes, shows, feedHealth }),
    calendarItems: buildCalendarItems(episodes),
    showHealth: buildShowHealth({ shows, feedHealth }),
    spotlight: latestEpisode
      ? {
        title: episodeTitle(latestEpisode),
        seriesName: latestEpisode.seriesId?.name || (latestEpisode.isSingle ? 'Single episode' : 'Series'),
        themeName: latestEpisode.themeId?.name || 'Theme pending',
        status: latestEpisode.publishStatus === 'published' ? 'Live' : latestEpisode.status,
        readinessScore,
        href: episodeEditorHref(latestEpisode),
      }
      : null,
    operatingMetrics: {
      shows: shows.length,
      scheduledEpisodes,
      liveEpisodes,
      readinessScore,
    },
  };
}

module.exports = {
  PIPELINE_STAGES,
  buildCalendarItems,
  buildEpisodeReadinessScore,
  buildNextActions,
  buildPipeline,
  buildShowHealth,
  buildStudioCommandCenter,
  episodeStage,
};
