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

function objectIdString(value) {
  if (!value) {
    return '';
  }

  return String(value._id || value);
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

function formatFullDateLabel(date) {
  if (!date) {
    return 'No date set';
  }

  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function truncateText(value, maxLength = 128) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3).trimEnd() + '...';
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

function buildEpisodeDetailTabs({ episode, releaseReadiness } = {}) {
  const readinessScore = releaseReadiness?.overallScore || buildEpisodeReadinessScore(episode || {});
  const hasPlan = hasText(episode?.title) && hasText(episode?.hook) && Array.isArray(episode?.outline) && episode.outline.length > 0;
  const hasScript = hasText(episode?.summary)
    || hasText(episode?.launchPack?.showNotes)
    || hasText(episode?.transcript)
    || Array.isArray(episode?.talkingPoints) && episode.talkingPoints.length > 0;
  const recordingWorkflow = episode?.recordingWorkflow || {};
  const hasRecordingPrep = Boolean(episode?.audioAssetId)
    || hasText(episode?.transcript)
    || hasText(recordingWorkflow.sessionNotes)
    || ['prepped', 'recorded', 'uploaded', 'transcript_imported'].includes(recordingWorkflow.status);
  const hasPublishSetup = Boolean(episode?.showId) && hasText(episode?.publicSlug);
  const isPublished = episode?.publishStatus === 'published' || episode?.status === 'Served';

  return [
    {
      key: 'plan',
      label: 'Plan',
      href: '#episode-plan',
      status: hasPlan ? 'Ready' : 'Needs setup',
      complete: hasPlan,
      body: 'Goal, hook, structure, audience, and continuity.',
    },
    {
      key: 'script',
      label: 'Script',
      href: '#episode-script',
      status: hasScript ? readinessScore + '% ready' : 'Needs draft',
      complete: hasScript && readinessScore >= 70,
      body: 'Draft quality, show notes, launch copy, and writing intelligence.',
    },
    {
      key: 'record',
      label: 'Record',
      href: '#episode-record',
      status: hasRecordingPrep ? 'Workflow ready' : 'Needs prep',
      complete: hasRecordingPrep,
      body: 'Teleprompter, guest prep, checklist, notes, transcript, and final MP3.',
    },
    {
      key: 'publish',
      label: 'Publish',
      href: '#episode-publish',
      status: isPublished ? 'Live' : (hasPublishSetup ? 'Configured' : 'Needs setup'),
      complete: isPublished || hasPublishSetup,
      body: 'Hosted show, public page, feed metadata, and release timing.',
    },
    {
      key: 'grow',
      label: 'Grow',
      href: '#episode-grow',
      status: episode?.showNotesPack?.updatedAt || episode?.launchPack?.updatedAt ? 'Assets ready' : 'Needs assets',
      complete: Boolean(episode?.showNotesPack?.updatedAt || episode?.launchPack?.updatedAt),
      body: 'Share links, show notes, social copy, referral loop, and promotion.',
    },
  ];
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
    .filter((episode) => episode.scheduledFor || episode.publishedAt || episode.createdAt || episode.updatedAt)
    .sort((a, b) => new Date(a.scheduledFor || a.publishedAt || a.createdAt || a.updatedAt) - new Date(b.scheduledFor || b.publishedAt || b.createdAt || b.updatedAt))
    .slice(0, 12)
    .map((episode) => {
      const date = episode.scheduledFor || episode.publishedAt || episode.createdAt || episode.updatedAt;
      const stage = episodeStage(episode);
      const statusByStage = {
        draft: 'Planned',
        ready: 'Recording Prep',
        recorded: 'Recorded',
        scheduled: 'Scheduled',
        live: 'Published',
      };
      return {
        id: objectIdString(episode._id),
        title: episodeTitle(episode),
        date,
        dateLabel: formatDateLabel(date),
        fullDateLabel: formatFullDateLabel(date),
        stage,
        statusLabel: statusByStage[stage] || 'Updated',
        href: episodeEditorHref(episode),
      };
    });
}

function buildEpisodeTabs(episodes = []) {
  const tabs = [
    {
      key: 'all',
      label: 'All',
      description: 'Everything in the Studio queue',
      predicate: () => true,
    },
    {
      key: 'draft',
      label: 'Drafts',
      description: 'Scripts and prep work still being shaped',
      predicate: (episode) => episodeStage(episode) === 'draft',
    },
    {
      key: 'ready',
      label: 'Ready',
      description: 'Episodes prepared for recording or upload',
      predicate: (episode) => episodeStage(episode) === 'ready',
    },
    {
      key: 'recorded',
      label: 'Recorded',
      description: 'Final audio is attached',
      predicate: (episode) => episodeStage(episode) === 'recorded',
    },
    {
      key: 'scheduled',
      label: 'Scheduled',
      description: 'Release dates are queued',
      predicate: (episode) => episodeStage(episode) === 'scheduled',
    },
    {
      key: 'live',
      label: 'Live',
      description: 'Published episodes',
      predicate: (episode) => episodeStage(episode) === 'live',
    },
  ];

  return tabs.map((tab) => {
    const items = episodes
      .filter(tab.predicate)
      .slice(0, 8)
      .map((episode) => ({
        id: objectIdString(episode),
        title: episodeTitle(episode),
        seriesName: episode.seriesId?.name || (episode.isSingle ? 'Single episode' : 'Series'),
        themeName: episode.themeId?.name || 'Theme pending',
        status: episode.publishStatus === 'published' ? 'Live' : episode.status,
        stage: episodeStage(episode),
        readinessScore: buildEpisodeReadinessScore(episode),
        dateLabel: formatFullDateLabel(episode.scheduledFor || episode.publishedAt || episode.updatedAt),
        href: episodeEditorHref(episode),
      }));

    return {
      key: tab.key,
      label: tab.label,
      description: tab.description,
      count: episodes.filter(tab.predicate).length,
      items,
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

function buildShowDashboard({ shows = [], feedHealth = [], episodes = [] }) {
  if (!shows.length) {
    return {
      summary: {
        totalShows: 0,
        liveShows: 0,
        averageFeedScore: 0,
        scheduledEpisodes: 0,
      },
      shows: [],
    };
  }

  const showEpisodeMap = episodes.reduce((map, episode) => {
    const key = objectIdString(episode.showId);
    if (!key) {
      return map;
    }

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(episode);
    return map;
  }, new Map());

  const healthMap = feedHealth.reduce((map, item) => {
    map.set(objectIdString(item.show), item);
    return map;
  }, new Map());

  const showCards = shows.map((show) => {
    const showEpisodes = showEpisodeMap.get(objectIdString(show)) || [];
    const health = healthMap.get(objectIdString(show));
    const totalChecks = health ? health.totalChecks : 0;
    const feedScore = totalChecks ? Math.round((health.passedChecks / totalChecks) * 100) : 0;
    const publishedCount = showEpisodes.filter((episode) => episode.publishStatus === 'published').length;
    const scheduledCount = showEpisodes.filter((episode) => episode.publishStatus === 'scheduled').length;
    const nextRelease = showEpisodes
      .filter((episode) => episode.publishStatus === 'scheduled' && episode.scheduledFor)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))[0] || null;
    const latestEpisode = showEpisodes
      .filter((episode) => episode.publishStatus === 'published' && episode.publishedAt)
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0] || null;

    return {
      id: objectIdString(show),
      name: show.name,
      description: truncateText(show.description || 'No show description yet.', 140),
      feedStatus: show.feedStatus,
      feedScore,
      issueCount: health ? health.errorCount + health.warningCount : 0,
      publishedCount,
      scheduledCount,
      nextReleaseLabel: nextRelease ? formatFullDateLabel(nextRelease.scheduledFor) : 'No release queued',
      latestEpisodeTitle: latestEpisode ? episodeTitle(latestEpisode) : 'No published episode yet',
      href: '/publish/shows',
      feedHref: '/podcasts/' + show.slug + '/feed.xml',
    };
  });

  const averageFeedScore = Math.round(
    showCards.reduce((sum, show) => sum + show.feedScore, 0) / showCards.length
  );

  return {
    summary: {
      totalShows: shows.length,
      liveShows: shows.filter((show) => show.feedStatus === 'live').length,
      averageFeedScore,
      scheduledEpisodes: showCards.reduce((sum, show) => sum + show.scheduledCount, 0),
    },
    shows: showCards,
  };
}

function buildGlobalSearchIndex({ series = [], ideas = [], episodes = [], shows = [] }) {
  const items = [];

  series.forEach((item) => {
    items.push({
      type: 'Series',
      title: item.name,
      meta: item.creationMode === 'single_collection' ? 'Single collection' : 'Series workspace',
      body: truncateText(item.description || item.seriesSummary || item.goal || 'Series workspace'),
      href: '/kitchen/' + item._id,
      tokens: [item.name, item.description, item.seriesSummary, item.goal].filter(Boolean).join(' '),
    });
  });

  episodes.forEach((episode) => {
    items.push({
      type: 'Episode',
      title: episodeTitle(episode),
      meta: (episode.seriesId?.name || 'Series') + ' · ' + (episode.themeId?.name || 'Theme pending'),
      body: truncateText(episode.hook || episode.summary || episode.launchPack?.description || 'Episode workspace'),
      href: episodeEditorHref(episode),
      tokens: [
        episodeTitle(episode),
        episode.seriesId?.name,
        episode.themeId?.name,
        episode.hook,
        episode.summary,
        episode.status,
        episode.publishStatus,
      ].filter(Boolean).join(' '),
    });
  });

  ideas.forEach((idea) => {
    items.push({
      type: 'Idea',
      title: idea.hook,
      meta: idea.tag || 'Idea bank',
      body: truncateText(idea.notes || 'Captured podcast idea'),
      href: '/pantry',
      tokens: [idea.hook, idea.tag, idea.notes].filter(Boolean).join(' '),
    });
  });

  shows.forEach((show) => {
    items.push({
      type: 'Show',
      title: show.name,
      meta: show.feedStatus === 'live' ? 'Live feed' : 'Draft feed',
      body: truncateText(show.description || show.categoryPrimary || 'Hosted podcast show'),
      href: '/publish/shows',
      tokens: [show.name, show.description, show.authorName, show.categoryPrimary, show.categorySecondary].filter(Boolean).join(' '),
    });
  });

  return items
    .filter((item) => item.title)
    .slice(0, 80)
    .map((item, index) => ({
      ...item,
      id: item.type.toLowerCase() + '-' + index,
      searchText: (item.title + ' ' + item.meta + ' ' + item.body + ' ' + item.tokens).toLowerCase(),
    }));
}

async function buildStudioCommandCenter({ userId, baseUrl }) {
  const [series, ideas, episodes, shows] = await Promise.all([
    Series.find({ userId }).sort({ updatedAt: -1 }).limit(50),
    Idea.find({ userId }).sort({ updatedAt: -1 }).limit(20),
    Episode.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(80)
      .populate('seriesId')
      .populate('themeId')
      .populate('audioAssetId'),
    PodcastShow.find({ userId }).sort({ updatedAt: -1 }).limit(12),
  ]);
  const seriesCount = series.length;

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
    episodeTabs: buildEpisodeTabs(episodes),
    showHealth: buildShowHealth({ shows, feedHealth }),
    showDashboard: buildShowDashboard({ shows, feedHealth, episodes }),
    globalSearchItems: buildGlobalSearchIndex({ series, ideas, episodes, shows }),
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
  buildEpisodeDetailTabs,
  buildEpisodeReadinessScore,
  buildEpisodeTabs,
  buildGlobalSearchIndex,
  buildNextActions,
  buildPipeline,
  buildShowDashboard,
  buildShowHealth,
  buildStudioCommandCenter,
  episodeStage,
};
