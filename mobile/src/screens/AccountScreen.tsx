import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useStore } from '../store'
import { shortAddress, formatXLM } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function AccountScreen() {
  const accountData = useStore((s) => s.accountData)
  const accountLoading = useStore((s) => s.accountLoading)

  if (accountLoading && !accountData) {
    return <Loading message="Loading account..." fullScreen />
  }

  if (!accountData) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Account Connected</Text>
          <Text style={styles.emptyText}>
            Connect an account from the Home tab to view details
          </Text>
        </View>
      </View>
    )
  }

  const { signers, thresholds, balances, sequence, subentry_count } = accountData
  const nativeBalance = balances.find((b: any) => b.asset_type === 'native')

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card title="Account Info">
          <InfoRow label="ID" value={shortAddress(accountData.account_id, 8)} />
          <InfoRow label="Sequence" value={sequence} />
          <InfoRow label="Subentries" value={String(subentry_count)} />
        </Card>

        <Card title="Thresholds">
          <InfoRow label="Low" value={String(thresholds.low_threshold)} />
          <InfoRow label="Medium" value={String(thresholds.med_threshold)} />
          <InfoRow label="High" value={String(thresholds.high_threshold)} />
        </Card>

        <Card title={`Signers (${signers.length})`}>
          {signers.map((s: any, i: number) => (
            <View key={i} style={styles.signerRow}>
              <Text style={styles.signerKey}>{shortAddress(s.key, 6)}</Text>
              <View style={styles.signerMeta}>
                <Text style={styles.signerType}>{s.type}</Text>
                <Text style={styles.signerWeight}>Weight: {s.weight}</Text>
              </View>
            </View>
          ))}
        </Card>

        <Card title={`Balances (${balances.length})`}>
          {balances.map((b: any, i: number) => (
            <View key={i} style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceAsset}>
                  {b.asset_type === 'native' ? 'XLM' : b.asset_code || 'Unknown'}
                </Text>
                {b.asset_issuer && (
                  <Text style={styles.balanceIssuer}>
                    {shortAddress(b.asset_issuer, 4)}
                  </Text>
                )}
              </View>
              <Text style={styles.balanceAmount}>
                {formatXLM(b.balance)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    fontFamily: undefined,
  },
  signerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  signerKey: {
    fontSize: typography.fontSize.sm,
    color: colors.cyan,
    fontFamily: undefined,
  },
  signerMeta: {
    alignItems: 'flex-end',
  },
  signerType: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  signerWeight: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  balanceAsset: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  balanceIssuer: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  balanceAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
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
