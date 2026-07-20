const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const {
  buildEpisodeWorkflowPanel,
  normalizeApprovalInput,
  normalizeBrandKitInput,
  normalizeCollaboratorInput,
  normalizeWorkItemInput,
} = require('../services/team/teamWorkflowService');

test('Phase 6 collaborator roles resolve practical permissions', () => {
  const producer = normalizeCollaboratorInput({
    name: 'Alex Producer',
    email: 'ALEX@EXAMPLE.COM ',
    role: 'producer',
    status: 'active',
  });
  const analyst = normalizeCollaboratorInput({
    email: 'data@example.com',
    role: 'analyst',
  });

  assert.equal(producer.email, 'alex@example.com');
  assert.equal(producer.permissions.canApproveEpisodes, true);
  assert.equal(producer.permissions.canManagePublishing, true);
  assert.equal(analyst.permissions.canViewAnalytics, true);
  assert.equal(analyst.permissions.canEditEpisodes, false);
});

test('Phase 6 normalizes show brand kit fields', () => {
  const brandKit = normalizeBrandKitInput({
    positioning: '  AI operating system for podcasters  ',
    voiceRules: 'Clear\nWarm\n\nDirect',
    approvedPhrases: 'record with confidence\npublish smarter',
    bannedPhrases: 'viral hacks\npassive income',
    visualNotes: 'Use clean covers.',
    sponsorSafetyNotes: 'No gambling sponsors.',
  });

  assert.equal(brandKit.positioning, 'AI operating system for podcasters');
  assert.deepEqual(brandKit.voiceRules, ['Clear', 'Warm', 'Direct']);
  assert.deepEqual(brandKit.approvedPhrases, ['record with confidence', 'publish smarter']);
  assert.deepEqual(brandKit.bannedPhrases, ['viral hacks', 'passive income']);
});

test('Phase 6 normalizes comments, tasks, and approvals', () => {
  const task = normalizeWorkItemInput({
    type: 'task',
    body: ' Tighten the sponsor read. ',
    assigneeName: 'Editor',
    dueAt: '2026-07-25',
  });
  const approval = normalizeApprovalInput({
    approvalStatus: 'changes_requested',
    approvalNotes: 'Intro needs a stronger promise.',
  });

  assert.equal(task.type, 'task');
  assert.equal(task.body, 'Tighten the sponsor read.');
  assert.equal(task.assigneeName, 'Editor');
  assert.ok(task.dueAt instanceof Date);
  assert.equal(approval.status, 'changes_requested');
  assert.equal(approval.notes, 'Intro needs a stronger promise.');
});

test('Phase 6 episode workflow panel groups tasks and comments', () => {
  const episode = {
    approvalWorkflow: {
      status: 'in_review',
      notes: 'Ready for producer review.',
    },
  };
  const panel = buildEpisodeWorkflowPanel({
    episode,
    workItems: [
      { type: 'task', status: 'open', body: 'Fix intro.' },
      { type: 'task', status: 'resolved', body: 'Upload audio.' },
      { type: 'comment', status: 'open', body: 'Great middle section.' },
    ],
  });

  assert.equal(panel.approval.status, 'in_review');
  assert.equal(panel.openTasks.length, 1);
  assert.equal(panel.comments.length, 1);
  assert.equal(panel.recentItems.length, 3);
});

test('Phase 6 schemas expose approval and brand kit fields', () => {
  const episodePaths = Episode.schema.paths;
  const showPaths = PodcastShow.schema.paths;

  assert.ok(episodePaths['approvalWorkflow.status']);
  assert.ok(episodePaths['approvalWorkflow.notes']);
  assert.ok(showPaths['brandKit.positioning']);
  assert.ok(showPaths['brandKit.voiceRules']);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
