import { describe, expect, it, beforeEach } from 'vitest';
import {
  MetricBuilderError,
  METRIC_FIELD_CATALOGUE,
  validateFormula,
  evaluateFormula,
  formatMetricValue,
  saveMetricFormula,
  updateMetricFormula,
  deleteMetricFormula,
  getMetricFormula,
  listMetricFormulas,
  clearAllMetricFormulas,
  evaluateSavedFormula,
  evaluateBatch,
  exportMetricFormulas,
  importMetricFormulas,
} from '../metricBuilder';

// ─── Test data ───────────────────────────────────────────────────────────────

/** Mirrors the shape produced by `buildAnalyticsSnapshot()`. */
const snapshot = {
  account: {
    xlmBalance: 500.25,
    trustlineCount: 4,
    totalAssets: 5,
    nonNativeBalanceCount: 2,
  },
  transactions: {
    totalTransactions: 120,
    successfulTransactions: 108,
    failedTransactions: 12,
    successRate: 0.9,
    weeklyActivity: 35,
    averageOperationsPerTx: 1.5,
  },
  network: {
    latestLedgerSequence: 456789,
    baseFee: 100,
    p90Fee: 200,
    txSuccessCount: 50,
    txFailedCount: 3,
    operationCount: 80,
    averageCloseSeconds: 5.2,
  },
  activity: [],
  risks: [],
};

// ─── Primary flow tests ─────────────────────────────────────────────────────

describe('metricBuilder', () => {
  beforeEach(() => {
    clearAllMetricFormulas();
  });

  // ── Field catalogue ────────────────────────────────────────────────────────

  it('exposes a non-empty Horizon field catalogue with unique paths', () => {
    expect(METRIC_FIELD_CATALOGUE.length).toBeGreaterThan(0);
    const paths = METRIC_FIELD_CATALOGUE.map(f => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  // ── Formula validation ─────────────────────────────────────────────────────

  it('validates well-formed formulas and returns referenced fields', () => {
    const result = validateFormula('account.xlmBalance + transactions.totalTransactions');
    expect(result.valid).toBe(true);
    expect(result.fields).toEqual(
      expect.arrayContaining(['account.xlmBalance', 'transactions.totalTransactions']),
    );
  });

  it('validates formulas with parentheses and all four operators', () => {
    const result = validateFormula('(account.xlmBalance - 100) * 2 / transactions.totalTransactions + 1');
    expect(result.valid).toBe(true);
    expect(result.fields).toHaveLength(2);
  });

  // ── Formula evaluation ─────────────────────────────────────────────────────

  it('evaluates simple field references', () => {
    const result = evaluateFormula('account.xlmBalance', snapshot);
    expect(result.value).toBe(500.25);
    expect(result.resolvedFields).toEqual(['account.xlmBalance']);
  });

  it('evaluates arithmetic between fields', () => {
    // 108 / 120 = 0.9
    const result = evaluateFormula(
      'transactions.successfulTransactions / transactions.totalTransactions',
      snapshot,
    );
    expect(result.value).toBe(0.9);
  });

  it('evaluates complex nested expressions with parentheses', () => {
    // (500.25 + 100) * 2 = 1200.5
    const result = evaluateFormula('(account.xlmBalance + network.baseFee) * 2', snapshot);
    expect(result.value).toBe(1200.5);
  });

  it('evaluates unary negation', () => {
    const result = evaluateFormula('-account.trustlineCount', snapshot);
    expect(result.value).toBe(-4);
  });

  it('evaluates numeric literals only', () => {
    const result = evaluateFormula('42 + 8', snapshot);
    expect(result.value).toBe(50);
  });

  // ── Formatting ─────────────────────────────────────────────────────────────

  it('formats values according to display format', () => {
    expect(formatMetricValue(0.9, 'percentage')).toBe('90.0%');
    expect(formatMetricValue(100, 'stroops')).toBe('100 stroops');
    expect(formatMetricValue(10_000_000, 'xlm')).toBe('1.0000000 XLM');
    // Default 'number' format
    expect(formatMetricValue(42, 'number')).toMatch(/42/);
  });

  it('returns the correct formatted string in evaluation results', () => {
    const result = evaluateFormula('transactions.successRate', snapshot, 'percentage');
    expect(result.formatted).toBe('90.0%');
  });

  // ── Save / load / update / delete (CRUD) ───────────────────────────────────

  it('saves, retrieves, updates, and deletes formulas', () => {
    // Save
    const saved = saveMetricFormula({
      id: 'fee-ratio',
      name: 'Fee Ratio',
      formula: 'network.baseFee / network.p90Fee',
      tags: ['fees'],
    });
    expect(saved.id).toBe('fee-ratio');
    expect(saved.createdAt).toBeTruthy();

    // Get
    expect(getMetricFormula('fee-ratio')).toEqual(expect.objectContaining({ id: 'fee-ratio' }));

    // List
    expect(listMetricFormulas()).toHaveLength(1);
    expect(listMetricFormulas(['fees'])).toHaveLength(1);
    expect(listMetricFormulas(['nonexistent'])).toHaveLength(0);

    // Update
    const updated = updateMetricFormula('fee-ratio', { name: 'Fee Ratio v2' });
    expect(updated.name).toBe('Fee Ratio v2');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(saved.createdAt).getTime(),
    );

    // Delete
    expect(deleteMetricFormula('fee-ratio')).toBe(true);
    expect(getMetricFormula('fee-ratio')).toBeUndefined();
    expect(listMetricFormulas()).toHaveLength(0);
  });

  // ── Integration: evaluate a saved formula ──────────────────────────────────

  it('evaluates a saved formula by id against a data snapshot', () => {
    saveMetricFormula({
      id: 'success-pct',
      name: 'Success Percentage',
      formula: 'transactions.successRate',
      format: 'percentage',
    });

    const result = evaluateSavedFormula('success-pct', snapshot);
    expect(result.value).toBe(0.9);
    expect(result.formatted).toBe('90.0%');
  });

  // ── Batch evaluation ───────────────────────────────────────────────────────

  it('evaluates multiple formulas in a batch, capturing individual errors', () => {
    saveMetricFormula({
      id: 'balance',
      name: 'Balance',
      formula: 'account.xlmBalance',
    });
    saveMetricFormula({
      id: 'bad-ref',
      name: 'Bad Reference',
      formula: 'account.nonExistentField',
    });

    const results = evaluateBatch(['balance', 'bad-ref', 'missing-id'], snapshot);

    expect(results.size).toBe(3);
    // Success
    const balanceResult = results.get('balance')!;
    expect('value' in balanceResult && balanceResult.value).toBe(500.25);
    // Field not found error
    const badResult = results.get('bad-ref')!;
    expect('error' in badResult).toBe(true);
    // Formula not found error
    const missingResult = results.get('missing-id')!;
    expect('error' in missingResult).toBe(true);
  });

  // ── Import / Export ────────────────────────────────────────────────────────

  it('exports and re-imports saved formulas', () => {
    saveMetricFormula({
      id: 'export-test',
      name: 'Export Test',
      formula: 'network.baseFee * 2',
      tags: ['test'],
    });

    const exported = exportMetricFormulas();
    clearAllMetricFormulas();
    expect(listMetricFormulas()).toHaveLength(0);

    const { imported, skipped } = importMetricFormulas(exported);
    expect(imported).toBe(1);
    expect(skipped).toBe(0);
    expect(getMetricFormula('export-test')).toBeDefined();
  });

  // ── Boundary cases ─────────────────────────────────────────────────────────

  describe('boundary cases', () => {
    it('handles a formula at the maximum complexity (deeply nested parentheses)', () => {
      // 10 levels of nesting
      const formula = '((((((((((account.xlmBalance))))))))))';
      const result = evaluateFormula(formula, snapshot);
      expect(result.value).toBe(500.25);
    });

    it('handles a formula with only a numeric literal', () => {
      const result = evaluateFormula('0', snapshot);
      expect(result.value).toBe(0);
    });

    it('handles decimal number literals', () => {
      const result = evaluateFormula('3.14 * 2', snapshot);
      expect(result.value).toBeCloseTo(6.28);
    });

    it('returns false when deleting a non-existent formula', () => {
      expect(deleteMetricFormula('does-not-exist')).toBe(false);
    });

    it('imports partial data, skipping invalid entries', () => {
      const json = JSON.stringify([
        { id: 'valid', name: 'Valid', formula: 'account.xlmBalance', createdAt: '', updatedAt: '', description: '', tags: [] },
        { invalid: true }, // Missing required fields
        { id: 'bad-formula', name: 'Bad', formula: '!!!', createdAt: '', updatedAt: '', description: '', tags: [] },
      ]);
      const { imported, skipped } = importMetricFormulas(json);
      expect(imported).toBe(1);
      expect(skipped).toBe(2);
    });

    it('preserves operator precedence: multiplication before addition', () => {
      // 2 + 3 * 4 = 14 (not 20)
      const result = evaluateFormula('2 + 3 * 4', snapshot);
      expect(result.value).toBe(14);
    });

    it('correctly associates left-to-right for subtraction and division', () => {
      // 10 - 3 - 2 = 5 (not 9)
      const result = evaluateFormula('10 - 3 - 2', snapshot);
      expect(result.value).toBe(5);
    });
  });

  // ── Failure cases ──────────────────────────────────────────────────────────

  describe('failure cases', () => {
    it('rejects an empty formula', () => {
      expect(() => validateFormula('')).toThrow(MetricBuilderError);
      expect(() => validateFormula('   ')).toThrow(MetricBuilderError);
    });

    it('rejects formulas with invalid characters', () => {
      expect(() => validateFormula('account.xlmBalance; DROP TABLE')).toThrow(MetricBuilderError);
      expect(() => validateFormula('eval("alert(1)")')).toThrow(MetricBuilderError);
    });

    it('rejects division by zero at evaluation time', () => {
      expect(() => evaluateFormula('account.xlmBalance / 0', snapshot)).toThrow(MetricBuilderError);
      try {
        evaluateFormula('account.xlmBalance / 0', snapshot);
      } catch (err) {
        expect((err as MetricBuilderError).code).toBe('division_by_zero');
      }
    });

    it('rejects references to missing fields', () => {
      expect(() => evaluateFormula('account.doesNotExist', snapshot)).toThrow(MetricBuilderError);
      try {
        evaluateFormula('account.doesNotExist', snapshot);
      } catch (err) {
        expect((err as MetricBuilderError).code).toBe('field_not_found');
      }
    });

    it('rejects non-string formula input', () => {
      expect(() => validateFormula(42 as unknown as string)).toThrow(MetricBuilderError);
      expect(() => evaluateFormula(null as unknown as string, snapshot)).toThrow(MetricBuilderError);
    });

    it('rejects null data objects', () => {
      expect(() => evaluateFormula('account.xlmBalance', null as unknown as Record<string, unknown>)).toThrow(
        MetricBuilderError,
      );
    });

    it('rejects saving a formula with a duplicate id', () => {
      saveMetricFormula({ id: 'dup-test', name: 'Dup', formula: '42' });
      expect(() => saveMetricFormula({ id: 'dup-test', name: 'Dup2', formula: '43' })).toThrow(MetricBuilderError);
    });

    it('rejects updating a formula that does not exist', () => {
      expect(() => updateMetricFormula('no-such-id', { name: 'Updated' })).toThrow(MetricBuilderError);
    });

    it('rejects saving a formula with an invalid id', () => {
      expect(() => saveMetricFormula({ id: '', name: 'Bad', formula: '1' })).toThrow(MetricBuilderError);
      expect(() => saveMetricFormula({ id: 'has spaces', name: 'Bad', formula: '1' })).toThrow(MetricBuilderError);
    });

    it('rejects saving a formula with an empty name', () => {
      expect(() => saveMetricFormula({ id: 'ok-id', name: '', formula: '1' })).toThrow(MetricBuilderError);
    });

    it('rejects importing invalid JSON', () => {
      expect(() => importMetricFormulas('not json')).toThrow(MetricBuilderError);
      expect(() => importMetricFormulas('"just a string"')).toThrow(MetricBuilderError);
    });

    it('rejects evaluating a saved formula that does not exist', () => {
      expect(() => evaluateSavedFormula('nonexistent', snapshot)).toThrow(MetricBuilderError);
    });

    it('rejects formulas with unbalanced parentheses', () => {
      expect(() => validateFormula('(account.xlmBalance + 1')).toThrow(MetricBuilderError);
      expect(() => validateFormula('account.xlmBalance)')).toThrow(MetricBuilderError);
    });

    it('rejects formulas with trailing operators', () => {
      expect(() => validateFormula('account.xlmBalance +')).toThrow(MetricBuilderError);
    });

    it('rejects formulas with consecutive operators', () => {
      expect(() => validateFormula('account.xlmBalance + * 2')).toThrow(MetricBuilderError);
    });
  });
});
