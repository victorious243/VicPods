const {
  buildEpisodeGenerationPrompt,
  buildSpicesPrompt,
  buildContinuityRefreshPrompt,
} = require('./prompts');

class OpenAIProvider {
  constructor({ apiKey }) {
    this.apiKey = apiKey;
    this.name = 'openai';
  }

  async requestJson(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: 'You are Chef AI for VicPods. Return compact valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content || '{}');
  }

  async generateEpisodeDraft(input) {
    const prompt = buildEpisodeGenerationPrompt(input);
    return this.requestJson(prompt);
  }

  async generateSpices(input) {
    const prompt = buildSpicesPrompt(input);
    return this.requestJson(prompt);
  }

  async refreshContinuity(input) {
    const prompt = buildContinuityRefreshPrompt(input);
    return this.requestJson(prompt);
  }
}

module.exports = {
  OpenAIProvider,
};
