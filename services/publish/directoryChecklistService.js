const DIRECTORY_PLATFORMS = [
  {
    key: 'spotify',
    name: 'Spotify for Creators',
    submissionUrl: 'https://creators.spotify.com/',
    note: 'Submit or claim the show, then verify feed ownership.',
  },
  {
    key: 'apple',
    name: 'Apple Podcasts Connect',
    submissionUrl: 'https://podcastsconnect.apple.com/',
    note: 'Apple requires a valid RSS feed, artwork, owner email, category, and at least one episode.',
  },
  {
    key: 'youtube',
    name: 'YouTube Podcasts',
    submissionUrl: 'https://studio.youtube.com/',
    note: 'Use YouTube Studio to connect or publish podcast episodes for YouTube discovery.',
  },
  {
    key: 'amazon',
    name: 'Amazon Music',
    submissionUrl: 'https://podcasters.amazon.com/',
    note: 'Submit the RSS feed through Amazon Music for Podcasters.',
  },
  {
    key: 'pocket-casts',
    name: 'Pocket Casts',
    submissionUrl: 'https://pocketcasts.com/submit/',
    note: 'Submit the feed after the first episode is live.',
  },
  {
    key: 'overcast',
    name: 'Overcast',
    submissionUrl: 'https://overcast.fm/add',
    note: 'Overcast can index valid public RSS feeds.',
  },
];

const DIRECTORY_PLATFORM_KEYS = new Set(DIRECTORY_PLATFORMS.map((platform) => platform.key));
const DIRECTORY_TRACKING_STATUSES = new Set(['not_started', 'submitted', 'listed', 'needs_attention']);

function toPlainObject(value) {
  if (!value) {
    return {};
  }
  if (typeof value.toObject === 'function') {
    return value.toObject();
  }
  return { ...value };
}

function buildSubmissionMap(show) {
  const entries = Array.isArray(show?.directorySubmissions) ? show.directorySubmissions : [];
  return new Map(entries
    .map((entry) => {
      const normalized = toPlainObject(entry);
      const platformKey = String(normalized.platformKey || '').trim();
      if (!DIRECTORY_PLATFORM_KEYS.has(platformKey)) {
        return null;
      }
      return [platformKey, normalized];
    })
    .filter(Boolean));
}

function formatDateLabel(value) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}

function buildDirectoryStatusDetail({ status, platform, trackedEntry, ready }) {
  if (status === 'blocked') {
    return 'Fix feed health issues before submitting.';
  }

  if (status === 'ready') {
    return platform.note;
  }

  if (status === 'submitted') {
    const submittedDate = formatDateLabel(trackedEntry.submittedAt);
    return submittedDate
      ? `Submitted on ${submittedDate}. Waiting for the platform to review the feed.`
      : 'Submitted and waiting for the platform review.';
  }

  if (status === 'listed') {
    const listedDate = formatDateLabel(trackedEntry.listedAt);
    if (trackedEntry.listingUrl) {
      return listedDate
        ? `Listed on ${listedDate}. Save the public listing URL so the team can check it quickly.`
        : 'Listed and discoverable. Save the public listing URL so the team can check it quickly.';
    }

    return listedDate
      ? `Listed on ${listedDate}.`
      : 'Listed and discoverable.';
  }

  if (status === 'needs_attention') {
    return trackedEntry.notes || (ready
      ? 'This directory needs a follow-up before the show is fully distributed.'
      : 'This directory needs a follow-up after feed issues are resolved.');
  }

  return platform.note;
}

function buildDirectoryStatusLabel(status) {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'ready':
      return 'Ready';
    case 'submitted':
      return 'Submitted';
    case 'listed':
      return 'Listed';
    case 'needs_attention':
      return 'Needs Attention';
    default:
      return 'Not Started';
  }
}

function buildDirectoryChecklist({ feedValidation, feedUrl, show } = {}) {
  const ready = Boolean(feedValidation && feedValidation.passed);
  const trackedByPlatform = buildSubmissionMap(show);

  return DIRECTORY_PLATFORMS.map((platform) => {
    const trackedEntry = trackedByPlatform.get(platform.key) || {};
    const trackedStatus = DIRECTORY_TRACKING_STATUSES.has(String(trackedEntry.status || '').trim())
      ? trackedEntry.status
      : 'not_started';

    let status = trackedStatus;
    if (trackedStatus === 'not_started') {
      status = ready ? 'ready' : 'blocked';
    }

    return {
      ...platform,
      feedUrl,
      status,
      statusLabel: buildDirectoryStatusLabel(status),
      detail: buildDirectoryStatusDetail({ status, platform, trackedEntry, ready }),
      actionLabel: trackedEntry.listingUrl ? 'View listing' : (status === 'ready' ? 'Submit' : 'Open'),
      submittedAt: trackedEntry.submittedAt || null,
      listedAt: trackedEntry.listedAt || null,
      listingUrl: trackedEntry.listingUrl || '',
      notes: trackedEntry.notes || '',
      lastCheckedAt: trackedEntry.lastCheckedAt || null,
    };
  });
}

module.exports = {
  DIRECTORY_PLATFORMS,
  DIRECTORY_PLATFORM_KEYS,
  DIRECTORY_TRACKING_STATUSES,
  buildDirectoryChecklist,
};
