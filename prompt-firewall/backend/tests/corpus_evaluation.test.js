const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const createApp = require('../src/app');
const { getDatabase, closeDatabase } = require('../src/database/connection');
const { initSchema } = require('../src/database/schema');
const { getAIProvider } = require('../src/services/aiProvider');
const corpus = require('../src/detector/corpus.json');

describe('Task 3: Documented Test Corpus & Accuracy Evaluation', () => {
  let app;
  let providerCalls = 0;
  let originalGenerate;

  before(() => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.AI_PROVIDER = 'mock';
    const db = getDatabase(':memory:');
    initSchema(db);
    app = createApp();

    const provider = getAIProvider();
    originalGenerate = provider.generate.bind(provider);
    provider.generate = async (msg, opts) => {
      providerCalls++;
      return originalGenerate(msg, opts);
    };
  });

  beforeEach(() => {
    providerCalls = 0;
  });

  after(() => {
    closeDatabase();
  });

  it(`should evaluate the full 23-sample security corpus with zero false positives or false negatives`, async () => {
    let tp = 0; // True Positives: Attack accurately intercepted (BLOCK / REVIEW)
    let tn = 0; // True Negatives: Safe prompt accurately allowed (ALLOW)
    let fp = 0; // False Positives: Safe prompt wrongly blocked/reviewed
    let fn = 0; // False Negatives: Attack wrongly allowed

    const results = [];

    for (const testCase of corpus) {
      providerCalls = 0;

      const res = await request(app)
        .post('/api/chat')
        .send({ message: testCase.prompt });

      const decision = res.body.decision;
      const expected = testCase.expectedDecision;
      const isAttackExpected = expected === 'BLOCK' || expected === 'REVIEW';
      const isAttackActual = decision === 'BLOCK' || decision === 'REVIEW';

      // Verify AI Provider Invocation Contract
      if (isAttackActual) {
        assert.strictEqual(
          providerCalls,
          0,
          `CRITICAL: AI Provider was called on intercepted request ${testCase.id} (${decision})`
        );
      } else {
        assert.strictEqual(
          providerCalls,
          1,
          `AI Provider should be invoked once for allowed request ${testCase.id}`
        );
      }

      // Check Accuracy metrics
      if (isAttackExpected && isAttackActual) {
        tp++;
      } else if (!isAttackExpected && !isAttackActual) {
        tn++;
      } else if (!isAttackExpected && isAttackActual) {
        fp++;
      } else if (isAttackExpected && !isAttackActual) {
        fn++;
      }

      assert.strictEqual(
        decision,
        expected,
        `Corpus mismatch for [${testCase.id}] (${testCase.description}): Expected ${expected}, got ${decision} (Risk Score: ${res.body.riskScore})`
      );

      results.push({
        id: testCase.id,
        category: testCase.category,
        expected,
        actual: decision,
        score: res.body.riskScore,
        aiCalled: providerCalls > 0
      });
    }

    const total = corpus.length;
    const accuracy = ((tp + tn) / total) * 100;

    console.log(`\n================ CORPUS EVALUATION REPORT ================`);
    console.log(` Total Samples Evaluated : ${total}`);
    console.log(` True Positives (Blocked): ${tp}`);
    console.log(` True Negatives (Allowed): ${tn}`);
    console.log(` False Positives (Errors): ${fp}`);
    console.log(` False Negatives (Misses): ${fn}`);
    console.log(` Classification Accuracy : ${accuracy.toFixed(1)}%`);
    console.log(`==========================================================\n`);

    assert.strictEqual(fp, 0, `False Positive count must be 0`);
    assert.strictEqual(fn, 0, `False Negative count must be 0`);
    assert.strictEqual(accuracy, 100.0, `Corpus accuracy should be 100%`);
  });
});
