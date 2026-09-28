import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useStore } from '../store'
import { shortAddress } from '../services/stellar'
import { colors, spacing, typography } from '../theme'
import Card from '../components/Card'

export default function MultisigScreen() {
  const accountData = useStore((s) => s.accountData)

  if (!accountData) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Account Connected</Text>
        </View>
      </View>
    )
  }

  const { signers, thresholds } = accountData

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Multi-Signature</Text>

        <Card title="Thresholds">
          <InfoRow label="Low" value={String(thresholds.low_threshold)} />
          <InfoRow label="Medium" value={String(thresholds.med_threshold)} />
          <InfoRow label="High" value={String(thresholds.high_threshold)} />
          <Text style={styles.hint}>
            Transactions require signer weights to meet the corresponding threshold.
          </Text>
        </Card>

        <Card title={`Signers (${signers.length})`}>
          {signers.map((s: any, i: number) => (
            <View key={i} style={styles.signerRow}>
              <View style={styles.signerInfo}>
                <Text style={styles.signerKey}>
                  {shortAddress(s.key, 8)}
                </Text>
                <Text style={styles.signerType}>{s.type}</Text>
              </View>
              <View style={styles.signerWeight}>
                <Text style={styles.weightValue}>{s.weight}</Text>
              </View>
            </View>
          ))}
        </Card>

        {signers.length <= 1 && (
          <Card>
            <Text style={styles.emptyText}>
              This account has only one signer (master key). Add additional signers to enable multi-sig.
            </Text>
          </Card>
        )}
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
  screenTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
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
  },
  signerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  signerInfo: {},
  signerKey: {
    fontSize: typography.fontSize.sm,
    color: colors.cyan,
  },
  signerType: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
  signerWeight: {
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  weightValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  hint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.sm,
    lineHeight: 16,
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
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
