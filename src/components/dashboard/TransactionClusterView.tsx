import React, { useState, useMemo, MouseEvent, ChangeEvent } from 'react'
import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useStore } from '../../lib/store'
import { clusterTransactionsSmart, SmartTransactionCluster, StellarTransaction } from '../../lib/transactionPatternAnalysis'
import { shortAddress } from '../../lib/stellar'
import { exportCsv, flattenTransaction } from '../../utils/export'

export default function TransactionClusterView() {
  const { transactions, operations } = useStore()
  const [algorithm, setAlgorithm] = useState<'dbscan' | 'hierarchical'>('dbscan')
  const [expandedClusters, setExpandedClusters] = useState<Set<string | number>>(new Set())
  const [selectedClusterId, setSelectedClusterId] = useState<string | number | null>(null)

  const clusters = useMemo(() => {
    return clusterTransactionsSmart(transactions, operations, algorithm)
  }, [transactions, operations, algorithm])

  const toggleCluster = (id: string | number, e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const next = new Set(expandedClusters)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedClusters(next)
  }

  const handleExportCluster = (cluster: SmartTransactionCluster, e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    exportCsv(
      cluster.transactions.map(flattenTransaction),
      `stellar-cluster-${cluster.label.toLowerCase().replace(/\s+/g, '-')}`,
      ['id', 'hash', 'ledger', 'created_at', 'source_account', 'fee_charged', 'operation_count', 'successful', 'memo_type', 'memo']
    )
  }

  const handleAlgorithmChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setAlgorithm(e.target.value as 'dbscan' | 'hierarchical')
  }

  const handleClusterClick = (clusterId: string | number) => {
    setSelectedClusterId(clusterId === selectedClusterId ? null : clusterId)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>Transaction Clusters</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Algorithm:</span>
          <select
            value={algorithm}
            onChange={handleAlgorithmChange}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <option value="dbscan">DBSCAN</option>
            <option value="hierarchical">Hierarchical</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            style={{
              background: 'var(--bg-card)',
              border: selectedClusterId === cluster.id
                ? '2px solid var(--cyan)'
                : '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onClick={() => handleClusterClick(cluster.id)}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}
              onClick={(e) => toggleCluster(cluster.id, e)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {expandedClusters.has(cluster.id) ? (
                  <ChevronDown size={14} color="var(--text-muted)" />
                ) : (
                  <ChevronRight size={14} color="var(--text-muted)" />
                )}
                <span style={{ fontWeight: 600, fontSize: '14px' }}>{cluster.label}</span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-elevated)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {cluster.transactions.length} txs
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success Rate</div>
                <div style={{ fontSize: '14px', color: cluster.successRate > 80 ? 'var(--green)' : cluster.successRate > 50 ? 'var(--amber)' : 'var(--red)' }}>
                  {cluster.successRate}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Fee</div>
                <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)' }}>{cluster.avgFee} stroops</div>
              </div>
            </div>

            {cluster.timePattern && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Time: {cluster.timePattern}
              </div>
            )}
            {cluster.mainCounterparty && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Counterparty: {shortAddress(cluster.mainCounterparty)}
              </div>
            )}
            {cluster.avgAmount > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Avg Amount: {cluster.avgAmount.toFixed(4)} XLM
              </div>
            )}

            <button
              onClick={(e) => handleExportCluster(cluster, e)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '12px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Download size={14} />
              Export CSV
            </button>

            {expandedClusters.has(cluster.id) && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Transactions:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                  {cluster.transactions.map((tx: StellarTransaction) => (
                    <div
                      key={tx.id}
                      style={{
                        padding: '6px 8px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tx.hash}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
