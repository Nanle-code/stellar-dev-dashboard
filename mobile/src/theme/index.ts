import { StyleSheet } from 'react-native'

export const colors = {
  primary: '#0066ff',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  error: '#dc3545',
  brand: {
    primary: '#0066ff',
    secondary: '#7c3aed',
  },
  semantic: {
    info: '#0066ff',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
  },
  surface: {
    background: '#08111f',
    card: '#0f172a',
    elevated: '#111827',
    overlay: 'rgba(15, 23, 42, 0.88)',
  },
  text: {
    primary: '#f8fafc',
    secondary: '#cbd5e1',
    muted: '#94a3b8',
    inverse: '#0f172a',
  },
  border: {
    subtle: 'rgba(148, 163, 184, 0.15)',
    default: 'rgba(148, 163, 184, 0.22)',
    strong: 'rgba(148, 163, 184, 0.36)',
  },
  cyan: '#00d4aa',
  cyanDim: 'rgba(0, 212, 170, 0.7)',
  red: '#ef4444',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const typography = {
  fontFamily: {
    display: undefined,
    body: undefined,
    mono: undefined,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
}

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
}

export const lightColors = {
  ...colors,
  surface: {
    background: '#f8fafc',
    card: '#ffffff',
    elevated: '#f1f5f9',
    overlay: 'rgba(248, 250, 252, 0.88)',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
    inverse: '#f8fafc',
  },
  border: {
    subtle: 'rgba(15, 23, 42, 0.08)',
    default: 'rgba(15, 23, 42, 0.15)',
    strong: 'rgba(15, 23, 42, 0.25)',
  },
}

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCenter: {
    textAlign: 'center',
  },
  mono: {
    fontFamily: undefined,
  },
})
