import React, { useState, useMemo, useCallback } from 'react'
import { useAddressLabels } from '../../hooks/useAddressLabels'
import { shortAddress } from '../../lib/stellar'
import {
  X, Users, TrendingUp, Layers, ArrowUpRight, ArrowLeftRight,
  Star, Network, Zap, Activity,
} from 'lucide-react'

const SCORE_COLORS = [
  { min: 0.8, color: '#ef4444', label: 'Very High' },
  { min: 0.6, color: '#f59e0b', label: 'High' },
  { min: 0.4, color: '#8b5cf6', label: 'Medium' },
  { min: 0.2, color: '#6366f1', label: 'Low' },
  { min: 0, color: '#14b8a6', label: 'Minimal' },
]

function scoreColor(score) {
  for (const tier of SCORE_COLORS) {
    if (score >= tier.min) return tier
  }
  return SCORE_COLORS[SCORE_COLORS.length - 1]
}

function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return amount.toFixed(2)
}

export default function RelationshipPanel({
  report,
  connectedAddress,
  loading,
  onSelectAddress,
  onClose,
}) {
  const { labelMap } = useAddressLabels()
  const [activeTab, setActiveTab] = useState('relationships')
  const [selectedKey, setSelectedKey] = useState(null)

  const selectedRel = useMemo(() => {
    if (!selectedKey || !report) return null
    return report.relationships.find((r) => r.key === selectedKey) || null
  }, [selectedKey, report])

  const handleSelectRel = useCallback((rel) => {
    setSelectedKey(selectedKey === rel.key ? null : rel.key)
  }, [selectedKey])

  if (!report) {
    return (
      <div style={{
        width: '320px', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0d1520', borderLeft: '1px solid #1a2332',
        color: 'var(--text-muted)', fontSize: '12px',
      }}>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          {loading ? 'Analyzing relationships...' : 'No relationship data available.'}
        </div>
      </div>
    )
  }

  const { summary, relationships, clusters, rankedNodes } = report

  return (
    <div style={{
      width: '320px', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0d1520', borderLeft: '1px solid #1a2332',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid #1a2332',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <Network size={13} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Relationships
        </span>
        {onClose && (
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px',
        padding: '8px 12px', background: '#0a1018', borderBottom: '1px solid #1a2332',
      }}>
        <StatBox icon={<Activity size={10} />} label="Relationships" value={summary.totalRelationships} />
        <StatBox icon={<Zap size={10} />} label="High Volume" value={summary.highVolumeCount} />
        <StatBox icon={<Users size={10} />} label="Clusters" value={summary.clusterCount} />
        <StatBox icon={<Star size={10} />} label="Frequent" value={summary.frequentCounterparties} />
        <StatBox icon={<Layers size={10} />} label="Largest Cluster" value={summary.largestClusterSize} />
        <StatBox icon={<TrendingUp size={10} />} label="Total Addrs" value={summary.totalAddresses} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2332' }}>
        {[
          { id: 'relationships', label: 'Relationships', icon: <ArrowLeftRight size={11} /> },
          { id: 'addresses', label: 'Addresses', icon: <Users size={11} /> },
          { id: 'clusters', label: 'Clusters', icon: <Layers size={11} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedKey(null) }}
            style={{
              flex: 1, padding: '7px 4px', fontSize: '9px', fontWeight: activeTab === tab.id ? 600 : 400,
              border: 'none', background: activeTab === tab.id ? '#1a2332' : 'transparent',
              color: activeTab === tab.id ? 'var(--cyan)' : 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              transition: 'var(--transition)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'relationships' && (
          selectedRel ? <RelationshipDetail rel={selectedRel} onBack={() => setSelectedKey(null)} labelMap={labelMap} connectedAddress={connectedAddress} /> :
          relationships.length === 0 ? (
            <EmptyState message="No relationships found" />
          ) : (
            relationships.map((rel) => (
              <RelationshipRow
                key={rel.key}
                rel={rel}
                labelMap={labelMap}
                connectedAddress={connectedAddress}
                selected={selectedKey === rel.key}
                onClick={() => handleSelectRel(rel)}
                onSelectAddress={onSelectAddress}
              />
            ))
          )
        )}

        {activeTab === 'addresses' && (
          rankedNodes.length === 0 ? (
            <EmptyState message="No addresses found" />
          ) : (
            rankedNodes.map((node, i) => (
              <AddressRow
                key={node.address}
                node={node}
                rank={i + 1}
                labelMap={labelMap}
                onSelect={onSelectAddress}
              />
            ))
          )
        )}

        {activeTab === 'clusters' && (
          clusters.length === 0 ? (
            <EmptyState message="No clusters detected" />
          ) : (
            clusters.map((cluster, i) => (
                <ClusterRow
                  key={i}
                  cluster={cluster}
                  index={i}
                  labelMap={labelMap}
                  onSelectAddress={onSelectAddress}
                />
            ))
          )
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ icon, label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 2px' }}>
      <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '9px', marginBottom: '2px' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  )
}

function RelationshipRow({ rel, labelMap, connectedAddress, selected, onClick, onSelectAddress }) {
  const otherAddr = rel.addressA === connectedAddress ? rel.addressB : rel.addressA
  const otherLabel = labelMap[otherAddr]?.label || shortAddress(otherAddr)
  const c = scoreColor(rel.score)
  const dateStr = rel.lastSeen ? new Date(rel.lastSeen).toLocaleDateString() : ''

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px', borderBottom: '1px solid #111c2e', cursor: 'pointer',
        background: selected ? '#1a2332' : 'transparent',
        transition: 'var(--transition)',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#0f1a2a' }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: c.color, display: 'inline-block', flexShrink: 0,
            boxShadow: `0 0 4px ${c.color}`,
          }} />
          <span style={{
            fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {otherLabel}
          </span>
        </div>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: c.color, fontWeight: 600, flexShrink: 0 }}>
          {(rel.score * 100).toFixed(0)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', color: 'var(--text-muted)' }}>
        <span>{rel.txCount} tx</span>
        {rel.totalAmount > 0 && <span>{formatAmount(rel.totalAmount)} XLM</span>}
        {rel.isBidirectional && <span style={{ color: '#06b6d4' }}>↔</span>}
        <span style={{ flex: 1 }} />
        <span>{dateStr}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onSelectAddress?.(otherAddr) }}
          title="Go to address"
          style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
        >
          <ArrowUpRight size={9} />
        </button>
      </div>

      {selected && (
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #1a2332', fontSize: '10px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Frequency</span>
            <span style={{ color: 'var(--text-primary)' }}>{(rel.frequency * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Volume</span>
            <span style={{ color: 'var(--text-primary)' }}>{(rel.volume * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Recency</span>
            <span style={{ color: 'var(--text-primary)' }}>{(rel.recency * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>Directionality</span>
            <span style={{ color: 'var(--text-primary)' }}>{(rel.directionality * 100).toFixed(0)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Diversity</span>
            <span style={{ color: 'var(--text-primary)' }}>{(rel.diversity * 100).toFixed(0)}%</span>
          </div>
          {rel.types.length > 0 && (
            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
              {rel.types.map((t) => (
                <span key={t} style={{ padding: '1px 5px', fontSize: '8px', background: '#1a2332', borderRadius: '3px', color: 'var(--text-muted)' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RelationshipDetail({ rel, onBack, labelMap, connectedAddress }) {
  const otherAddr = rel.addressA === connectedAddress ? rel.addressB : rel.addressA
  const c = scoreColor(rel.score)

  return (
    <div style={{ padding: '12px' }}>
      <button onClick={onBack} style={{
        border: 'none', background: 'none', color: 'var(--cyan)', cursor: 'pointer',
        fontSize: '10px', padding: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.color, display: 'inline-block', boxShadow: `0 0 6px ${c.color}` }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {labelMap[otherAddr]?.label || shortAddress(otherAddr)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {otherAddr}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '24px', fontWeight: 700, color: c.color, fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
        {(rel.score * 100).toFixed(0)}
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
          / 100 {c.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center', padding: '6px 10px', background: '#1a2332', borderRadius: '4px', minWidth: '60px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>TX Count</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{rel.txCount}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 10px', background: '#1a2332', borderRadius: '4px', minWidth: '60px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Volume</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatAmount(rel.totalAmount)}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 10px', background: '#1a2332', borderRadius: '4px', minWidth: '60px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Types</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{rel.types.length}</div>
        </div>
      </div>

      <ScoreBar label="Frequency" value={rel.frequency} />
      <ScoreBar label="Volume" value={rel.volume} />
      <ScoreBar label="Recency" value={rel.recency} />
      <ScoreBar label="Directionality" value={rel.directionality} />
      <ScoreBar label="Diversity" value={rel.diversity} />
    </div>
  )
}

function ScoreBar({ label, value }) {
  const pct = (value * 100).toFixed(0)
  const color = scoreColor(value).color
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
        <span>{label}</span>
        <span style={{ color: 'var(--text-primary)' }}>{pct}%</span>
      </div>
      <div style={{ height: '4px', background: '#1a2332', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function AddressRow({ node, rank, labelMap, onSelect }) {
  const top3 = rank <= 3
  const label = labelMap[node.address]?.label
  return (
    <div
      style={{
        padding: '7px 12px', borderBottom: '1px solid #111c2e', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'var(--transition)',
      }}
      onClick={() => onSelect?.(node.address)}
      onMouseEnter={(e) => e.currentTarget.style.background = '#0f1a2a'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        width: '16px', fontSize: '10px', fontWeight: top3 ? 700 : 400,
        color: top3 ? '#f59e0b' : 'var(--text-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)',
      }}>
        {rank}
      </span>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
        background: node.isCentral ? '#06b6d4' : '#6366f1',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {node.isCentral ? 'Your Address' : (label || shortAddress(node.address))}
        </div>
        {!node.isCentral && (
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {shortAddress(node.address)} · {node.relationshipCount} rel · {node.totalTx} tx
          </div>
        )}
      </div>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#8b5cf6', fontWeight: 600 }}>
        {node.importance.toFixed(2)}
      </span>
    </div>
  )
}

function ClusterRow({ cluster, index, labelMap, connectedAddress, onSelectAddress }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid #111c2e' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '2px',
          background: `hsl(${index * 60}, 60%, 50%)`, display: 'inline-block',
        }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Cluster {index + 1}
        </span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {cluster.size} addresses · {cluster.edgeCount} edges
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
        {cluster.members.slice(0, 8).map((addr) => {
          const isCentral = addr === connectedAddress
          const lbl = labelMap[addr]?.label
          return (
            <button
              key={addr}
              onClick={() => onSelectAddress?.(addr)}
              style={{
                padding: '2px 6px', fontSize: '9px', fontFamily: 'var(--font-mono)',
                background: isCentral ? '#06b6d420' : '#1a2332',
                border: `1px solid ${isCentral ? '#06b6d440' : '#253040'}`,
                borderRadius: '3px', color: isCentral ? '#06b6d4' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'var(--transition)',
              }}
              title={addr}
            >
              {isCentral ? 'You' : (lbl || shortAddress(addr))}
            </button>
          )
        })}
        {cluster.members.length > 8 && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', padding: '2px 4px' }}>
            +{cluster.members.length - 8} more
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
      {message}
    </div>
  )
}
