const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const {
  buildGuestPrepSheet,
  buildRecordingWorkflowView,
  buildTeleprompterScript,
  normalizeRecordingWorkflowInput,
} = require('../services/recording/recordingWorkflowService');
const { buildEpisodeDetailTabs } = require('../services/studio/studioCommandCenterService');

function makeEpisode(overrides = {}) {
  return {
    _id: overrides._id || new mongoose.Types.ObjectId(),
    title: overrides.title || 'Recording Better Interviews',
    hook: overrides.hook || 'Help creators run sharper guest conversations.',
    outline: overrides.outline || ['Set the promise', 'Ask better follow-ups', 'Close with action'],
    talkingPoints: overrides.talkingPoints || ['Guest prep', 'Session notes'],
    hostQuestions: overrides.hostQuestions || ['What should the listener understand first?'],
    ending: overrides.ending || 'Close with one concrete recording habit.',
    recordingWorkflow: overrides.recordingWorkflow || {},
  };
}

test('Phase 4 builds a teleprompter script from episode structure', () => {
  const script = buildTeleprompterScript(makeEpisode());

  assert.ok(script.includes('Opening hook'));
  assert.ok(script.includes('Outline:'));
  assert.ok(script.includes('Questions:'));
  assert.ok(script.includes('Close:'));
});

test('Phase 4 builds guest prep from episode, guest, and questions', () => {
  const prep = buildGuestPrepSheet({
    series: { name: 'VicPods Weekly' },
    theme: { name: 'Recording Day' },
    episode: makeEpisode({
      recordingWorkflow: {
        guestName: 'Alex Creator',
        guestBio: 'Podcast producer',
        interviewQuestions: ['How do you prepare a guest?'],
        prepNotes: 'Bring one recording mistake.',
      },
    }),
  });

  assert.ok(prep.includes('VicPods Weekly'));
  assert.ok(prep.includes('Alex Creator'));
  assert.ok(prep.includes('How do you prepare a guest?'));
  assert.ok(prep.includes('Bring one recording mistake.'));
});

test('Phase 4 normalizes recording workflow input and transcript import', () => {
  const normalized = normalizeRecordingWorkflowInput({
    recordingStatus: 'recorded',
    postRecordStatus: 'uploaded',
    recordingLocation: ' Riverside room ',
    guestEmail: 'GUEST@EXAMPLE.COM ',
    interviewQuestions: 'Question one\nQuestion two',
    checklistCompleted: ['mic_test', 'script_ready', 'not_allowed'],
    sessionNotes: ' Strong quote at 04:20 ',
    importedTranscript: ' Speaker 1: Welcome. ',
  });

  assert.equal(normalized.workflow.status, 'recorded');
  assert.equal(normalized.workflow.postRecordStatus, 'uploaded');
  assert.equal(normalized.workflow.location, 'Riverside room');
  assert.equal(normalized.workflow.guestEmail, 'guest@example.com');
  assert.deepEqual(normalized.workflow.interviewQuestions, ['Question one', 'Question two']);
  assert.deepEqual(normalized.workflow.checklistCompleted, ['mic_test', 'script_ready']);
  assert.equal(normalized.importedTranscript, 'Speaker 1: Welcome.');
  assert.ok(normalized.workflow.transcriptImportedAt instanceof Date);
});

test('Phase 4 recording workflow view tracks checklist readiness', () => {
  const view = buildRecordingWorkflowView({
    episode: makeEpisode({
      recordingWorkflow: {
        checklistCompleted: ['mic_test', 'quiet_room', 'script_ready'],
      },
    }),
  });

  assert.equal(view.completedCount, 3);
  assert.equal(view.checklistTotal, 6);
  assert.equal(view.checklistPercent, 50);
});

test('Phase 4 record tab is complete when recording workflow is prepped', () => {
  const tabs = buildEpisodeDetailTabs({
    episode: makeEpisode({
      recordingWorkflow: {
        status: 'prepped',
      },
    }),
  });
  const recordTab = tabs.find((tab) => tab.key === 'record');

  assert.equal(recordTab.complete, true);
  assert.equal(recordTab.status, 'Workflow ready');
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
