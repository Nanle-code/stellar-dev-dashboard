import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const buttonStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    disabled && styles.disabled,
    style,
  ]

  const textStyles = [
    styles.text,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    disabled && styles.textDisabled,
    textStyle,
  ]

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.surface.background : colors.cyan}
        />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: colors.cyan,
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  size_sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  size_md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 4,
    minHeight: 44,
  },
  size_lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
  text_primary: {
    color: colors.surface.background,
  },
  text_secondary: {
    color: colors.text.primary,
  },
  text_ghost: {
    color: colors.cyan,
  },
  text_danger: {
    color: colors.text.primary,
  },
  textSize_sm: {
    fontSize: 13,
  },
  textSize_md: {
    fontSize: 14,
  },
  textSize_lg: {
    fontSize: 16,
  },
  textDisabled: {},
})
