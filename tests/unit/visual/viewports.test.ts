import { describe, it, expect } from 'vitest';
import {
  VISUAL_VIEWPORTS,
  VISUAL_VIEWPORT_LIST,
  VISUAL_DIFF_THRESHOLD,
} from '../../../tests/visual/viewports';

describe('visual viewports config', () => {
  it('defines mobile, tablet, desktop, and wide viewports', () => {
    expect(VISUAL_VIEWPORTS.mobile).toEqual({ width: 375, height: 667, label: 'mobile' });
    expect(VISUAL_VIEWPORTS.tablet).toEqual({ width: 768, height: 1024, label: 'tablet' });
    expect(VISUAL_VIEWPORTS.desktop).toEqual({ width: 1280, height: 800, label: 'desktop' });
    expect(VISUAL_VIEWPORTS.wide).toEqual({ width: 1440, height: 900, label: 'wide' });
  });

  it('exports viewport list for Playwright projects', () => {
    expect(VISUAL_VIEWPORT_LIST).toHaveLength(4);
    expect(VISUAL_VIEWPORT_LIST.map((v) => v.name)).toEqual([
      'mobile',
      'tablet',
      'desktop',
      'wide',
    ]);
  });

  it('uses 0.2% pixel diff threshold', () => {
    expect(VISUAL_DIFF_THRESHOLD).toBe(0.002);
  });
});
