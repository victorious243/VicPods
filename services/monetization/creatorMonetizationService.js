const Episode = require('../../models/Episode');
const PodcastShow = require('../../models/PodcastShow');
const PrivateFeedToken = require('../../models/PrivateFeedToken');
const { buildPodcastFeedUrl } = require('../publish/publishService');

const AD_SLOT_POSITIONS = [
  { key: 'pre_roll', label: 'Pre-roll', defaultTimestampSeconds: 15 },
  { key: 'mid_roll', label: 'Mid-roll', defaultTimestampSeconds: 480 },
  { key: 'post_roll', label: 'Post-roll', defaultTimestampSeconds: null },
];

function compactText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeUrl(value) {
  const url = compactText(value, 500);
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return '';
}

function normalizeSupportLinks(rawLinks) {
  const rows = Array.isArray(rawLinks) ? rawLinks : [];

  return rows
    .map((link) => ({
      label: compactText(link.label, 80),
      url: normalizeUrl(link.url),
      provider: compactText(link.provider, 80),
    }))
    .filter((link) => link.label && link.url)
    .slice(0, 6);
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Custom';
  }

  return '$' + amount.toLocaleString('en-US');
}

function buildPrivateFeedUrl({ show, token, baseUrl }) {
  return [
    String(baseUrl || '').replace(/\/$/, ''),
    'podcasts',
    encodeURIComponent(show.slug),
    'private',
    encodeURIComponent(token.token),
    'feed.xml',
  ].join('/');
}

async function ensurePrivateFeedToken({ userId, showId, label = 'Premium listeners' }) {
  const existingToken = await PrivateFeedToken.findOne({
    userId,
    showId,
    accessType: 'creator_managed',
    status: 'active',
  }).sort({ createdAt: -1 });

  if (existingToken) {
    return existingToken;
  }

  return PrivateFeedToken.create({
    userId,
    showId,
    label: compactText(label, 120) || 'Premium listeners',
    accessType: 'creator_managed',
  });
}

async function buildMediaKit({ show, episodes, analytics = null, baseUrl }) {
  const liveEpisodes = episodes.filter((episode) => episode.publishStatus === 'published');
  const supportLinks = normalizeSupportLinks(show.monetization?.supportLinks || []);
  const rateCard = show.monetization?.rateCard || {};
  const showUrl = String(baseUrl || '').replace(/\/$/, '') + '/podcasts/' + show.slug;
  const feedUrl = buildPodcastFeedUrl(show, baseUrl);
  const totalDownloads = Number(analytics?.totals?.audioDownloads || 0);
  const totalPlays = Number(analytics?.totals?.playerPlays || 0);

  return {
    showName: show.name,
    authorName: show.authorName || show.name,
    description: show.description || 'Podcast published with VicPods.',
    audienceSummary: show.monetization?.audienceSummary || 'Audience profile is ready to be filled in before sponsor outreach.',
    sponsorPitch: show.monetization?.sponsorPitch || 'Sponsor ' + show.name + ' to reach listeners through useful, host-read podcast placements.',
    sponsorContactEmail: show.monetization?.sponsorContactEmail || show.ownerEmail || '',
    showUrl,
    feedUrl,
    supportLinks,
    metrics: [
      { label: 'Published Episodes', value: liveEpisodes.length },
      { label: 'Audio Downloads', value: totalDownloads },
      { label: 'Player Plays', value: totalPlays },
      { label: 'Support Links', value: supportLinks.length },
    ],
    rateCard: AD_SLOT_POSITIONS.map((slot) => ({
      key: slot.key,
      label: slot.label,
      price: formatMoney(rateCard[slot.key === 'pre_roll' ? 'preRoll' : slot.key === 'mid_roll' ? 'midRoll' : 'postRoll']),
    })),
  };
}

function buildSponsorOutreachTemplates(mediaKit) {
  const contact = mediaKit.sponsorContactEmail || 'your email';

  return [
    {
      label: 'Warm sponsor intro',
      subject: 'Sponsorship idea for ' + mediaKit.showName,
      body: [
        'Hi [Name]',
        '',
        'I host ' + mediaKit.showName + ', a podcast for ' + mediaKit.audienceSummary,
        '',
        'I think [Brand] could be a strong fit for our listeners. We offer host-read pre-roll, mid-roll, and post-roll placements, and I can share the full media kit here: ' + mediaKit.showUrl,
        '',
        'Would you be open to a quick conversation this week?',
        '',
        'Best,',
        mediaKit.authorName,
        contact,
      ].join('\n'),
    },
    {
      label: 'Direct response offer',
      subject: 'Podcast ad placement for ' + mediaKit.showName,
      body: [
        'Hi [Name]',
        '',
        mediaKit.showName + ' is opening sponsor slots for upcoming episodes. The audience is ' + mediaKit.audienceSummary,
        '',
        'Recommended first test: one mid-roll host-read placement with a listener offer and tracked CTA.',
        '',
        'Media kit: ' + mediaKit.showUrl,
        '',
        'Can I send over available dates and rates?',
        '',
        mediaKit.authorName,
      ].join('\n'),
    },
  ];
}

function buildAdSlotPlanner(episodes) {
  return episodes.slice(0, 12).map((episode) => {
    const existingSlots = Array.isArray(episode.monetization?.adSlots) ? episode.monetization.adSlots : [];
    const plannedSlots = existingSlots.length
      ? existingSlots
      : AD_SLOT_POSITIONS.map((slot) => ({
          position: slot.key,
          timestampSeconds: slot.defaultTimestampSeconds,
          sponsorName: '',
          copy: '',
          status: 'planned',
        }));

    return {
      episodeId: String(episode._id),
      title: episode.title || 'Untitled episode',
      publishStatus: episode.publishStatus,
      visibility: episode.monetization?.visibility || 'public',
      slots: plannedSlots.map((slot) => ({
        position: slot.position,
        label: AD_SLOT_POSITIONS.find((item) => item.key === slot.position)?.label || 'Ad slot',
        timestampSeconds: slot.timestampSeconds,
        sponsorName: slot.sponsorName || '',
        status: slot.status || 'planned',
        copy: slot.copy || '',
      })),
    };
  });
}

async function buildCreatorMonetizationDashboard({ userId, baseUrl, analytics = null }) {
  const shows = await PodcastShow.find({ userId }).sort({ updatedAt: -1 });
  const episodes = await Episode.find({ userId })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(50)
    .populate('showId');

  const tokens = await PrivateFeedToken.find({
    userId,
    showId: { $in: shows.map((show) => show._id) },
    status: 'active',
  });
  const creatorTokenByShowId = new Map(
    tokens
      .filter((token) => token.accessType !== 'subscriber_entitlement')
      .map((token) => [String(token.showId), token])
  );
  const subscriberCountsByShowId = tokens
    .filter((token) => token.accessType === 'subscriber_entitlement' && ['active', 'trialing'].includes(token.entitlementStatus))
    .reduce((map, token) => {
      const key = String(token.showId);
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map());

  const showDashboards = await Promise.all(shows.map(async (show) => {
    let privateToken = creatorTokenByShowId.get(String(show._id));
    if (show.monetization?.privateFeedsEnabled && !privateToken) {
      privateToken = await ensurePrivateFeedToken({ userId, showId: show._id });
    }

    const showEpisodes = episodes.filter((episode) => String(episode.showId?._id || episode.showId || '') === String(show._id));
    const mediaKit = await buildMediaKit({ show, episodes: showEpisodes, analytics, baseUrl });

    return {
      show,
      supportLinks: normalizeSupportLinks(show.monetization?.supportLinks || []),
      mediaKit,
      outreachTemplates: buildSponsorOutreachTemplates(mediaKit),
      adSlotPlanner: buildAdSlotPlanner(showEpisodes),
      privateFeedUrl: privateToken ? buildPrivateFeedUrl({ show, token: privateToken, baseUrl }) : '',
      privateToken,
      privateSubscriberCount: subscriberCountsByShowId.get(String(show._id)) || 0,
    };
  }));

  const premiumEpisodeCount = episodes.filter((episode) => ['premium', 'private'].includes(episode.monetization?.visibility)).length;
  const sponsorReadyShowCount = showDashboards.filter((item) => (
    item.mediaKit.sponsorContactEmail
    && item.mediaKit.sponsorPitch
    && item.mediaKit.supportLinks.length
  )).length;

  return {
    shows: showDashboards,
    metrics: {
      shows: shows.length,
      supportLinks: showDashboards.reduce((total, item) => total + item.supportLinks.length, 0),
      premiumEpisodes: premiumEpisodeCount,
      sponsorReadyShows: sponsorReadyShowCount,
    },
  };
}

module.exports = {
  AD_SLOT_POSITIONS,
  buildAdSlotPlanner,
  buildCreatorMonetizationDashboard,
  buildMediaKit,
  buildPrivateFeedUrl,
  buildSponsorOutreachTemplates,
  ensurePrivateFeedToken,
  normalizeSupportLinks,
};
