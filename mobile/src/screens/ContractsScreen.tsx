import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'
import { getSorobanServer, shortAddress } from '../services/stellar'
import { useStore } from '../store'

export default function ContractsScreen() {
  const network = useStore((s) => s.network)
  const [contractId, setContractId] = useState('')
  const [contractInfo, setContractInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchContract() {
    const id = contractId.trim()
    if (!id) return
    setLoading(true)
    setError('')
    setContractInfo(null)

    try {
      const server = getSorobanServer(network)
      const StellarSdk = require('@stellar/stellar-sdk')
      const instance = await server.getContractData(
        id,
        StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        StellarSdk.SorobanRpc.Durability.Persistent,
      )
      setContractInfo({
        contractId: id,
        ...instance,
      })
    } catch (err) {
      setError((err as Error).message || 'Contract not found')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Contracts</Text>

        <Card title="Lookup Contract">
          <Input
            label="Contract ID"
            value={contractId}
            onChangeText={setContractId}
            placeholder="C... contract address"
          />
          <Button
            title={loading ? 'Loading...' : 'Fetch Contract'}
            onPress={fetchContract}
            loading={loading}
            size="sm"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        {contractInfo && (
          <Card title="Contract Info">
            <InfoRow label="ID" value={shortAddress(contractInfo.contractId, 10)} />
            <InfoRow label="Last Modified" value={String(contractInfo.lastModifiedLedgerSeq || 'N/A')} />
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
  error: {
    color: colors.error,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.sm,
  },
})
