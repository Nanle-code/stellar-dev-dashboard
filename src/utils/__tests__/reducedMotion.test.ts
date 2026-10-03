import { describe, expect, it } from 'vitest';
import { getAnimationProps, prefersReducedMotion } from '../reducedMotion';

describe('reduced motion helpers', () => {
  it('disables chart animation when requested', () => {
    expect(getAnimationProps(true)).toEqual({ isAnimationActive: false, animationDuration: 0 });
    expect(getAnimationProps(false)).toEqual({ isAnimationActive: true, animationDuration: 400 });
  });

  it('has a safe false fallback outside a browser', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
