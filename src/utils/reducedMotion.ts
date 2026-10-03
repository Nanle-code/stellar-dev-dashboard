export interface AnimationProps {
  isAnimationActive: boolean;
  animationDuration: number;
}

/** Recharts-compatible props that make a visual update instantaneous. */
export function getAnimationProps(reducedMotion: boolean): AnimationProps {
  return {
    isAnimationActive: !reducedMotion,
    animationDuration: reducedMotion ? 0 : 400,
  };
}

/** Safe media-query check for browsers, SSR, and older test environments. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
