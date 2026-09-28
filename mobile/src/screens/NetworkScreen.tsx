import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { useStore } from '../store'
import { fetchNetworkStats, NETWORKS } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'
import Button from '../components/Button'

export default function NetworkScreen() {
  const network = useStore((s) => s.network)
  const networkStats = useStore((s) => s.networkStats)
  const statsLoading = useStore((s) => s.statsLoading)

  const [refreshing, setRefreshing] = useState(false)

  async function loadStats() {
    useStore.getState().setStatsLoading(true)
    try {
      const stats = await fetchNetworkStats(network)
      useStore.getState().setNetworkStats(stats)
    } catch {}
    useStore.getState().setStatsLoading(false)
  }

  useEffect(() => {
    loadStats()
  }, [network])

  async function onRefresh() {
    setRefreshing(true)
    await loadStats()
    setRefreshing(false)
  }

  const currentNetwork = NETWORKS[network]

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />
        }
      >
        <Text style={styles.screenTitle}>Network</Text>

        <Card title="Current Network">
          <InfoRow label="Name" value={currentNetwork.name} />
          <InfoRow label="Horizon" value={currentNetwork.horizonUrl} />
          {currentNetwork.sorobanUrl && (
            <InfoRow label="Soroban RPC" value={currentNetwork.sorobanUrl} />
          )}
          {currentNetwork.faucetUrl && (
            <InfoRow label="Faucet" value={currentNetwork.faucetUrl} />
          )}
        </Card>

        {statsLoading && !networkStats ? (
          <Loading message="Fetching network stats..." />
        ) : networkStats ? (
          <>
            <Card title="Latest Ledger">
              <InfoRow
                label="Sequence"
                value={String(networkStats.latestLedger.sequence || 'N/A')}
              />
              <InfoRow
                label="Closed At"
                value={
                  networkStats.latestLedger.closed_at
                    ? new Date(networkStats.latestLedger.closed_at).toLocaleString()
                    : 'N/A'
                }
              />
              <InfoRow
                label="Tx Count"
                value={String(networkStats.latestLedger.transaction_count || 'N/A')}
              />
              <InfoRow
                label="Op Count"
                value={String(networkStats.latestLedger.operation_count || 'N/A')}
              />
            </Card>

            <Card title="Fee Stats">
              <InfoRow
                label="Charged (P10)"
                value={`${networkStats.feeStats.fee_charged?.p10 || 'N/A'} stroops`}
              />
              <InfoRow
                label="Charged (P50)"
                value={`${networkStats.feeStats.fee_charged?.p50 || 'N/A'} stroops`}
              />
              <InfoRow
                label="Charged (P95)"
                value={`${networkStats.feeStats.fee_charged?.p95 || 'N/A'} stroops`}
              />
              <InfoRow
                label="Max Fee (P50)"
                value={`${networkStats.feeStats.max_fee?.p50 || 'N/A'} stroops`}
              />
              <InfoRow
                label="Ledger Capacity Usage"
                value={networkStats.feeStats.ledger_capacity_usage || 'N/A'}
              />
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.errorText}>Failed to load network stats</Text>
          </Card>
        )}

        <Button title="Refresh Stats" onPress={onRefresh} variant="secondary" size="sm" />
      </ScrollView>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 2,
    textAlign: 'right',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
})
