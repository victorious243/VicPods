const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { ShowCollaborator } = require('../models/ShowCollaborator');
const { IntegrationConnection } = require('../models/IntegrationConnection');
const WebhookDelivery = require('../models/WebhookDelivery');
const {
  assessWebhookEndpointUrl,
  buildWebhookIdempotencyKey,
  buildWebhookPayload,
} = require('../services/integrations/advancedMediaIntegrationService');
const {
  computeRetryDelayMs,
} = require('../services/integrations/webhookDeliveryWorkerService');
const {
  buildCollaboratorInviteUrl,
  getCollaboratorSeatLimitForUser,
  hashInviteToken,
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

test('Phase 3 collaborator invite tokens are hashable and seat limits follow billing plans', () => {
  const token = normalizeInviteToken('A'.repeat(64));
  const hashedToken = hashInviteToken(token);
  const growthLimit = getCollaboratorSeatLimitForUser({
    workspacePlan: 'growth',
    hostingPlan: 'none',
    workspacePlanStatus: 'active',
    workspaceCurrentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  });
  const starterLimit = getCollaboratorSeatLimitForUser({
    workspacePlan: 'creator',
    hostingPlan: 'starter',
    hostingPlanStatus: 'active',
    hostingCurrentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  });

  assert.equal(hashedToken.length, 64);
  assert.notEqual(hashedToken, token);
  assert.equal(growthLimit, 3);
  assert.equal(starterLimit, 0);
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

test('Phase 3 webhook endpoints are validated before delivery', () => {
  const zapierEndpoint = assessWebhookEndpointUrl('https://hooks.zapier.com/hooks/catch/123/abc', {
    isProduction: true,
  });
  const localEndpoint = assessWebhookEndpointUrl('https://127.0.0.1:3000/hook', {
    isProduction: true,
  });
  const embeddedCredentialEndpoint = assessWebhookEndpointUrl('https://user:pass@example.com/hook', {
    isProduction: true,
  });

  assert.equal(zapierEndpoint.valid, true);
  assert.equal(localEndpoint.valid, false);
  assert.match(localEndpoint.reason, /private network/i);
  assert.equal(embeddedCredentialEndpoint.valid, false);
});

test('Phase 3 webhook idempotency keys deduplicate repeated event queueing', () => {
  const userId = new mongoose.Types.ObjectId();
  const integrationId = new mongoose.Types.ObjectId();
  const episode = { _id: new mongoose.Types.ObjectId() };
  const firstKey = buildWebhookIdempotencyKey({
    userId,
    integrationId,
    eventType: 'episode.published',
    episode,
  });
  const secondKey = buildWebhookIdempotencyKey({
    userId,
    integrationId,
    eventType: 'episode.published',
    episode,
  });
  const differentKey = buildWebhookIdempotencyKey({
    userId,
    integrationId,
    eventType: 'episode.scheduled',
    episode,
  });

  assert.equal(firstKey, secondKey);
  assert.notEqual(firstKey, differentKey);
});

test('Phase 3 webhook retry delays back off as attempts increase', () => {
  assert.equal(computeRetryDelayMs(1), 60 * 1000);
  assert.equal(computeRetryDelayMs(2), 2 * 60 * 1000);
  assert.ok(computeRetryDelayMs(6) <= 60 * 60 * 1000);
});

test('Phase 3 schemas expose collaborator auth binding and webhook retry fields', () => {
  assert.ok(ShowCollaborator.schema.paths.acceptedUserId);
  assert.ok(ShowCollaborator.schema.paths.inviteToken);
  assert.ok(ShowCollaborator.schema.paths.inviteTokenHash);
  assert.ok(ShowCollaborator.schema.paths.lastInviteSentAt);
  assert.ok(IntegrationConnection.schema.paths.signingSecret);
  assert.ok(WebhookDelivery.schema.paths.payload);
  assert.ok(WebhookDelivery.schema.paths.idempotencyKey);
  assert.ok(WebhookDelivery.schema.paths.attemptCount);
  assert.ok(WebhookDelivery.schema.paths.nextAttemptAt);
  assert.ok(WebhookDelivery.schema.paths.attemptLog);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
