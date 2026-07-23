const crypto = require('crypto');
const net = require('net');
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

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127)
    || first === 0;
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:');
}

function isLocalHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local');
}

function assessWebhookEndpointUrl(value, { isProduction = process.env.NODE_ENV === 'production' } = {}) {
  const rawUrl = compactText(value, 500);
  if (!rawUrl) {
    return { valid: false, url: '', reason: 'Endpoint URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    return { valid: false, url: '', reason: 'Endpoint URL must be a valid http or https URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, url: '', reason: 'Endpoint URL must use http or https.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, url: '', reason: 'Endpoint URL cannot include embedded credentials.' };
  }

  if (isProduction && parsed.protocol !== 'https:') {
    return { valid: false, url: '', reason: 'Production webhook endpoints must use https.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const ipVersion = net.isIP(hostname);
  const privateNetwork = isLocalHostname(hostname)
    || (ipVersion === 4 && isPrivateIpv4(hostname))
    || (ipVersion === 6 && isPrivateIpv6(hostname));

  if (privateNetwork && isProduction) {
    return { valid: false, url: '', reason: 'Production webhook endpoints cannot target local or private network addresses.' };
  }

  parsed.hash = '';
  return {
    valid: true,
    url: parsed.toString(),
    reason: '',
    privateNetwork,
  };
}

function buildWebhookIdempotencyKey({ userId, integrationId, eventType, episode = null, show = null, metadata = {} }) {
  const entityId = metadata.idempotencyKey
    || episode?._id
    || show?._id
    || metadata.weekKey
    || metadata.requestedAt
    || metadata.generatedAt
    || 'global';
  const source = [
    String(userId || ''),
    String(integrationId || ''),
    String(eventType || ''),
    String(entityId || ''),
  ].join(':');

  return crypto.createHash('sha256').update(source).digest('hex');
}

function normalizeConnectionInput(body) {
  const provider = INTEGRATION_PROVIDERS.includes(body.provider) ? body.provider : 'webhook';
  const events = Array.isArray(body.events) ? body.events : [body.events].filter(Boolean);
  const endpointValidation = assessWebhookEndpointUrl(body.endpointUrl);
  const endpointUrl = endpointValidation.valid ? endpointValidation.url : '';

  if (!endpointValidation.valid && !compactText(body.endpointUrl, 500)) {
    endpointValidation.reason = '';
  }

  return {
    provider,
    label: compactText(body.label, 120) || provider,
    endpointUrl,
    endpointValidation,
    status: ['configured', 'paused', 'needs_auth'].includes(body.status) ? body.status : 'configured',
    events: events.filter((event) => INTEGRATION_EVENTS.includes(event)).slice(0, 12),
    settings: {
      audienceId: compactText(body.audienceId, 120),
      defaultChannel: compactText(body.defaultChannel, 120),
      exportFolder: compactText(body.exportFolder, 200),
    },
  };
}

function isWebhookConnectionConfigured(connection) {
  if (!['webhook', 'zapier'].includes(connection.provider)) {
    return false;
  }

  const endpointValidation = assessWebhookEndpointUrl(connection.endpointUrl);
  return connection.status === 'configured' && endpointValidation.valid;
}

function buildWebhookPayload({ eventType, episode, show, baseUrl, metadata = {} }) {
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
    metadata,
  };
}

async function queueWebhookDeliveries({ userId, eventType, episode = null, show = null, baseUrl = '', metadata = {} }) {
  const connections = await IntegrationConnection.find({
    userId,
    provider: { $in: ['webhook', 'zapier'] },
    status: 'configured',
    events: eventType,
  });
  const payload = buildWebhookPayload({ eventType, episode, show, baseUrl, metadata });

  return Promise.all(connections.map(async (connection) => {
    const endpointValidation = assessWebhookEndpointUrl(connection.endpointUrl);
    const idempotencyKey = buildWebhookIdempotencyKey({
      userId,
      integrationId: connection._id,
      eventType,
      episode,
      show,
      metadata,
    });
    const delivery = {
      userId,
      integrationId: connection._id,
      eventType,
      idempotencyKey,
      targetUrl: endpointValidation.url,
      payload,
      payloadPreview: JSON.stringify(payload).slice(0, 4000),
      status: endpointValidation.valid ? 'queued' : 'skipped',
      nextAttemptAt: new Date(),
      errorMessage: endpointValidation.valid ? '' : endpointValidation.reason,
    };

    return WebhookDelivery.findOneAndUpdate(
      {
        userId,
        integrationId: connection._id,
        idempotencyKey,
      },
      {
        $setOnInsert: delivery,
      },
      {
        returnDocument: 'after',
        upsert: true,
      }
    );
  }));
}

async function queueConnectionTestDelivery({ connection, userId, baseUrl = '' }) {
  const endpointValidation = assessWebhookEndpointUrl(connection.endpointUrl);
  const payload = buildWebhookPayload({
    eventType: 'integration.test',
    baseUrl,
    metadata: {
      provider: connection.provider,
      label: connection.label || connection.provider,
      generatedAt: new Date().toISOString(),
    },
  });

  return WebhookDelivery.create({
    userId,
    integrationId: connection._id,
    eventType: 'integration.test',
    targetUrl: endpointValidation.url,
    payload,
    payloadPreview: JSON.stringify(payload).slice(0, 4000),
    status: endpointValidation.valid ? 'queued' : 'skipped',
    nextAttemptAt: new Date(),
    errorMessage: endpointValidation.valid ? '' : endpointValidation.reason,
  });
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
    connections: connections.map((connection) => ({
      ...connection.toObject(),
      endpointSafe: assessWebhookEndpointUrl(connection.endpointUrl).valid,
      configuredForDelivery: isWebhookConnectionConfigured(connection),
    })),
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
      activeConnections: connections.filter((connection) => isWebhookConnectionConfigured(connection)).length,
      queuedJobs: jobs.filter((job) => ['queued', 'processing'].includes(job.status)).length,
      failedJobs: jobs.filter((job) => job.status === 'failed').length,
      webhookQueue: deliveries.filter((delivery) => ['queued', 'retrying', 'processing'].includes(delivery.status)).length,
      failedDeliveries: deliveries.filter((delivery) => delivery.status === 'failed').length,
    },
  };
}

module.exports = {
  INTEGRATION_EVENTS,
  assessWebhookEndpointUrl,
  buildAdvancedMediaDashboard,
  buildCaptionDraft,
  buildClipSuggestions,
  buildDescriptExportPack,
  buildRiversideExportPack,
  buildWebhookIdempotencyKey,
  buildWebhookPayload,
  isWebhookConnectionConfigured,
  normalizeConnectionInput,
  queueConnectionTestDelivery,
  queueWebhookDeliveries,
  requestMediaJob,
};
