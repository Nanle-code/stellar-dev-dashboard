import { describe, expect, it, beforeEach } from 'vitest';
import { priorityScoringService } from '../priorityScoring';

describe('PriorityScoringService', () => {
  beforeEach(() => {
    priorityScoringService.resetModel();
  });

  it('correctly extracts features', () => {
    const tx = {
      hash: 'tx1',
      fee_charged: '100',
      operation_count: 2,
      created_at: '2026-07-25T12:00:00Z',
    };
    const features = priorityScoringService.extractFeatures(tx);
    expect(features.amount).toBe(0);
    expect(features.fee).toBeGreaterThan(0);
    expect(features.operations).toBeGreaterThan(0);
    expect(features.timing).toBe(0.8); // 12:00 is business hours -> 0.8
  });

  it('scores transaction and responds to manual corrections', () => {
    const tx = {
      hash: 'tx2',
      fee_charged: '100',
      operation_count: 1,
      created_at: '2026-07-25T12:00:00Z',
    };

    const initialDetails = priorityScoringService.scoreTransaction(tx);
    expect(initialDetails.isSuggested).toBe(true);

    // Override to Low
    priorityScoringService.updatePriority(tx, 'Low');
    const updatedDetails = priorityScoringService.scoreTransaction(tx);
    expect(updatedDetails.isSuggested).toBe(false);
    expect(updatedDetails.level).toBe('Low');
    expect(updatedDetails.score).toBeLessThan(35);

    // Override to High
    priorityScoringService.updatePriority(tx, 'High');
    const updatedDetails2 = priorityScoringService.scoreTransaction(tx);
    expect(updatedDetails2.level).toBe('High');
    expect(updatedDetails2.score).toBeGreaterThanOrEqual(70);
  });
});
