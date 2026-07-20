const CHECKLIST_ITEMS = [
  {
    key: 'mic_test',
    label: 'Microphone test',
    detail: 'Record a 20 second sample and check levels.',
  },
  {
    key: 'quiet_room',
    label: 'Room check',
    detail: 'Close noisy apps, fans, and background notifications.',
  },
  {
    key: 'script_ready',
    label: 'Script ready',
    detail: 'Open teleprompter mode and mark the key transitions.',
  },
  {
    key: 'guest_briefed',
    label: 'Guest briefed',
    detail: 'Send the prep sheet and confirm the core topic.',
  },
  {
    key: 'backup_plan',
    label: 'Backup recording',
    detail: 'Confirm backup capture or local recording is available.',
  },
  {
    key: 'post_record_upload',
    label: 'Post-record upload',
    detail: 'Upload the final MP3 after editing.',
  },
];

const RECORDING_STATUS_VALUES = ['planned', 'prepped', 'recorded', 'uploaded', 'transcript_imported'];

function cleanText(value, maxLength = 2000) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function cleanLineList(value, maxItems = 8, maxLength = 220) {
  return String(value || '')
    .split('\n')
    .map((item) => cleanText(item, maxLength).replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeChecklistKeys(value) {
  const submitted = Array.isArray(value) ? value : (value ? [value] : []);
  const allowed = new Set(CHECKLIST_ITEMS.map((item) => item.key));
  return submitted
    .map((item) => String(item || '').trim())
    .filter((item, index, list) => allowed.has(item) && list.indexOf(item) === index);
}

function normalizeRecordingStatus(value, fallback = 'planned') {
  const status = String(value || '').trim();
  return RECORDING_STATUS_VALUES.includes(status) ? status : fallback;
}

function buildDefaultInterviewQuestions(episode) {
  const questions = Array.isArray(episode?.hostQuestions) && episode.hostQuestions.length
    ? episode.hostQuestions
    : [];

  if (questions.length) {
    return questions.slice(0, 8);
  }

  const hook = cleanText(episode?.hook, 180);
  return [
    hook ? 'What made this problem urgent: ' + hook + '?' : 'What made this topic worth recording today?',
    'What is the mistake most listeners are making here?',
    'What is one practical example that proves the point?',
    'What should listeners do in the next 24 hours?',
  ];
}

function buildTeleprompterScript(episode) {
  const blocks = [];

  if (episode?.title) {
    blocks.push('Title: ' + episode.title);
  }
  if (episode?.hook) {
    blocks.push('Opening hook: ' + episode.hook);
  }
  if (Array.isArray(episode?.outline) && episode.outline.length) {
    blocks.push('Outline:\n' + episode.outline.map((item, index) => (index + 1) + '. ' + item).join('\n'));
  }
  if (Array.isArray(episode?.talkingPoints) && episode.talkingPoints.length) {
    blocks.push('Talking points:\n' + episode.talkingPoints.map((item) => '- ' + item).join('\n'));
  }
  if (Array.isArray(episode?.hostQuestions) && episode.hostQuestions.length) {
    blocks.push('Questions:\n' + episode.hostQuestions.map((item) => '- ' + item).join('\n'));
  }
  if (episode?.funSegment) {
    blocks.push('Optional segment: ' + episode.funSegment);
  }
  if (episode?.ending) {
    blocks.push('Close: ' + episode.ending);
  }

  return blocks.join('\n\n').trim();
}

function buildGuestPrepSheet({ episode, series, theme } = {}) {
  const workflow = episode?.recordingWorkflow || {};
  const questions = workflow.interviewQuestions?.length
    ? workflow.interviewQuestions
    : buildDefaultInterviewQuestions(episode);
  const prepLines = [
    'Show: ' + (series?.name || 'VicPods show'),
    'Episode: ' + (episode?.title || 'Untitled episode'),
    theme?.name ? 'Theme: ' + theme.name : '',
    episode?.hook ? 'Core promise: ' + episode.hook : '',
    workflow.guestName ? 'Guest: ' + workflow.guestName : '',
    workflow.guestBio ? 'Guest context: ' + workflow.guestBio : '',
    '',
    'What we will cover:',
    ...(Array.isArray(episode?.outline) && episode.outline.length ? episode.outline.map((item) => '- ' + item) : ['- The core topic and the listener takeaway.']),
    '',
    'Likely questions:',
    ...questions.map((question) => '- ' + question),
    '',
    'Prep note:',
    workflow.prepNotes || 'Bring one concrete story, one mistake to avoid, and one practical takeaway.',
  ];

  return prepLines.filter((line) => line !== '').join('\n');
}

function buildRecordingWorkflowView({ episode, series, theme } = {}) {
  const workflow = episode?.recordingWorkflow || {};
  const completedKeys = new Set(workflow.checklistCompleted || []);
  const checklist = CHECKLIST_ITEMS.map((item) => ({
    ...item,
    completed: completedKeys.has(item.key),
  }));
  const completedCount = checklist.filter((item) => item.completed).length;

  return {
    status: normalizeRecordingStatus(workflow.status),
    scheduledFor: workflow.scheduledFor || null,
    location: workflow.location || '',
    guestName: workflow.guestName || '',
    guestEmail: workflow.guestEmail || '',
    guestBio: workflow.guestBio || '',
    prepNotes: workflow.prepNotes || '',
    interviewQuestions: workflow.interviewQuestions?.length
      ? workflow.interviewQuestions
      : buildDefaultInterviewQuestions(episode),
    checklist,
    completedCount,
    checklistTotal: checklist.length,
    checklistPercent: Math.round((completedCount / checklist.length) * 100),
    sessionNotes: workflow.sessionNotes || '',
    postRecordStatus: normalizeRecordingStatus(workflow.postRecordStatus, workflow.status),
    transcriptImportedAt: workflow.transcriptImportedAt || null,
    teleprompterScript: buildTeleprompterScript(episode),
    guestPrepSheet: buildGuestPrepSheet({ episode, series, theme }),
  };
}

function normalizeRecordingWorkflowInput(body = {}, episode = {}) {
  const current = episode.recordingWorkflow || {};
  const importedTranscript = cleanText(body.importedTranscript, 60000);
  const status = normalizeRecordingStatus(body.recordingStatus, current.status);
  const postRecordStatus = normalizeRecordingStatus(body.postRecordStatus, status);

  return {
    workflow: {
      status,
      scheduledFor: body.recordingScheduledFor ? new Date(body.recordingScheduledFor) : null,
      location: cleanText(body.recordingLocation, 180),
      guestName: cleanText(body.guestName, 160),
      guestEmail: cleanText(body.guestEmail, 220).toLowerCase(),
      guestBio: cleanText(body.guestBio, 1200),
      prepNotes: cleanText(body.prepNotes, 2000),
      interviewQuestions: cleanLineList(body.interviewQuestions, 10, 260),
      checklistCompleted: normalizeChecklistKeys(body.checklistCompleted),
      sessionNotes: cleanText(body.sessionNotes, 5000),
      postRecordStatus,
      transcriptImportedAt: importedTranscript ? new Date() : current.transcriptImportedAt || null,
    },
    importedTranscript,
  };
}

module.exports = {
  CHECKLIST_ITEMS,
  RECORDING_STATUS_VALUES,
  buildDefaultInterviewQuestions,
  buildGuestPrepSheet,
  buildRecordingWorkflowView,
  buildTeleprompterScript,
  normalizeRecordingWorkflowInput,
  normalizeRecordingStatus,
};
