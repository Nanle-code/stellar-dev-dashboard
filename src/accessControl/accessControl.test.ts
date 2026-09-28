import { describe, it, expect } from 'vitest';
import { analyzeAccessPatterns, recordAppliedRecommendations } from './engine.js';

describe('access-control engine', () => {
  it('returns recommendations array', async () => {
    const res = await analyzeAccessPatterns();
    expect(res).toHaveProperty('recommendations');
    expect(Array.isArray(res.recommendations)).toBe(true);
  });

  it('can record applied recommendations', async () => {
    const sample = [{ user: 'test-user', type: 'role_assignment', suggestedRole: 'viewer' }];
    const updated = await recordAppliedRecommendations(sample);
    expect(updated).toHaveProperty('applied');
    const found = updated.applied.find((a) => a.user === 'test-user' && a.suggestedRole === 'viewer');
    expect(found).toBeTruthy();
    expect(found).toHaveProperty('appliedAt');
  });
});
