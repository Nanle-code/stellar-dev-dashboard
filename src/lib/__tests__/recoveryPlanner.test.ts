import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecoveryPlanner, resetRecoveryPlanner } from '../recoveryPlanner';

vi.mock('../storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn().mockResolvedValue(undefined),
}));

describe('RecoveryPlanner', () => {
  let planner: RecoveryPlanner;

  beforeEach(() => {
    resetRecoveryPlanner();
    planner = new RecoveryPlanner();
  });

  const mockScores: Record<string, { entityType: string; score: number; criticality: string }> = {
    account: { entityType: 'account', score: 0.9, criticality: 'critical' },
    transactions: { entityType: 'transactions', score: 0.8, criticality: 'high' },
    network: { entityType: 'network', score: 0.7, criticality: 'high' },
    settings: { entityType: 'settings', score: 0.3, criticality: 'low' },
    analytics: { entityType: 'analytics', score: 0.5, criticality: 'medium' },
  };

  it('should classify priorities correctly', () => {
    const priorities = planner.classifyPriorities(mockScores);
    expect(priorities.length).toBe(Object.keys(mockScores).length);
    const critical = priorities.find((p) => p.criticality === 'critical');
    expect(critical?.priority).toBe(1);
    expect(critical?.rto).toBe(15);

    const low = priorities.find((p) => p.criticality === 'low');
    expect(low?.priority).toBe(4);
    expect(low?.rto).toBe(1440);
  });

  it('should generate recovery sequence with dependency resolution', () => {
    const priorities = planner.classifyPriorities(mockScores);
    const sequence = planner.generateSequence(priorities);

    expect(sequence.length).toBeGreaterThan(0);

    const criticalSteps = sequence.filter((s) => s.criticalPath);
    expect(criticalSteps.length).toBeGreaterThan(0);

    const stepNumbers = sequence.map((s) => s.step);
    for (let i = 0; i < stepNumbers.length; i++) {
      expect(stepNumbers[i]).toBe(i + 1);
    }
  });

  it('should create recovery plan with compliance metrics', () => {
    const plan = planner.createPlan(mockScores, 100000);
    expect(plan.id).toBeTruthy();
    expect(plan.priorities.length).toBe(Object.keys(mockScores).length);
    expect(plan.sequence.length).toBeGreaterThan(0);
    expect(plan.rtoCompliance).toBeGreaterThanOrEqual(0);
    expect(plan.rpoCompliance).toBeGreaterThanOrEqual(0);
  });

  it('should track recovery execution', () => {
    const plan = planner.createPlan(mockScores, 100000);
    const event = planner.startRecovery(plan.id);
    expect(event.status).toBe('in_progress');
    expect(event.planId).toBe(plan.id);

    planner.completeRecovery(event.id, 5, 50000, []);
    const state = planner.getState();
    const completed = state.recoveryHistory.find((e) => e.id === event.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.entitiesRestored).toBe(5);
    expect(completed?.duration).toBeGreaterThanOrEqual(0);
  });

  it('should report compliance metrics', () => {
    const report = planner.getComplianceReport();
    expect(report).toHaveProperty('rtoCompliance');
    expect(report).toHaveProperty('rpoCompliance');
    expect(report).toHaveProperty('avgRecoveryTime');
  });

  it('should return null when no active plan', () => {
    expect(planner.getActivePlan()).toBeNull();
  });
});
