const { getAiProvider } = require('./provider');
const {
  sanitizeEpisodePayload,
  sanitizeSpicesPayload,
  sanitizeContinuityPayload,
} = require('./responseSanitizer');

async function generateEpisodeDraft(input) {
  const provider = getAiProvider();
  const raw = await provider.generateEpisodeDraft(input);
  return sanitizeEpisodePayload(raw);
}

async function generateSpices(input) {
  const provider = getAiProvider();
  const raw = await provider.generateSpices(input);
  return sanitizeSpicesPayload(raw);
}

async function refreshContinuity(input) {
  const provider = getAiProvider();
  const raw = await provider.refreshContinuity(input);
  return sanitizeContinuityPayload(raw);
}

module.exports = {
  generateEpisodeDraft,
  generateSpices,
  refreshContinuity,
};
