const { AppError } = require('../../utils/errors');
const { buildTranscript } = require('./buildTranscript');

function assertEpisodeBriefEligible(episode) {
  if (!['Ready', 'Served'].includes(String(episode.status || ''))) {
    throw new AppError('Set this episode to Ready or Served to unlock episode brief export.', 403);
  }
}

async function refreshTranscript({ series, theme, episode }) {
  assertEpisodeBriefEligible(episode);

  episode.transcript = buildTranscript({ series, theme, episode });
  episode.transcriptUpdatedAt = new Date();
  await episode.save();

  return episode.transcript;
}

async function ensureTranscript({ series, theme, episode }) {
  assertEpisodeBriefEligible(episode);

  if (episode.transcript && String(episode.transcript).trim()) {
    return episode.transcript;
  }

  return refreshTranscript({ series, theme, episode });
}

module.exports = {
  assertEpisodeBriefEligible,
  refreshTranscript,
  ensureTranscript,
};
