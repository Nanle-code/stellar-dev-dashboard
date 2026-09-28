import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupOptimizer, resetBackupOptimizer, getBackupOptimizer } from '../backupOptimizer';

vi.mock('../storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn().mockResolvedValue(undefined),
}));

describe('BackupOptimizer', () => {
  let optimizer: BackupOptimizer;

  beforeEach(() => {
    resetBackupOptimizer();
    optimizer = new BackupOptimizer();
  });

  it('should record change events', () => {
    optimizer.recordChange({ key: 'test-key', entityType: 'transactions', changeType: 'update', size: 100 });
    const state = optimizer.getState();
    expect(state.changeHistory).toHaveLength(1);
    expect(state.changeHistory[0].entityType).toBe('transactions');
    expect(state.changeHistory[0].changeType).toBe('update');
  });

  it('should limit change history to MAX_CHANGE_HISTORY', () => {
    const maxHistory = 10000;
    for (let i = 0; i < maxHistory + 100; i++) {
      optimizer.recordChange({ key: `key-${i}`, entityType: 'test', changeType: 'create', size: 10 });
    }
    expect(optimizer.getState().changeHistory.length).toBeLessThanOrEqual(maxHistory);
  });

  it('should analyze patterns from change history', () => {
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      optimizer.recordChange({ key: `acct-${i % 5}`, entityType: 'account', changeType: 'update', size: 200 });
    }
    for (let i = 0; i < 20; i++) {
      optimizer.recordChange({ key: `tx-${i}`, entityType: 'transactions', changeType: 'create', size: 500 });
    }

    const patterns = optimizer.analyzePatterns();
    expect(patterns.account).toBeDefined();
    expect(patterns.transactions).toBeDefined();
    expect(patterns.account.changeCount).toBe(50);
    expect(patterns.transactions.changeCount).toBe(20);
  });

  it('should compute importance scores', () => {
    for (let i = 0; i < 100; i++) {
      optimizer.recordChange({ key: `k-${i}`, entityType: 'critical-data', changeType: 'update', size: 500 });
    }

    const scores = optimizer.computeImportance();
    expect(scores['critical-data']).toBeDefined();
    expect(scores['critical-data'].score).toBeGreaterThan(0);
    expect(['critical', 'high', 'medium', 'low']).toContain(scores['critical-data'].criticality);
  });

  it('should build backup plans sorted by priority', () => {
    for (let i = 0; i < 60; i++) {
      optimizer.recordChange({ key: `k-${i}`, entityType: 'transactions', changeType: 'update', size: 300 });
    }
    for (let i = 0; i < 10; i++) {
      optimizer.recordChange({ key: `k-${i}`, entityType: 'settings', changeType: 'update', size: 10 });
    }

    const plans = optimizer.buildPlans();
    expect(plans.length).toBeGreaterThan(0);
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].priority).toBeGreaterThanOrEqual(plans[i - 1].priority);
    }
    plans.forEach((plan) => {
      expect(['full', 'incremental', 'differential']).toContain(plan.strategy);
      expect(plan.retentionDays).toBeGreaterThan(0);
    });
  });

  it('should track backup metrics', () => {
    optimizer.recordBackup('transactions', 5000, 1200, 1500);
    optimizer.recordBackup('account', 3000, 800, 900);

    const metrics = optimizer.getState().metrics;
    expect(metrics.totalBackups).toBe(2);
    expect(metrics.totalDataSize).toBe(8000);
    expect(metrics.dedupRatio).toBeGreaterThan(0);
    expect(metrics.avgBackupDuration).toBe(1000);
  });

  it('should calculate efficiency report', () => {
    optimizer.buildPlans();
    const report = optimizer.getEfficiencyReport();
    expect(report.baseline).toBe(40);
    expect(report.current).toBeGreaterThanOrEqual(0);
    expect(report.improvement).toBe(report.current - report.baseline);
  });
});
