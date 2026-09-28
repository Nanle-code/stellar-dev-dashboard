/**
 * Centralized viewport definitions for visual regression testing.
 * Used by Playwright visual projects and Chromatic (Storybook).
 */

export const VISUAL_VIEWPORTS = {
  mobile: { width: 375, height: 667, label: 'mobile' },
  tablet: { width: 768, height: 1024, label: 'tablet' },
  desktop: { width: 1280, height: 800, label: 'desktop' },
  wide: { width: 1440, height: 900, label: 'wide' },
} as const;

export type VisualViewportName = keyof typeof VISUAL_VIEWPORTS;

export const VISUAL_VIEWPORT_LIST = Object.entries(VISUAL_VIEWPORTS).map(
  ([name, config]) => ({ name: name as VisualViewportName, ...config })
);

/** Playwright screenshot diff tolerance (0.2% pixel difference). */
export const VISUAL_DIFF_THRESHOLD = 0.002;
