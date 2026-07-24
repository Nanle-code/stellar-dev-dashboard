import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useStore } from '../store'
import { fetchTransactions, shortAddress, getOperationLabel } from '../services/stellar'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Loading from '../components/Loading'

export default function TransactionsScreen() {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const transactions = useStore((s) => s.transactions)
  const txLoading = useStore((s) => s.txLoading)
  const txHasMore = useStore((s) => s.txHasMore)
  const txPagingLoading = useStore((s) => s.txPagingLoading)
  const network = useStore((s) => s.network)

  const [refreshing, setRefreshing] = useState(false)
  const [selectedTx, setSelectedTx] = useState<string | null>(null)

  async function onRefresh() {
    if (!connectedAddress) return
    setRefreshing(true)
    try {
      const { records, nextCursor, hasMore } = await fetchTransactions(
        connectedAddress, network, 50,
      )
      useStore.getState().setTransactions(records)
      useStore.getState().setTxNextCursor(nextCursor)
      useStore.getState().setTxHasMore(hasMore)
    } catch {}
    setRefreshing(false)
  }

  async function loadMore() {
    if (!connectedAddress || !txHasMore || txPagingLoading) return
    useStore.getState().setTxPagingLoading(true)
    try {
      const cursor = useStore.getState().txNextCursor
      const { records, nextCursor, hasMore } = await fetchTransactions(
        connectedAddress, network, 20, cursor,
      )
      useStore.getState().appendTransactions(records)
      useStore.getState().setTxNextCursor(nextCursor)
      useStore.getState().setTxHasMore(hasMore)
    } catch {}
    useStore.getState().setTxPagingLoading(false)
  }

  if (!connectedAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Account Connected</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />
        }
      >
        <Text style={styles.screenTitle}>Transactions</Text>

        {txLoading && transactions.length === 0 ? (
          <Loading message="Loading transactions..." />
        ) : transactions.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No transactions found</Text>
          </Card>
        ) : (
          <>
            {transactions.map((tx: any) => {
              const isSelected = selectedTx === tx.id
              return (
                <TouchableOpacity
                  key={tx.id}
                  onPress={() => setSelectedTx(isSelected ? null : tx.id)}
                  activeOpacity={0.7}
                >
                  <Card style={tx.successful === false ? styles.failedTx : undefined}>
                    <View style={styles.txHeader}>
                      <Text style={styles.txHash}>
                        {shortAddress(tx.hash, 8)}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          tx.successful !== false
                            ? styles.statusSuccess
                            : styles.statusFailed,
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {tx.successful !== false ? 'OK' : 'FAIL'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.txMeta}>
                      <Text style={styles.txTime}>
                        {tx.created_at
                          ? new Date(tx.created_at).toLocaleString()
                          : 'Unknown'}
                      </Text>
                      <Text style={styles.txFee}>
                        Fee: {tx.fee_charged || tx.fee || '?'} stroops
                      </Text>
                    </View>

                    {tx.memo && (
                      <Text style={styles.txMemo}>Memo: {tx.memo}</Text>
                    )}

                    {isSelected && (
                      <View style={styles.txDetail}>
                        <Text style={styles.detailLabel}>Hash</Text>
                        <Text style={styles.detailValue}>{tx.hash}</Text>
                        <Text style={styles.detailLabel}>Source</Text>
                        <Text style={styles.detailValue}>
                          {shortAddress(tx.source_account, 8)}
                        </Text>
                        <Text style={styles.detailLabel}>Ops</Text>
                        <Text style={styles.detailValue}>
                          {tx.operation_count}
                        </Text>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              )
            })}

            {txHasMore && (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={loadMore}
                disabled={txPagingLoading}
              >
                <Text style={styles.loadMoreText}>
                  {txPagingLoading ? 'Loading...' : 'Load More'}
                </Text>
              </TouchableOpacity>
            )}
          </>
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
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txHash: {
    fontSize: typography.fontSize.sm,
    color: colors.cyan,
    fontFamily: undefined,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  statusSuccess: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
  },
  statusFailed: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    color: colors.text.primary,
  },
  txMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  txTime: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  txFee: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
  },
  txMemo: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  txDetail: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontFamily: undefined,
  },
  failedTx: {
    borderColor: 'rgba(220, 53, 69, 0.3)',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  emptyText: {
    color: colors.text.muted,
    textAlign: 'center',
  },
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  loadMoreText: {
    fontSize: typography.fontSize.sm,
    color: colors.cyan,
    fontWeight: typography.fontWeight.medium,
  },
})
