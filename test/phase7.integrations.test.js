const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Episode = require('../models/Episode');
const { IntegrationConnection } = require('../models/IntegrationConnection');
const { MediaProcessingJob } = require('../models/MediaProcessingJob');
const WebhookDelivery = require('../models/WebhookDelivery');
const {
  buildCaptionDraft,
  buildClipSuggestions,
  buildDescriptExportPack,
  buildRiversideExportPack,
  buildWebhookPayload,
  normalizeConnectionInput,
} = require('../services/integrations/advancedMediaIntegrationService');

function makeEpisode(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    title: 'Podcast Growth Systems',
    publicSlug: 'podcast-growth-systems',
    publishStatus: 'published',
    hook: 'Most podcasts do not need more ideas. They need a sharper operating system.',
    summary: 'A practical episode about improving podcast workflow.',
    transcript: 'Most podcasts do not need more ideas. They need a sharper operating system. Clip this moment for creators who want a better recording and publishing workflow.',
    approvalWorkflow: { status: 'approved' },
    launchPack: { showNotes: 'Show notes for external editor handoff.' },
    recordingWorkflow: {
      guestName: 'Alex Creator',
      sessionNotes: 'Strong guest quote at 12:30.',
      interviewQuestions: ['What breaks most podcast workflows?'],
    },
    advancedMedia: {
      clipSuggestions: [
        { title: 'Growth hook', startSeconds: 0, endSeconds: 45 },
      ],
    },
    ...overrides,
  };
}

function makeShow() {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: 'VicPods Growth',
    slug: 'vicpods-growth',
  };
}

test('Phase 7 normalizes integration connection input', () => {
  const input = normalizeConnectionInput({
    provider: 'zapier',
    label: ' Episode published hook ',
    endpointUrl: 'https://hooks.zapier.com/example',
    events: ['episode.published', 'bad.event', 'media.clip_ready'],
    audienceId: 'aud_123',
  });

  assert.equal(input.provider, 'zapier');
  assert.equal(input.label, 'Episode published hook');
  assert.equal(input.endpointUrl, 'https://hooks.zapier.com/example');
  assert.deepEqual(input.events, ['episode.published', 'media.clip_ready']);
  assert.equal(input.settings.audienceId, 'aud_123');
});

test('Phase 7 builds webhook payloads with episode and show context', () => {
  const episode = makeEpisode();
  const show = makeShow();
  const payload = buildWebhookPayload({
    eventType: 'episode.published',
    episode,
    show,
    baseUrl: 'https://app.vicpods.com',
  });

  assert.equal(payload.eventType, 'episode.published');
  assert.equal(payload.episode.title, 'Podcast Growth Systems');
  assert.equal(payload.episode.approvalStatus, 'approved');
  assert.equal(payload.show.slug, 'vicpods-growth');
  assert.ok(payload.episode.url.includes('/podcasts/vicpods-growth/podcast-growth-systems'));
});

test('Phase 7 generates clip suggestions and captions from episode text', () => {
  const episode = makeEpisode();
  const clips = buildClipSuggestions(episode);
  const captions = buildCaptionDraft(episode);

  assert.ok(clips.length >= 1);
  assert.equal(clips[0].startSeconds, 0);
  assert.ok(clips[0].hook.includes('Most podcasts'));
  assert.ok(captions.includes('00:00:00,000 --> 00:00:05,000'));
});

test('Phase 7 builds Descript and Riverside export packs', () => {
  const episode = makeEpisode();
  const show = makeShow();
  const descriptPack = buildDescriptExportPack({ episode, show });
  const riversidePack = buildRiversideExportPack({ episode, show });

  assert.equal(descriptPack.provider, 'descript');
  assert.equal(descriptPack.markers.length, 1);
  assert.equal(riversidePack.provider, 'riverside');
  assert.equal(riversidePack.guestName, 'Alex Creator');
  assert.deepEqual(riversidePack.questions, ['What breaks most podcast workflows?']);
});

test('Phase 7 schemas expose integration and media fields', () => {
  assert.ok(Episode.schema.paths['advancedMedia.externalProject.provider']);
  assert.ok(Episode.schema.paths['advancedMedia.clipSuggestions']);
  assert.ok(IntegrationConnection.schema.paths.provider);
  assert.ok(MediaProcessingJob.schema.paths.jobType);
  assert.ok(WebhookDelivery.schema.paths.eventType);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
