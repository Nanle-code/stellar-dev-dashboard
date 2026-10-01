import { useState, useEffect } from 'react';
import type { ResponsiveBreakpoints, ResponsiveState } from '../types/components';

const BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

export function useResponsive(): ResponsiveState {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        width:
          typeof window.innerWidth === 'number' && !isNaN(window.innerWidth)
            ? Math.max(0, window.innerWidth)
            : 1200,
        height:
          typeof window.innerHeight === 'number' && !isNaN(window.innerHeight)
            ? Math.max(0, window.innerHeight)
            : 800,
      };
    }
    return { width: 1200, height: 800 };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      try {
        const w =
          typeof window.innerWidth === 'number' && !isNaN(window.innerWidth)
            ? Math.max(0, window.innerWidth)
            : 1200;
        const h =
          typeof window.innerHeight === 'number' && !isNaN(window.innerHeight)
            ? Math.max(0, window.innerHeight)
            : 800;
        setDimensions({ width: w, height: h });
      } catch {
        // Safe fallback if window dimensions access fails
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const windowWidth = dimensions.width;
  const windowHeight = dimensions.height;

  let isLandscape = windowWidth > windowHeight;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const media = window.matchMedia('(orientation: landscape)');
      if (media && media.matches) {
        isLandscape = true;
      }
    } catch {
      // Fallback to width > height calculation
    }
  }

  const isMobile = windowWidth <= BREAKPOINTS.mobile;
  const isTablet = windowWidth > BREAKPOINTS.mobile && windowWidth <= BREAKPOINTS.tablet;
  const isDesktop = windowWidth > BREAKPOINTS.tablet;

  const isPortrait = !isLandscape;
  const orientation: 'portrait' | 'landscape' = isLandscape ? 'landscape' : 'portrait';
  const isTabletLandscape =
    (isTablet || (windowWidth >= 600 && windowWidth <= 1024)) && isLandscape;

  return {
    windowWidth,
    windowHeight,
    orientation,
    isLandscape,
    isPortrait,
    isTabletLandscape,
    isMobile,
    isTablet,
    isDesktop,
    breakpoints: BREAKPOINTS,
  };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    try {
      const media = window.matchMedia(query);
      setMatches(media.matches);

      const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
      } else if (typeof (media as any).addListener === 'function') {
        (media as any).addListener(listener);
        return () => (media as any).removeListener(listener);
      }
    } catch {
      // Fallback for unsupported media query execution
    }
  }, [query]);

  return matches;
}
