/**
 * Shared component-prop types reused across the dashboard. Keeping these in a
 * dedicated module avoids circular imports between feature components and
 * lets us evolve a single source of truth as the TS migration progresses.
 */

import type { CSSProperties, ReactNode } from 'react'

export interface CardProps {
  children?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  glow?: boolean
  style?: CSSProperties
  className?: string
}

export interface StatCardProps {
  label: ReactNode
  value?: ReactNode
  sub?: ReactNode
  accent?: string
  loading?: boolean
}

export interface CopyableValueProps {
  value: string
  children?: ReactNode
  title?: string
  textStyle?: CSSProperties
  containerStyle?: CSSProperties
  buttonStyle?: CSSProperties
}

export interface ResponsiveBreakpoints {
  mobile: number
  tablet: number
  desktop: number
}

export interface ResponsiveState {
  windowWidth: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  breakpoints: ResponsiveBreakpoints
}
