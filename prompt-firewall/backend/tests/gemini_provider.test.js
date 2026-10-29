const { describe, it } = require('node:test');
const assert = require('node:assert');
const GeminiProvider = require('../src/services/aiProvider/geminiProvider');
const { getAIProvider } = require('../src/services/aiProvider');

describe('Task 1: Gemini AI Provider Unit & Integration Tests', () => {
  it('should reject construction if API key is missing or empty', () => {
    assert.throws(() => new GeminiProvider(''), /GEMINI_API_KEY is required/);
    assert.throws(() => new GeminiProvider(null), /GEMINI_API_KEY is required/);
    assert.throws(() => new GeminiProvider('   '), /GEMINI_API_KEY is required/);
  });

  it('should construct with valid key and default model', () => {
    const provider = new GeminiProvider('test-dummy-api-key');
    assert.strictEqual(provider.name, 'gemini');
    assert.strictEqual(provider.model, 'gemini-2.5-flash');
  });

  it('should successfully extract generated text from response object', async () => {
    const provider = new GeminiProvider('test-dummy-api-key');
    // Stub the underlying SDK call
    provider.client.models.generateContent = async ({ contents }) => {
      return {
        text: `Echo: ${contents}`
      };
    };

    const result = await provider.generate('Explain firewalls');
    assert.strictEqual(result.text, 'Echo: Explain firewalls');
    assert.strictEqual(result.provider, 'gemini');
    assert.ok(typeof result.latencyMs === 'number');
  });

  it('should extract text from candidates structure if text getter is absent', async () => {
    const provider = new GeminiProvider('test-dummy-api-key');
    provider.client.models.generateContent = async () => {
      return {
        candidates: [
          {
            content: {
              parts: [{ text: 'Deep candidate text answer' }]
            }
          }
        ]
      };
    };

    const result = await provider.generate('Hello');
    assert.strictEqual(result.text, 'Deep candidate text answer');
  });

  it('should map 429 quota exhaustion to HTTP 429 with safe message', async () => {
    const provider = new GeminiProvider('test-dummy-api-key');
    provider.client.models.generateContent = async () => {
      const err = new Error('429 Resource has been exhausted (e.g. check quota).');
      throw err;
    };

    await assert.rejects(
      async () => await provider.generate('Test quota'),
      (err) => {
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.code, 'AI_RATE_LIMIT_EXCEEDED');
        assert.ok(err.message.includes('rate limit or quota exceeded'));
        return true;
      }
    );
  });

  it('should map authentication errors safely without leaking credentials', async () => {
    const secretKey = 'SECRET_KEY_NOT_TO_LEAK';
    const provider = new GeminiProvider(secretKey);
    provider.client.models.generateContent = async () => {
      const err = new Error(`API_KEY_INVALID: Key ${secretKey} was rejected with 401`);
      throw err;
    };

    await assert.rejects(
      async () => await provider.generate('Test auth failure'),
      (err) => {
        assert.strictEqual(err.status, 502);
        assert.strictEqual(err.code, 'AI_AUTH_ERROR');
        // Ensure secret key is NOT in client error message
        assert.strictEqual(err.message.includes(secretKey), false);
        return true;
      }
    );
  });

  it('should map timeouts to 504 Gateway Timeout', async () => {
    const provider = new GeminiProvider('test-dummy-api-key');
    provider.timeoutMs = 15; // Fast timeout for test
    provider.client.models.generateContent = () => new Promise(resolve => setTimeout(resolve, 100));

    await assert.rejects(
      async () => await provider.generate('Slow request'),
      (err) => {
        assert.strictEqual(err.status, 504);
        assert.strictEqual(err.code, 'GATEWAY_TIMEOUT');
        return true;
      }
    );
  });

  it('should select mock-fallback in development if AI_PROVIDER=gemini but GEMINI_API_KEY is missing', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevProvider = process.env.AI_PROVIDER;
    const prevKey = process.env.GEMINI_API_KEY;

    try {
      process.env.NODE_ENV = 'development';
      process.env.AI_PROVIDER = 'gemini';
      delete process.env.GEMINI_API_KEY;

      const provider = getAIProvider(true);
      assert.strictEqual(provider.name, 'mock');
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.AI_PROVIDER = prevProvider;
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
