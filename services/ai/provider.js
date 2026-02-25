const { OpenAIProvider } = require('./openaiProvider');
const { MockProvider } = require('./mockProvider');

let providerInstance;
let mockProviderInstance;

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

function getMockProvider() {
  if (!mockProviderInstance) {
    mockProviderInstance = new MockProvider();
  }
  return mockProviderInstance;
}

module.exports = {
  getAiProvider,
  getMockProvider,
};
