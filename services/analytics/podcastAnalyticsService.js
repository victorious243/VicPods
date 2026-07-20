const crypto = require('crypto');
const Episode = require('../../models/Episode');
const EpisodeAnalyticsDaily = require('../../models/EpisodeAnalyticsDaily');
const PodcastAnalyticsEvent = require('../../models/PodcastAnalyticsEvent');
const PodcastShow = require('../../models/PodcastShow');

const EVENT_COUNTER_FIELD = {
  feed_request: 'feedRequests',
  audio_download: 'audioDownloads',
  player_play: 'playerPlays',
  player_complete: 'playerCompletions',
  share_click: 'shareClicks',
};

const KNOWN_BOTS = /(bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview|whatsapp|telegrambot)/i;
const MOBILE_RE = /(iphone|android.*mobile|mobile)/i;
const TABLET_RE = /(ipad|tablet|android(?!.*mobile))/i;
const PODCAST_APPS = [
  ['Apple Podcasts', /(podcasts|itunes|cfnetwork)/i],
  ['Spotify', /spotify/i],
  ['Overcast', /overcast/i],
  ['Pocket Casts', /pocketcasts/i],
  ['Podcast Addict', /podcastaddict/i],
  ['Castro', /castro/i],
  ['AntennaPod', /antennapod/i],
  ['Web Player', /(mozilla|chrome|safari|edge|firefox)/i],
];

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return dateKey(new Date());
  }
  return date.toISOString().slice(0, 10);
}

function hashValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function cleanDimension(value, fallback = 'Unknown', maxLength = 120) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function detectDeviceType(userAgent = '') {
  if (KNOWN_BOTS.test(userAgent)) {
    return 'bot';
  }
  if (TABLET_RE.test(userAgent)) {
    return 'tablet';
  }
  if (MOBILE_RE.test(userAgent)) {
    return 'mobile';
  }
  if (userAgent) {
    return 'desktop';
  }
  return 'unknown';
}

function detectPlatform(userAgent = '') {
  const match = PODCAST_APPS.find(([, pattern]) => pattern.test(userAgent));
  return match ? match[0] : 'Unknown';
}

function incrementMapValue(target, key, amount = 1) {
  const normalizedKey = cleanDimension(key);
  target[normalizedKey] = (Number(target[normalizedKey]) || 0) + amount;
}

function mapToObject(value) {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (typeof value.toObject === 'function') {
    return value.toObject();
  }
  return { ...value };
}

function sortedBreakdownFromMap(mapLike, limit = 8) {
  return Object.entries(mapToObject(mapLike))
    .map(([label, count]) => ({ label, count: Number(count) || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function buildEventContext(req = {}) {
  const headers = req.headers || {};
  const userAgent = String(headers['user-agent'] || '');
  const referrer = String(headers.referer || headers.referrer || '');
  const forwardedCountry = String(headers['cf-ipcountry'] || headers['x-vercel-ip-country'] || '').trim();
  const forwardedRegion = String(headers['x-vercel-ip-country-region'] || '').trim();
  const visitorId = req.cookies?.vicpodsVisitorId || req.session?.visitorId || '';
  const ip = req.ip || req.socket?.remoteAddress || '';

  return {
    platform: detectPlatform(userAgent),
    country: forwardedCountry || 'Unknown',
    region: forwardedRegion,
    referrer,
    deviceType: detectDeviceType(userAgent),
    userAgentHash: hashValue(userAgent),
    visitorHash: hashValue(visitorId || ip + userAgent),
  };
}

async function recordPodcastAnalyticsEvent({
  userId,
  showId,
  episodeId = null,
  audioAssetId = null,
  eventType,
  source = 'unknown',
  req = null,
  metadata = {},
  occurredAt = new Date(),
}) {
  if (!userId || !showId || !eventType) {
    return null;
  }

  const requestContext = req ? buildEventContext(req) : {};
  return PodcastAnalyticsEvent.create({
    userId,
    showId,
    episodeId,
    audioAssetId,
    eventType,
    source,
    occurredAt,
    ...requestContext,
    metadata,
  });
}

function summarizeDailyAnalytics({ dailyRows = [], episodes = [], shows = [], today = new Date() } = {}) {
  const episodeMap = new Map(episodes.map((episode) => [String(episode._id || episode.id), episode]));
  const showMap = new Map(shows.map((show) => [String(show._id || show.id), show]));
  const totals = {
    feedRequests: 0,
    audioDownloads: 0,
    playerPlays: 0,
    playerCompletions: 0,
    shareClicks: 0,
  };
  const byDate = new Map();
  const byEpisode = new Map();
  const breakdowns = {
    platforms: {},
    countries: {},
    referrers: {},
    devices: {},
  };

  dailyRows.forEach((row) => {
    const normalizedDateKey = row.dateKey || dateKey(row.date);
    const episodeKey = String(row.episodeId?._id || row.episodeId || '');
    const showKey = String(row.showId?._id || row.showId || '');
    const dateBucket = byDate.get(normalizedDateKey) || {
      dateKey: normalizedDateKey,
      feedRequests: 0,
      audioDownloads: 0,
      playerPlays: 0,
      playerCompletions: 0,
      shareClicks: 0,
    };
    const episodeBucket = byEpisode.get(episodeKey) || {
      episodeId: episodeKey,
      showId: showKey,
      title: episodeMap.get(episodeKey)?.title || 'Untitled episode',
      showName: showMap.get(showKey)?.name || 'Hosted show',
      audioDownloads: 0,
      playerPlays: 0,
      playerCompletions: 0,
      shareClicks: 0,
      completionRate: 0,
      trendScore: 0,
    };

    Object.keys(totals).forEach((field) => {
      const value = Number(row[field]) || 0;
      totals[field] += value;
      dateBucket[field] += value;
      if (field !== 'feedRequests') {
        episodeBucket[field] += value;
      }
    });

    ['platforms', 'countries', 'referrers', 'devices'].forEach((field) => {
      Object.entries(mapToObject(row[field])).forEach(([label, count]) => {
        incrementMapValue(breakdowns[field], label, Number(count) || 0);
      });
    });

    byDate.set(normalizedDateKey, dateBucket);
    if (episodeKey) {
      byEpisode.set(episodeKey, episodeBucket);
    }
  });

  const topEpisodes = [...byEpisode.values()]
    .map((episode) => ({
      ...episode,
      completionRate: episode.playerPlays
        ? Math.round((episode.playerCompletions / episode.playerPlays) * 100)
        : 0,
      trendScore: episode.audioDownloads + episode.playerPlays + episode.shareClicks * 2,
    }))
    .sort((a, b) => b.trendScore - a.trendScore || a.title.localeCompare(b.title))
    .slice(0, 10);

  const timeline = [...byDate.values()]
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    generatedAt: today,
    totals,
    timeline,
    topEpisodes,
    breakdowns: {
      platforms: sortedBreakdownFromMap(breakdowns.platforms),
      countries: sortedBreakdownFromMap(breakdowns.countries),
      referrers: sortedBreakdownFromMap(breakdowns.referrers),
      devices: sortedBreakdownFromMap(breakdowns.devices),
    },
  };
}

function buildGrowthRecommendations(summary = {}) {
  const totals = summary.totals || {};
  const topEpisode = summary.topEpisodes?.[0];
  const topReferrer = summary.breakdowns?.referrers?.[0];
  const topPlatform = summary.breakdowns?.platforms?.[0];
  const recommendations = [];

  if (!totals.audioDownloads && !totals.playerPlays) {
    recommendations.push({
      priority: 'high',
      title: 'Create a clean launch loop',
      body: 'Publish one episode, share one public page, and track the first downloads before optimizing topics.',
    });
  }

  if (topEpisode) {
    recommendations.push({
      priority: 'high',
      title: 'Double down on "' + topEpisode.title + '"',
      body: 'Use the strongest episode as the seed for a follow-up, short clip, or listener question prompt.',
    });
  }

  if (topReferrer && topReferrer.label !== 'Unknown') {
    recommendations.push({
      priority: 'medium',
      title: 'Promote where listeners already come from',
      body: topReferrer.label + ' is sending attention. Repeat that channel before spreading effort elsewhere.',
    });
  }

  if (topPlatform && topPlatform.label !== 'Unknown') {
    recommendations.push({
      priority: 'medium',
      title: 'Optimize for ' + topPlatform.label,
      body: 'Check episode titles, artwork, and descriptions in the app your listeners actually use.',
    });
  }

  if ((totals.shareClicks || 0) < Math.max(2, Math.round((totals.playerPlays || 0) * 0.1))) {
    recommendations.push({
      priority: 'low',
      title: 'Strengthen the share CTA',
      body: 'Add a clearer reason to share the episode in show notes and end-of-episode copy.',
    });
  }

  return recommendations.slice(0, 4);
}

async function aggregateDailyAnalytics({ from, to = new Date() } = {}) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const toDate = new Date(to);
  const events = await PodcastAnalyticsEvent.find({
    occurredAt: {
      $gte: fromDate,
      $lte: toDate,
    },
  }).lean();
  const buckets = new Map();

  events.forEach((event) => {
    if (!event.episodeId) {
      return;
    }

    const key = [event.userId, event.showId, event.episodeId, dateKey(event.occurredAt)].map(String).join(':');
    const bucket = buckets.get(key) || {
      userId: event.userId,
      showId: event.showId,
      episodeId: event.episodeId,
      dateKey: dateKey(event.occurredAt),
      feedRequests: 0,
      audioDownloads: 0,
      playerPlays: 0,
      playerCompletions: 0,
      shareClicks: 0,
      platforms: {},
      countries: {},
      referrers: {},
      devices: {},
    };
    const counterField = EVENT_COUNTER_FIELD[event.eventType];

    if (counterField) {
      bucket[counterField] += 1;
    }
    incrementMapValue(bucket.platforms, event.platform);
    incrementMapValue(bucket.countries, event.country);
    incrementMapValue(bucket.referrers, event.referrer || 'Direct');
    incrementMapValue(bucket.devices, event.deviceType);
    buckets.set(key, bucket);
  });

  const writes = [...buckets.values()].map((bucket) => EpisodeAnalyticsDaily.findOneAndUpdate(
    {
      episodeId: bucket.episodeId,
      dateKey: bucket.dateKey,
    },
    { $set: bucket },
    { upsert: true, new: true }
  ));

  return Promise.all(writes);
}

async function buildPodcastAnalyticsDashboard({ userId, from, to = new Date() }) {
  const fromDateKey = dateKey(from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const toDateKey = dateKey(to);
  const [dailyRows, episodes, shows] = await Promise.all([
    EpisodeAnalyticsDaily.find({
      userId,
      dateKey: {
        $gte: fromDateKey,
        $lte: toDateKey,
      },
    }).lean(),
    Episode.find({ userId, publishStatus: { $in: ['published', 'scheduled'] } })
      .select('title showId publicSlug publishedAt publishStatus')
      .lean(),
    PodcastShow.find({ userId })
      .select('name slug feedStatus')
      .lean(),
  ]);
  const summary = summarizeDailyAnalytics({ dailyRows, episodes, shows });

  return {
    ...summary,
    range: {
      from: fromDateKey,
      to: toDateKey,
    },
    recommendations: buildGrowthRecommendations(summary),
  };
}

function buildAnalyticsCsv(summary = {}) {
  const rows = [
    ['date', 'feed_requests', 'audio_downloads', 'player_plays', 'player_completions', 'share_clicks'],
    ...(summary.timeline || []).map((item) => [
      item.dateKey,
      item.feedRequests,
      item.audioDownloads,
      item.playerPlays,
      item.playerCompletions,
      item.shareClicks,
    ]),
  ];

  return rows.map((row) => row.map((value) => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
}

module.exports = {
  aggregateDailyAnalytics,
  buildAnalyticsCsv,
  buildEventContext,
  buildGrowthRecommendations,
  buildPodcastAnalyticsDashboard,
  dateKey,
  detectDeviceType,
  detectPlatform,
  recordPodcastAnalyticsEvent,
  summarizeDailyAnalytics,
};
