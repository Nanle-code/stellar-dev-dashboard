import { useState, useEffect } from 'react'
import type { ResponsiveBreakpoints, ResponsiveState } from '../types/components'

const BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
}

export function useResponsive(): ResponsiveState {
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  )

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = windowWidth <= BREAKPOINTS.mobile
  const isTablet = windowWidth > BREAKPOINTS.mobile && windowWidth <= BREAKPOINTS.tablet
  const isDesktop = windowWidth > BREAKPOINTS.tablet

  return {
    windowWidth,
    isMobile,
    isTablet,
    isDesktop,
    breakpoints: BREAKPOINTS,
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    setMatches(media.matches)

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', listener)

    return () => media.removeEventListener('change', listener)
  }, [query])

  return matches
}
