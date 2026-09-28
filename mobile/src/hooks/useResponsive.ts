import { Dimensions, useWindowDimensions } from 'react-native'

const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
}

export function useResponsive() {
  const { width, height } = useWindowDimensions()

  return {
    width,
    height,
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    isLandscape: width > height,
    isPortrait: height >= width,
  }
}

export function getResponsiveValue<T>(
  isMobile: boolean,
  mobileValue: T,
  defaultValue: T,
): T {
  return isMobile ? mobileValue : defaultValue
}
