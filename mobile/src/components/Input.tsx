import React from 'react'
import { TextInput, View, Text, StyleSheet, type TextStyle } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'

interface InputProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  label?: string
  error?: string
  multiline?: boolean
  secureTextEntry?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric'
  style?: TextStyle
  onSubmitEditing?: () => void
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
}

export default function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  multiline = false,
  secureTextEntry = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  keyboardType = 'default',
  style,
  onSubmitEditing,
  returnKeyType,
}: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : null,
          style,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    padding: spacing.md - 4,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    minHeight: 44,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
})
