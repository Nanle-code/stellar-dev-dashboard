import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useStore } from '../store'
import { isValidPublicKey, fetchAccount, fetchTransactions, fetchOperations } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Button from '../components/Button'
import Card from '../components/Card'

const FEATURES = [
  { icon: '\u25C9', label: 'Account & Balances', desc: 'Assets, sequence number, thresholds' },
  { icon: '\u21C4', label: 'Transactions', desc: 'Full history, operations, memos' },
  { icon: '\u25A1', label: 'Soroban Contracts', desc: 'Contract data & interaction' },
]

export default function ConnectScreen() {
  const [input, setInput] = useState('')
  const [localError, setLocalError] = useState('')

  const {
    network,
    setConnectedAddress,
    setAccountData,
    setAccountLoading,
    setTransactions,
    setTxLoading,
    setOperations,
    setOpsLoading,
    addAddressToHistory,
  } = useStore()

  async function handleConnect() {
    const addr = input.trim()
    if (!isValidPublicKey(addr)) {
      setLocalError('Invalid Stellar address. Supported: G... (Ed25519), M... (muxed), or name*domain')
      return
    }
    setLocalError('')
    setAccountLoading(true)

    try {
      const account = await fetchAccount(addr, network)
      setConnectedAddress(addr)
      setAccountData(account)
      addAddressToHistory(addr)

      setTxLoading(true)
      setOpsLoading(true)

      fetchTransactions(addr, network, 50)
        .then(({ records, nextCursor, hasMore }) => {
          useStore.getState().setTransactions(records)
          useStore.getState().setTxNextCursor(nextCursor)
          useStore.getState().setTxHasMore(hasMore)
        })
        .catch(() => {
          useStore.getState().setTransactions([])
          useStore.getState().setTxNextCursor(null)
          useStore.getState().setTxHasMore(false)
        })
        .finally(() => {
          useStore.getState().setTxLoading(false)
        })

      fetchOperations(addr, network, 50)
        .then(({ records, nextCursor, hasMore }) => {
          useStore.getState().setOperations(records)
          useStore.getState().setOpsNextCursor(nextCursor)
          useStore.getState().setOpsHasMore(hasMore)
        })
        .catch(() => {
          useStore.getState().setOperations([])
          useStore.getState().setOpsNextCursor(null)
          useStore.getState().setOpsHasMore(false)
        })
        .finally(() => {
          useStore.getState().setOpsLoading(false)
        })
    } catch (err) {
      setLocalError((err as Error)?.message || 'Account not found on ' + network)
    } finally {
      setAccountLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>{'\u2726'} STELLAR</Text>
          <Text style={styles.subtitle}>Developer Dashboard</Text>
          <Text style={styles.hint}>
            Enter a Stellar address: G... {'\u2022'} M... {'\u2022'} name*domain
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, localError ? styles.inputError : null]}
            value={input}
            onChangeText={(t) => {
              setInput(t)
              setLocalError('')
            }}
            placeholder="G... public key, M... muxed, or name*domain"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleConnect}
          />
          <Button
            title="CONNECT"
            onPress={handleConnect}
            size="md"
            style={{ width: '100%', marginTop: spacing.sm }}
          />
          {localError ? (
            <Text style={styles.error}>{'\u2717'} {localError}</Text>
          ) : null}
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <Card key={f.label} variant="outlined" style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.cyan,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radii.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontFamily: undefined,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  features: {
    gap: spacing.sm,
  },
  featureCard: {
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  featureLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
