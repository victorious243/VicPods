const Episode = require('../../models/Episode');
const { IntegrationConnection, INTEGRATION_PROVIDERS } = require('../../models/IntegrationConnection');
const { MediaProcessingJob } = require('../../models/MediaProcessingJob');
const WebhookDelivery = require('../../models/WebhookDelivery');
const { buildPublishedEpisodeUrl } = require('../publish/publishService');

const INTEGRATION_EVENTS = [
  'episode.published',
  'episode.scheduled',
  'analytics.weekly_summary',
  'media.clip_ready',
  'media.cleanup_requested',
  'team.approval_requested',
];

function compactText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeUrl(value) {
  const url = compactText(value, 500);
  if (!url) {
    return '';
  }
  return /^https?:\/\//i.test(url) ? url : '';
}

function normalizeConnectionInput(body) {
  const provider = INTEGRATION_PROVIDERS.includes(body.provider) ? body.provider : 'webhook';
  const events = Array.isArray(body.events) ? body.events : [body.events].filter(Boolean);

  return {
    provider,
    label: compactText(body.label, 120) || provider,
    endpointUrl: normalizeUrl(body.endpointUrl),
    status: ['configured', 'paused', 'needs_auth'].includes(body.status) ? body.status : 'configured',
    events: events.filter((event) => INTEGRATION_EVENTS.includes(event)).slice(0, 12),
    settings: {
      audienceId: compactText(body.audienceId, 120),
      defaultChannel: compactText(body.defaultChannel, 120),
      exportFolder: compactText(body.exportFolder, 200),
    },
  };
}

function buildWebhookPayload({ eventType, episode, show, baseUrl }) {
  const episodeUrl = show && episode?.publicSlug
    ? buildPublishedEpisodeUrl(show, episode, baseUrl)
    : '';

  return {
    eventType,
    createdAt: new Date().toISOString(),
    episode: episode
      ? {
          id: String(episode._id),
          title: episode.title || 'Untitled episode',
          publishStatus: episode.publishStatus || 'draft',
          approvalStatus: episode.approvalWorkflow?.status || 'not_started',
          url: episodeUrl,
        }
      : null,
    show: show
      ? {
          id: String(show._id),
          name: show.name,
          slug: show.slug,
        }
      : null,
  };
}

async function queueWebhookDeliveries({ userId, eventType, episode = null, show = null, baseUrl = '' }) {
  const connections = await IntegrationConnection.find({
    userId,
    provider: { $in: ['webhook', 'zapier'] },
    status: 'configured',
    events: eventType,
  });
  const payload = buildWebhookPayload({ eventType, episode, show, baseUrl });

  return Promise.all(connections.map((connection) => WebhookDelivery.create({
    userId,
    integrationId: connection._id,
    eventType,
    targetUrl: connection.endpointUrl,
    payloadPreview: JSON.stringify(payload).slice(0, 4000),
    status: connection.endpointUrl ? 'queued' : 'skipped',
  })));
}

function splitTranscriptWords(transcript) {
  return compactText(transcript, 30000).split(' ').filter(Boolean);
}

function buildClipSuggestions(episode) {
  const words = splitTranscriptWords(episode.transcript || episode.summary || episode.hook || episode.title);
  const title = episode.title || 'Episode clip';
  const baseHook = episode.hook || episode.summary || 'A strong podcast moment worth sharing.';
  const clipCount = Math.max(1, Math.min(3, Math.ceil(words.length / 120)));

  return Array.from({ length: clipCount }).map((_, index) => {
    const startSeconds = index * 45;
    const endSeconds = startSeconds + 45;

    return {
      title: index === 0 ? title + ' - strongest hook' : title + ' - clip ' + (index + 1),
      startSeconds,
      endSeconds,
      hook: compactText(baseHook, 300),
      platform: index === 1 ? 'linkedin' : 'shorts',
    };
  });
}

function secondsToSrtTime(value) {
  const total = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [
    String(hours).padStart(2, '0'),
    ':',
    String(minutes).padStart(2, '0'),
    ':',
    String(seconds).padStart(2, '0'),
    ',000',
  ].join('');
}

function buildCaptionDraft(episode) {
  const source = episode.transcript || episode.summary || episode.hook || episode.title || 'Podcast episode';
  const chunks = compactText(source, 5000).match(/.{1,84}(\s|$)/g) || [source];

  return chunks.slice(0, 40).map((chunk, index) => {
    const start = index * 5;
    return [
      String(index + 1),
      secondsToSrtTime(start) + ' --> ' + secondsToSrtTime(start + 5),
      compactText(chunk, 100),
    ].join('\n');
  }).join('\n\n');
}

function buildDescriptExportPack({ episode, show }) {
  return {
    provider: 'descript',
    title: episode.title || 'Untitled episode',
    showName: show?.name || 'VicPods show',
    transcript: episode.transcript || '',
    showNotes: episode.launchPack?.showNotes || episode.summary || '',
    markers: (episode.advancedMedia?.clipSuggestions || []).map((clip) => ({
      name: clip.title,
      startSeconds: clip.startSeconds,
      endSeconds: clip.endSeconds,
    })),
  };
}

function buildRiversideExportPack({ episode, show }) {
  return {
    provider: 'riverside',
    title: episode.title || 'Untitled episode',
    showName: show?.name || 'VicPods show',
    guestName: episode.recordingWorkflow?.guestName || '',
    recordingNotes: episode.recordingWorkflow?.sessionNotes || '',
    questions: episode.recordingWorkflow?.interviewQuestions || episode.hostQuestions || [],
  };
}

async function requestMediaJob({ userId, episode, jobType, provider = '', metadata = {} }) {
  return MediaProcessingJob.create({
    userId,
    episodeId: episode._id,
    jobType,
    provider,
    status: 'queued',
    metadata,
  });
}

async function buildAdvancedMediaDashboard({ userId }) {
  const [connections, episodes, jobs, deliveries] = await Promise.all([
    IntegrationConnection.find({ userId }).sort({ updatedAt: -1 }),
    Episode.find({ userId }).sort({ updatedAt: -1 }).limit(20).populate('showId'),
    MediaProcessingJob.find({ userId }).sort({ updatedAt: -1 }).limit(30),
    WebhookDelivery.find({ userId }).sort({ createdAt: -1 }).limit(30),
  ]);

  return {
    providers: INTEGRATION_PROVIDERS,
    events: INTEGRATION_EVENTS,
    connections,
    episodes: episodes.map((episode) => ({
      id: String(episode._id),
      title: episode.title || 'Untitled episode',
      showName: episode.showId?.name || 'No show',
      publishStatus: episode.publishStatus || 'draft',
      cleanupStatus: episode.advancedMedia?.cleanupRequest?.status || 'none',
      clipCount: episode.advancedMedia?.clipSuggestions?.length || 0,
      hasCaptions: Boolean(episode.advancedMedia?.captions?.content),
      href: episode.seriesId && episode.themeId
        ? '/kitchen/' + episode.seriesId + '/themes/' + episode.themeId + '/episodes/' + episode._id + '#episode-advanced-media'
        : '/kitchen',
    })),
    jobs,
    deliveries,
    metrics: {
      connections: connections.length,
      activeConnections: connections.filter((connection) => connection.status === 'configured').length,
      queuedJobs: jobs.filter((job) => job.status === 'queued').length,
      webhookQueue: deliveries.filter((delivery) => delivery.status === 'queued').length,
    },
  };
}

module.exports = {
  INTEGRATION_EVENTS,
  buildAdvancedMediaDashboard,
  buildCaptionDraft,
  buildClipSuggestions,
  buildDescriptExportPack,
  buildRiversideExportPack,
  buildWebhookPayload,
  normalizeConnectionInput,
  queueWebhookDeliveries,
  requestMediaJob,
};
