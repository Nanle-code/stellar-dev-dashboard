import { describe, expect, it } from 'vitest';
import { learnAccessibilityPreferences } from './accessibilityAdaptive';

describe('accessibilityAdaptive', () => {
  it('learns from explicit feedback and interaction patterns to recommend comfort-focused settings', () => {
    const profile = learnAccessibilityPreferences(
      {
        settings: {
          reducedMotion: false,
          highContrast: false,
          fontSize: 'default',
          dyslexiaFont: false,
          adaptiveMode: true,
        },
        recommendations: [],
        feedbackHistory: [],
        confidence: 0,
      },
      [
        { type: 'keyboard', value: 0.85 },
        { type: 'long-session', value: 0.7 },
        { type: 'error', value: 0.6 },
      ],
      [
        {
          type: 'explicit',
          preference: {
            reducedMotion: true,
            highContrast: true,
            fontSize: 'large',
            dyslexiaFont: true,
          },
          strength: 0.9,
        },
      ]
    );

    expect(profile.recommendations.some((item) => item.key === 'highContrast' && item.value === true)).toBe(true);
    expect(profile.recommendations.some((item) => item.key === 'fontSize' && item.value === 'large')).toBe(true);
    expect(profile.recommendations.some((item) => item.key === 'dyslexiaFont' && item.value === true)).toBe(true);
    expect(profile.confidence).toBeGreaterThan(0.8);
  });
});
