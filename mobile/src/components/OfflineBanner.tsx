import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '../theme'

interface OfflineBannerProps {
  isOnline: boolean
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const slideAnim = useRef(new Animated.Value(isOnline ? -50 : 0)).current

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? -50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isOnline, slideAnim])

  if (isOnline) return null

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.text}>You are offline. Showing cached data.</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  text: {
    color: colors.text.inverse,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
})
