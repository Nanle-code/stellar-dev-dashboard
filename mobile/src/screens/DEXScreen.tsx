import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme'
import Card from '../components/Card'
import Input from '../components/Input'
import Button from '../components/Button'

export default function DEXScreen() {
  const [sellingAsset, setSellingAsset] = useState('native')
  const [buyingAsset, setBuyingAsset] = useState('native')
  const [orderBook, setOrderBook] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchOrderBook() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        selling_asset_type: sellingAsset === 'XLM' ? 'native' : 'credit_alphanum4',
        buying_asset_type: buyingAsset === 'XLM' ? 'native' : 'credit_alphanum4',
      })

      if (sellingAsset !== 'XLM' && sellingAsset.includes('-')) {
        const [code, issuer] = sellingAsset.split('-')
        params.append('selling_asset_code', code)
        params.append('selling_asset_issuer', issuer)
      }
      if (buyingAsset !== 'XLM' && buyingAsset.includes('-')) {
        const [code, issuer] = buyingAsset.split('-')
        params.append('buying_asset_code', code)
        params.append('buying_asset_issuer', issuer)
      }

      const res = await fetch(
        `https://horizon-testnet.stellar.org/order_book?${params.toString()}`,
      )
      if (!res.ok) throw new Error('Failed to fetch order book')
      const data = await res.json()
      setOrderBook(data)
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>DEX Explorer</Text>

        <Card title="Order Book Lookup">
          <Input
            label="Selling Asset"
            value={sellingAsset}
            onChangeText={setSellingAsset}
            placeholder="native or CODE-ISSUER"
          />
          <Input
            label="Buying Asset"
            value={buyingAsset}
            onChangeText={setBuyingAsset}
            placeholder="native or CODE-ISSUER"
          />
          <Button
            title={loading ? 'Loading...' : 'Fetch Order Book'}
            onPress={fetchOrderBook}
            loading={loading}
            size="sm"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        {orderBook && (
          <>
            <Card title={`Bids (${orderBook.bids?.length || 0})`}>
              {orderBook.bids?.slice(0, 10).map((bid: any, i: number) => (
                <View key={i} style={styles.orderRow}>
                  <Text style={styles.orderPrice}>{bid.price}</Text>
                  <Text style={styles.orderAmount}>{bid.amount}</Text>
                  <Text style={styles.orderSum}>{bid.sum || ''}</Text>
                </View>
              ))}
              {(!orderBook.bids || orderBook.bids.length === 0) && (
                <Text style={styles.emptyText}>No bids</Text>
              )}
            </Card>

            <Card title={`Asks (${orderBook.asks?.length || 0})`}>
              {orderBook.asks?.slice(0, 10).map((ask: any, i: number) => (
                <View key={i} style={styles.orderRow}>
                  <Text style={styles.orderPrice}>{ask.price}</Text>
                  <Text style={styles.orderAmount}>{ask.amount}</Text>
                  <Text style={styles.orderSum}>{ask.sum || ''}</Text>
                </View>
              ))}
              {(!orderBook.asks || orderBook.asks.length === 0) && (
                <Text style={styles.emptyText}>No asks</Text>
              )}
            </Card>
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
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  orderPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  orderAmount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
    textAlign: 'center',
  },
  orderSum: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    flex: 1,
    textAlign: 'right',
  },
  error: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
})
