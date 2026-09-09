import { beforeEach, describe, expect, it } from 'vitest';
import { classifyExpertise, resolveExpertiseLevel, type ExpertiseSignals } from '../expertiseAdaptation';

describe('expertiseAdaptation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('classifies low-signal sessions as novice', () => {
    const signals: ExpertiseSignals = {
      sessionDurationMinutes: 4,
      advancedFeatureUses: 0,
      repeatedTaskCount: 1,
      successfulActions: 2,
    };

    expect(classifyExpertise(signals)).toBe('novice');
  });

  it('classifies high-signal sessions as expert', () => {
    const signals: ExpertiseSignals = {
      sessionDurationMinutes: 65,
      advancedFeatureUses: 8,
      repeatedTaskCount: 10,
      successfulActions: 40,
    };

    expect(classifyExpertise(signals)).toBe('expert');
  });

  it('prefers an explicit override over inferred signals', () => {
    const signals: ExpertiseSignals = {
      sessionDurationMinutes: 4,
      advancedFeatureUses: 0,
      repeatedTaskCount: 1,
      successfulActions: 2,
    };

    const resolved = resolveExpertiseLevel({
      signals,
      storedOverride: 'expert',
    });

    expect(resolved).toBe('expert');
  });
});
