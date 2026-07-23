const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { ShowCollaborator } = require('../models/ShowCollaborator');
const { IntegrationConnection } = require('../models/IntegrationConnection');
const WebhookDelivery = require('../models/WebhookDelivery');
const {
  buildWebhookPayload,
} = require('../services/integrations/advancedMediaIntegrationService');
const {
  computeRetryDelayMs,
} = require('../services/integrations/webhookDeliveryWorkerService');
const {
  buildCollaboratorInviteUrl,
  normalizeInviteToken,
} = require('../services/team/collaboratorInviteService');

test('Phase 3 collaborator invite helpers normalize tokens and build accept URLs', () => {
  const token = normalizeInviteToken('  ABCD-1234-ffff ');
  const inviteUrl = buildCollaboratorInviteUrl(token, {
    appUrl: 'https://app.vicpods.com',
  });

  assert.equal(token, 'abcd1234ffff');
  assert.equal(inviteUrl, 'https://app.vicpods.com/auth/collaborator-invite/abcd1234ffff');
});

test('Phase 3 webhook payloads include metadata for downstream automation', () => {
  const show = {
    _id: new mongoose.Types.ObjectId(),
    name: 'VicPods Weekly',
    slug: 'vicpods-weekly',
  };
  const episode = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Approval Flow',
    publicSlug: 'approval-flow',
    publishStatus: 'published',
    approvalWorkflow: { status: 'in_review' },
  };

  const payload = buildWebhookPayload({
    eventType: 'team.approval_requested',
    show,
    episode,
    baseUrl: 'https://app.vicpods.com',
    metadata: {
      requestedAt: '2026-07-22T12:00:00.000Z',
    },
  });

  assert.equal(payload.metadata.requestedAt, '2026-07-22T12:00:00.000Z');
  assert.equal(payload.episode.approvalStatus, 'in_review');
  assert.ok(payload.episode.url.includes('/podcasts/vicpods-weekly/approval-flow'));
});

test('Phase 3 webhook retry delays back off as attempts increase', () => {
  assert.equal(computeRetryDelayMs(1), 60 * 1000);
  assert.equal(computeRetryDelayMs(2), 2 * 60 * 1000);
  assert.ok(computeRetryDelayMs(6) <= 60 * 60 * 1000);
});

test('Phase 3 schemas expose collaborator auth binding and webhook retry fields', () => {
  assert.ok(ShowCollaborator.schema.paths.acceptedUserId);
  assert.ok(ShowCollaborator.schema.paths.inviteToken);
  assert.ok(ShowCollaborator.schema.paths.lastInviteSentAt);
  assert.ok(IntegrationConnection.schema.paths.signingSecret);
  assert.ok(WebhookDelivery.schema.paths.payload);
  assert.ok(WebhookDelivery.schema.paths.attemptCount);
  assert.ok(WebhookDelivery.schema.paths.nextAttemptAt);
  assert.ok(WebhookDelivery.schema.paths.attemptLog);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
