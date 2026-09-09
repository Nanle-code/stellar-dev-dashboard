import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BackupScheduler, resetBackupScheduler } from '../backupScheduler';

vi.mock('../storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn().mockResolvedValue(undefined),
}));

describe('BackupScheduler', () => {
  let scheduler: BackupScheduler;

  beforeEach(() => {
    resetBackupScheduler();
    scheduler = new BackupScheduler();
  });

  const mockPatterns: Record<string, { peakHours: number[]; frequency: number }> = {
    account: { peakHours: [2, 3], frequency: 50 },
    transactions: { peakHours: [14, 15], frequency: 200 },
    network: { peakHours: [4], frequency: 10 },
  };

  const mockPlans = [
    { entityType: 'account', strategy: 'incremental', interval: 30, priority: 1, nextBackup: Date.now() - 60000 },
    { entityType: 'transactions', strategy: 'incremental', interval: 15, priority: 2, nextBackup: Date.now() - 120000 },
    { entityType: 'network', strategy: 'full', interval: 120, priority: 3, nextBackup: Date.now() + 300000 },
  ];

  it('should generate default windows', () => {
    const state = scheduler.getState();
    expect(state.windows.length).toBe(7 * 24);
    const recommended = state.windows.filter((w) => w.recommended);
    expect(recommended.length).toBeGreaterThan(0);
  });

  it('should optimize windows based on patterns', () => {
    const windows = scheduler.optimizeWindows(mockPatterns);
    const peakWindows = windows.filter((w) => w.hour === 2 || w.hour === 3 || w.hour === 14);
    for (const pw of peakWindows) {
      expect(pw.score).toBeLessThan(0.95);
    }
  });

  it('should return a recommended window', () => {
    const window = scheduler.getRecommendedWindow();
    expect(window).not.toBeNull();
    expect(window!.recommended).toBe(true);
    expect(window!.score).toBeGreaterThan(0.75);
  });

  it('should schedule tasks from plans', () => {
    const tasks = scheduler.scheduleTasks(mockPlans);
    expect(tasks.length).toBe(3);
    expect(tasks[0].priority).toBeLessThanOrEqual(tasks[1].priority);
    expect(tasks[0].status).toBe('pending');
  });

  it('should return next pending task', () => {
    scheduler.scheduleTasks(mockPlans);
    const next = scheduler.getNextTask();
    expect(next).not.toBeNull();
    expect(next!.status).toBe('pending');
  });

  it('should complete tasks and update metrics', () => {
    scheduler.scheduleTasks(mockPlans);
    const tasks = scheduler.getState().tasks;
    expect(tasks.length).toBeGreaterThan(0);

    scheduler.startTask(tasks[0].id);
    scheduler.completeTask(tasks[0].id, 1500, 5000);

    const metrics = scheduler.getState().metrics;
    expect(metrics.completedTasks).toBe(1);
    expect(metrics.totalTasks).toBe(1);
  });

  it('should predict optimal timing based on patterns', () => {
    const timing = scheduler.predictOptimalTiming('account', mockPatterns);
    expect(timing).toBeGreaterThan(Date.now());
  });

  it('should provide efficiency projection', () => {
    const projection = scheduler.getEfficiencyProjection();
    expect(projection.projectedGain).toBeGreaterThanOrEqual(0);
    expect(projection.optimalWindowCount).toBeGreaterThan(0);
    expect(projection.avgTaskDelay).toBeGreaterThanOrEqual(0);
  });
});
