import React from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { colors, typography, spacing } from '../theme'

interface LoadingProps {
  message?: string
  size?: 'small' | 'large'
  fullScreen?: boolean
}

export default function Loading({
  message = 'Loading...',
  size = 'large',
  fullScreen = false,
}: LoadingProps) {
  const container = fullScreen ? styles.fullScreen : styles.inline

  return (
    <View style={container}>
      <ActivityIndicator size={size} color={colors.cyan} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
  },
  inline: {
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
})
