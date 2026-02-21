const { AppError } = require('../../utils/errors');
const { buildTranscript } = require('./buildTranscript');

function assertEpisodeServed(episode) {
  if (episode.status !== 'Served') {
    throw new AppError('Serve this episode to unlock transcript export.', 403);
  }
}

async function refreshTranscript({ series, theme, episode }) {
  assertEpisodeServed(episode);

  episode.transcript = buildTranscript({ series, theme, episode });
  episode.transcriptUpdatedAt = new Date();
  await episode.save();

  return episode.transcript;
}

async function ensureTranscript({ series, theme, episode }) {
  assertEpisodeServed(episode);

  if (episode.transcript && String(episode.transcript).trim()) {
    return episode.transcript;
  }

  return refreshTranscript({ series, theme, episode });
}

module.exports = {
  assertEpisodeServed,
  refreshTranscript,
  ensureTranscript,
};
