import React, { type ErrorInfo, type ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>!</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
    padding: spacing.lg,
  },
  icon: {
    fontSize: 48,
    color: colors.error,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 4,
    borderRadius: radii.md,
  },
  buttonText: {
    color: colors.surface.background,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.md,
  },
})
