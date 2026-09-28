import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useStore } from '../store'
import { shortAddress, formatXLM } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function AssetsScreen() {
  const accountData = useStore((s) => s.accountData)
  const accountLoading = useStore((s) => s.accountLoading)
  const network = useStore((s) => s.network)

  if (accountLoading && !accountData) {
    return <Loading message="Loading assets..." fullScreen />
  }

  if (!accountData) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Account Connected</Text>
          <Text style={styles.emptyText}>
            Connect an account from the Home tab to view assets
          </Text>
        </View>
      </View>
    )
  }

  const balances = accountData.balances || []
  const nativeBal = balances.find((b: any) => b.asset_type === 'native')
  const otherBalances = balances.filter((b: any) => b.asset_type !== 'native')
  const totalAssets = balances.length

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Assets</Text>

        <Card title={`Total Assets (${totalAssets})`}>
          <Text style={styles.networkLabel}>Network: {network.toUpperCase()}</Text>
        </Card>

        <Card title="Native">
          <View style={styles.assetRow}>
            <Text style={styles.assetCode}>XLM</Text>
            <Text style={styles.assetBalance}>
              {formatXLM(nativeBal?.balance || '0')}
            </Text>
          </View>
        </Card>

        {otherBalances.length > 0 && (
          <Card title={`Trustlines (${otherBalances.length})`}>
            {otherBalances.map((b: any, i: number) => (
              <View key={i} style={styles.assetRow}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetCode}>
                    {b.asset_code || 'Unknown'}
                  </Text>
                  <Text style={styles.assetIssuer}>
                    {b.asset_issuer ? shortAddress(b.asset_issuer, 6) : 'No issuer'}
                  </Text>
                </View>
                <View style={styles.assetMeta}>
                  <Text style={styles.assetBalance}>
                    {formatXLM(b.balance)}
                  </Text>
                  {b.limit && (
                    <Text style={styles.assetLimit}>
                      Limit: {formatXLM(b.limit)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}

        {otherBalances.length === 0 && (
          <Card>
            <Text style={styles.emptyText}>
              No additional trustlines. Add assets to diversify your portfolio.
            </Text>
          </Card>
        )}
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
  networkLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  assetInfo: {},
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
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  assetLimit: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
  },
})
