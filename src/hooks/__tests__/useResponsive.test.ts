import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResponsive } from '../useResponsive';

describe('useResponsive hook', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  const setWindowDimensions = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
  };

  afterEach(() => {
    setWindowDimensions(originalInnerWidth, originalInnerHeight);
  });

  describe('Primary Flow', () => {
    it('detects desktop layout in portrait or landscape mode', () => {
      setWindowDimensions(1400, 900);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.windowWidth).toBe(1400);
      expect(result.current.windowHeight).toBe(900);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });

    it('detects tablet landscape mode correctly', () => {
      setWindowDimensions(900, 600);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isLandscape).toBe(true);
      expect(result.current.isTabletLandscape).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });

    it('updates dimensions when window resize event fires', () => {
      setWindowDimensions(1000, 600);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.windowWidth).toBe(1000);

      act(() => {
        setWindowDimensions(500, 800);
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.windowWidth).toBe(500);
      expect(result.current.windowHeight).toBe(800);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isPortrait).toBe(true);
    });
  });

  describe('Boundary Cases', () => {
    it('handles exact mobile breakpoint boundary (768px)', () => {
      setWindowDimensions(768, 1024);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isPortrait).toBe(true);
    });

    it('handles exact tablet breakpoint boundary (1024px)', () => {
      setWindowDimensions(1024, 768);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isLandscape).toBe(true);
    });

    it('handles 1:1 square aspect ratio boundary correctly', () => {
      setWindowDimensions(800, 800);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.isPortrait).toBe(true);
      expect(result.current.orientation).toBe('portrait');
    });
  });

  describe('Failure & Edge Cases', () => {
    it('handles zero or negative width gracefully', () => {
      setWindowDimensions(0, 0);
      const { result } = renderHook(() => useResponsive());

      expect(result.current.windowWidth).toBe(0);
      expect(result.current.windowHeight).toBe(0);
      expect(result.current.isMobile).toBe(true);
    });

    it('handles NaN window dimensions without crashing', () => {
      setWindowDimensions(NaN, NaN);
      const { result } = renderHook(() => useResponsive());

      expect(typeof result.current.windowWidth).toBe('number');
      expect(result.current.windowWidth).toBeGreaterThan(0);
    });
  });
});
