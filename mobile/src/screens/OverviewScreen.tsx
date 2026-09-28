import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { useStore } from '../store'
import {
  fetchAccount,
  fetchXLMPrice,
  calculateAccountReserves,
  shortAddress,
  formatXLM,
} from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'
import Button from '../components/Button'
import OfflineBanner from '../components/OfflineBanner'
import ConnectScreen from './ConnectScreen'

export default function OverviewScreen() {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const accountData = useStore((s) => s.accountData)
  const accountLoading = useStore((s) => s.accountLoading)
  const network = useStore((s) => s.network)
  const isOnline = useStore((s) => s.isOnline)
  const networkStats = useStore((s) => s.networkStats)

  const [refreshing, setRefreshing] = useState(false)
  const [xlmPrice, setXlmPrice] = useState<number | null>(null)

  useEffect(() => {
    fetchXLMPrice().then((p) => setXlmPrice(p.usd)).catch(() => {})
  }, [])

  if (!connectedAddress) {
    return <ConnectScreen />
  }

  async function onRefresh() {
    setRefreshing(true)
    try {
      const account = await fetchAccount(connectedAddress, network)
      useStore.getState().setAccountData(account)
      const price = await fetchXLMPrice()
      setXlmPrice(price.usd)
    } catch {}
    setRefreshing(false)
  }

  if (accountLoading && !accountData) {
    return <Loading message="Loading account data..." fullScreen />
  }

  const balances = accountData?.balances || []
  const nativeBalance = balances.find((b: any) => b.asset_type === 'native')
  const xlmAmount = nativeBalance?.balance || '0'
  const reserves = accountData && networkStats
    ? calculateAccountReserves(accountData, networkStats)
    : null
  const usdValue = xlmPrice ? (parseFloat(xlmAmount) * xlmPrice).toFixed(2) : null

  return (
    <View style={styles.container}>
      <OfflineBanner isOnline={isOnline} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.cyan}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Dashboard</Text>
          <TouchableOpacity>
            <Text style={styles.address}>
              {shortAddress(connectedAddress, 8)}
            </Text>
          </TouchableOpacity>
          <View style={styles.networkBadge}>
            <Text style={styles.networkText}>{network.toUpperCase()}</Text>
          </View>
        </View>

        <Card variant="elevated">
          <Text style={styles.balanceLabel}>XLM Balance</Text>
          <Text style={styles.balanceAmount}>{formatXLM(xlmAmount)}</Text>
          {usdValue && (
            <Text style={styles.usdValue}>${usdValue} USD</Text>
          )}
        </Card>

        {reserves && (
          <Card title="Reserves">
            <View style={styles.reserveRow}>
              <Text style={styles.reserveLabel}>Total Reserves</Text>
              <Text style={styles.reserveValue}>
                {formatXLM(reserves.totalReserves)} XLM
              </Text>
            </View>
            <View style={styles.reserveRow}>
              <Text style={styles.reserveLabel}>Available</Text>
              <Text style={styles.reserveValue}>
                {formatXLM(reserves.availableBalance)} XLM
              </Text>
            </View>
          </Card>
        )}

        <Card title="Assets">
          {balances.length === 0 ? (
            <Text style={styles.emptyText}>No assets found</Text>
          ) : (
            balances.map((b: any, i: number) => (
              <View key={i} style={styles.assetRow}>
                <View style={styles.assetInfo}>
                  <Text style={styles.assetCode}>
                    {b.asset_type === 'native' ? 'XLM' : b.asset_code || 'Unknown'}
                  </Text>
                  {b.asset_issuer && (
                    <Text style={styles.assetIssuer}>
                      {shortAddress(b.asset_issuer, 4)}
                    </Text>
                  )}
                </View>
                <Text style={styles.assetBalance}>
                  {formatXLM(b.balance)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card title="Quick Actions">
          <View style={styles.actions}>
            <Button
              title="Refresh Account"
              onPress={onRefresh}
              variant="secondary"
              size="sm"
            />
            <Button
              title="Change Network"
              onPress={() => {
                const networks = ['testnet', 'mainnet', 'futurenet'] as const
                const current = networks.indexOf(network as any)
                const next = networks[(current + 1) % networks.length]
                useStore.getState().setNetwork(next)
              }}
              variant="ghost"
              size="sm"
            />
          </View>
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
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  greeting: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  address: {
    fontSize: typography.fontSize.sm,
    color: colors.cyan,
    marginTop: spacing.xs,
  },
  networkBadge: {
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
    marginTop: spacing.xs,
  },
  networkText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 1,
  },
  balanceLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  usdValue: {
    fontSize: typography.fontSize.md,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  reserveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reserveLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  reserveValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  assetIssuer: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  assetBalance: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
})
