const { getAiProvider, getMockProvider } = require('./provider');
const {
  sanitizeEpisodePayload,
  sanitizeSpicesPayload,
  sanitizeContinuityPayload,
  sanitizeToneFixPayload,
  sanitizeShowNotesPayload,
} = require('./responseSanitizer');

async function callProviderWithFallback(methodName, input) {
  const provider = getAiProvider();

  try {
    return await provider[methodName](input);
  } catch (error) {
    if (provider.name === 'mock') {
      throw error;
    }

    // Fail soft to deterministic output if external provider is unavailable.
    console.warn(`[VicPods AI] ${provider.name} ${methodName} failed, falling back to mock provider: ${error.message}`);
    return getMockProvider()[methodName](input);
  }
}

async function generateEpisodeDraft(input) {
  const raw = await callProviderWithFallback('generateEpisodeDraft', input);
  return sanitizeEpisodePayload(raw, { requireTeaser: input.requireTeaser !== false });
}

async function generateSpices(input) {
  const raw = await callProviderWithFallback('generateSpices', input);
  return sanitizeSpicesPayload(raw);
}

async function refreshContinuity(input) {
  const raw = await callProviderWithFallback('refreshContinuity', input);
  return sanitizeContinuityPayload(raw);
}

async function fixTone(input) {
  const raw = await callProviderWithFallback('fixTone', input);
  return sanitizeToneFixPayload(raw, { requireTeaser: input.requireTeaser !== false });
}

async function generateShowNotes(input) {
  const raw = await callProviderWithFallback('generateShowNotes', input);
  return sanitizeShowNotesPayload(raw);
}

module.exports = {
  generateEpisodeDraft,
  generateSpices,
  refreshContinuity,
  fixTone,
  generateShowNotes,
};
