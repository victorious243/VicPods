const { OpenAIProvider } = require('./openaiProvider');
const { MockProvider } = require('./mockProvider');

let providerInstance;

function getAiProvider() {
  if (providerInstance) {
    return providerInstance;
  }

  const selectedProvider = (process.env.AI_PROVIDER || 'mock').toLowerCase();

  if (selectedProvider === 'openai' && process.env.OPENAI_API_KEY) {
    providerInstance = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return providerInstance;
  }

  providerInstance = new MockProvider();
  return providerInstance;
}

module.exports = {
  getAiProvider,
};
