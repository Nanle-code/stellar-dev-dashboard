import { describe, it, expect, beforeEach } from 'vitest';
import { classifyIntent, extractEntities, parseNaturalLanguageQuery, fuzzyMatch } from '../../src/lib/nlpSearchEngine';
import { SemanticSearchEngine } from '../../src/lib/semanticSearch';
import { retryWithBackoff, classifyError, ErrorCategory } from '../../src/lib/errorHandling';
import { getRecoverySuggestions } from '../../src/lib/errorRecovery';
import { saveErrorContext, restoreErrorContext } from '../../src/lib/errorContextPreservation';
import { captureMemorySnapshot, detectMemoryLeak } from '../../src/lib/memoryProfiling';
import { analyzeBundleSize, getOptimizationSuggestions } from '../../src/lib/bundleAnalysis';

describe('Issue #420: NLP Search', () => {
  it('should classify search intent correctly', () => {
    const intent1 = classifyIntent('payment to GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR');
    expect(intent1.type).toBe('transaction');
    expect(intent1.confidence).toBeGreaterThan(0.8);

    const intent2 = classifyIntent('account GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR');
    expect(intent2.type).toBe('account');

    const intent3 = classifyIntent('create account operation');
    expect(intent3.type).toBe('operation');
  });

  it('should extract entities from natural language', () => {
    const entities = extractEntities('send 100 XLM to GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQR');
    expect(entities.amounts).toContain(100);
    expect(entities.assets).toContain('XLM');
    expect(entities.addresses?.length).toBeGreaterThan(0);
  });

  it('should parse natural language queries', () => {
    const parsed = parseNaturalLanguageQuery('payments over 50 XLM today');
    expect(parsed.intent.type).toBeDefined();
    expect(parsed.searchTerms.length).toBeGreaterThan(0);
  });

  it('should perform fuzzy matching', () => {
    expect(fuzzyMatch('payment', 'payments')).toBe(true);
    expect(fuzzyMatch('transaction', 'transact')).toBe(true);
    expect(fuzzyMatch('account', 'xyz')).toBe(false);
  });
});

describe('Issue #420: Semantic Search', () => {
  let engine: SemanticSearchEngine;

  beforeEach(() => {
    engine = new SemanticSearchEngine();
  });

  it('should index documents', async () => {
    await engine.indexDocument({
      id: '1',
      text: 'payment transaction on stellar network',
    });
    expect(engine.getIndexSize()).toBe(1);
  });

  it('should search indexed documents', async () => {
    await engine.indexDocuments([
      { id: '1', text: 'payment transaction' },
      { id: '2', text: 'account balance' },
      { id: '3', text: 'stellar payment' },
    ]);

    const results = await engine.search('payment', 2);
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0].score).toBeGreaterThanOrEqual(0);
  });
});

describe('Issue #424: Error Handling', () => {
  it('should classify errors correctly', () => {
    const networkError = new Error('fetch failed');
    const context = classifyError(networkError);
    expect(context.category).toBe(ErrorCategory.Network);
    expect(context.retryable).toBe(true);

    const validationError = new TypeError('invalid type');
    const context2 = classifyError(validationError);
    expect(context2.category).toBe(ErrorCategory.Validation);
    expect(context2.retryable).toBe(false);
  });

  it('should retry with exponential backoff', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('temporary failure');
      return 'success';
    };

    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should provide recovery suggestions', () => {
    const error = new Error('network timeout');
    const suggestions = getRecoverySuggestions(error);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].title).toBeDefined();
  });

  it('should save and restore error context', () => {
    saveErrorContext('/test-route', { data: 'test' }, new Error('test error'));
    const context = restoreErrorContext();
    expect(context).toBeDefined();
    expect(context?.route).toBe('/test-route');
  });
});

describe('Issue #422: Performance Monitoring', () => {
  it('should capture memory snapshots', () => {
    const snapshot = captureMemorySnapshot();
    if (snapshot) {
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.usedJSHeapSize).toBeGreaterThanOrEqual(0);
    }
  });

  it('should detect memory leaks', () => {
    const leak = detectMemoryLeak();
    expect(leak.detected).toBeDefined();
    expect(leak.growthRate).toBeDefined();
  });

  it('should analyze bundle size', () => {
    const stats = analyzeBundleSize();
    expect(stats.totalSize).toBeGreaterThanOrEqual(0);
    expect(stats.scripts).toBeInstanceOf(Array);
    expect(stats.budget).toBeDefined();
  });

  it('should provide optimization suggestions', () => {
    const stats = analyzeBundleSize();
    const suggestions = getOptimizationSuggestions(stats);
    expect(suggestions).toBeInstanceOf(Array);
  });
});
