import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useStore } from '../store'
import { fetchXLMPrice, formatXLM, shortAddress } from '../services/stellar'
import { colors, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function PortfolioScreen() {
  const accountData = useStore((s) => s.accountData)
  const [xlmPrice, setXlmPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchXLMPrice()
      .then((p) => setXlmPrice(p.usd))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (!accountData) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Account Connected</Text>
        </View>
      </View>
    )
  }

  if (loading) return <Loading message="Calculating portfolio..." fullScreen />

  const balances = accountData.balances || []
  const nativeBalance = balances.find((b: any) => b.asset_type === 'native')
  const xlmAmount = parseFloat(nativeBalance?.balance || '0')
  const usdValue = xlmPrice ? xlmAmount * xlmPrice : null

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Portfolio</Text>

        <Card variant="elevated">
          <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
          <Text style={styles.portfolioValue}>
            {usdValue ? `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
          </Text>
          {xlmPrice && (
            <Text style={styles.xlmInfo}>
              {formatXLM(xlmAmount)} XLM @ ${xlmPrice.toFixed(6)}
            </Text>
          )}
        </Card>

        <Card title="Asset Breakdown">
          {balances.map((b: any, i: number) => {
            const amount = parseFloat(b.balance)
            const balUsd = b.asset_type === 'native' && xlmPrice ? amount * xlmPrice : null
            return (
              <View key={i} style={styles.assetRow}>
                <View>
                  <Text style={styles.assetCode}>
                    {b.asset_type === 'native' ? 'XLM' : b.asset_code || 'Unknown'}
                  </Text>
                  {b.asset_issuer && (
                    <Text style={styles.assetIssuer}>
                      {shortAddress(b.asset_issuer, 4)}
                    </Text>
                  )}
                </View>
                <View style={styles.assetMeta}>
                  <Text style={styles.assetBalance}>{formatXLM(b.balance)}</Text>
                  {balUsd !== null && (
                    <Text style={styles.assetUsd}>
                      ${balUsd.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            )
          })}
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
  portfolioLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  portfolioValue: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  xlmInfo: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  assetCode: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  assetIssuer: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  assetMeta: {
    alignItems: 'flex-end',
  },
  assetBalance: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  assetUsd: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
})
