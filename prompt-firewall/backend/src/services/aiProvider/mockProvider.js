/**
 * Mock AI Provider for offline testing and local evaluation
 * Requires no external API keys. Simulates realistic responses, latency, and test error triggers.
 */

const AIProviderInterface = require('./aiProviderInterface');

class MockProvider extends AIProviderInterface {
  constructor(model = 'mock-llm-v1') {
    super('mock', model);
  }

  async generate(message, options = {}) {
    const startTime = Date.now();

    // Support simulated provider failure for automated test suites
    if (message.includes('test:provider_error') || message.includes('simulate_error')) {
      const err = new Error('Simulated upstream AI provider service outage');
      err.code = 'PROVIDER_UNAVAILABLE';
      err.status = 502;
      throw err;
    }

    // Small simulated network latency (10-30ms) for realism
    await new Promise(resolve => setTimeout(resolve, 20));

    let replyText = '';
    const lower = message.toLowerCase().trim();

    if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi') {
      replyText = "Hello! I am a secure assistant running behind the Prompt Firewall. How can I assist you safely today?";
    } else if (lower.includes('what is prompt injection') || lower.includes('prompt injection')) {
      replyText = "Prompt injection is an attack vector against LLMs where untrusted input manipulates the model into ignoring its system instructions or executing unauthorized commands.";
    } else if (lower.includes('weather')) {
      replyText = "I don't have real-time atmospheric sensors, but the forecast looks clear and secure!";
    } else if (lower.includes('2+2') || lower.includes('calculate')) {
      replyText = "The answer is 4.";
    } else {
      replyText = `Thank you for your message: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}". The Prompt Firewall verified your input and allowed this response.`;
    }

    return {
      text: replyText,
      model: this.model,
      provider: this.name,
      latencyMs: Date.now() - startTime
    };
  }
}

module.exports = MockProvider;
