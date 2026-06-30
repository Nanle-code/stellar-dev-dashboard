import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '../theme'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { fundTestnetAccount, isValidPublicKey } from '../services/stellar'

export default function FaucetScreen() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleFund() {
    const addr = address.trim()
    if (!isValidPublicKey(addr)) {
      setError('Invalid Stellar address')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)

    try {
      const res = await fundTestnetAccount(addr)
      setResult('Account funded successfully!')
    } catch (err) {
      setError((err as Error).message || 'Faucet request failed')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Faucet</Text>

        <Card title="Testnet Faucet">
          <Text style={styles.hint}>
            Fund a testnet account with free XLM for development and testing.
          </Text>
          <Input
            label="Public Key"
            value={address}
            onChangeText={setAddress}
            placeholder="G... public key"
          />
          <Button
            title={loading ? 'Funding...' : 'Fund Account'}
            onPress={handleFund}
            loading={loading}
            size="sm"
          />
          {result ? <Text style={styles.success}>{result}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  screenTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  success: {
    fontSize: typography.fontSize.sm,
    color: colors.success,
    marginTop: spacing.sm,
  },
  error: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.sm,
  },
})
