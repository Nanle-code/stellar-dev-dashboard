import React, { useMemo } from 'react'
import { 
  Zap, 
  Layers, 
  Calculator, 
  PieChart, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Download
} from 'lucide-react'
import { calculateOperationFeeAttribution, formatFeeAttribution, type FeeAttributionReport } from '../../lib/feeAttribution'
import { useStore } from '../../lib/store'

const palette = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: 'var(--cyan)',
  muted: 'var(--text-muted)',
  primary: 'var(--text-primary)',
  bgCard: 'var(--bg-card)',
  border: 'var(--border)',
  elevated: 'var(--bg-elevated)',
}

function StatCard({ label, value, accent, icon: Icon }: { label: string; value: string; accent: string; icon: React.FC<any> }) {
  return (
    <div style={{
      background: palette.elevated,
      border: `1px solid ${palette.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Icon size={14} color={accent} />
        <span style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      </div>
      <div style={{ fontSize: '18px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: accent }}>
        {value}
      </div>
    </div>
  )
}

function OperationFeeRow({ 
  op, 
  index, 
  totalFee,
  expanded, 
  onToggle 
}: { 
  op: FeeAttributionReport['operations'][0]; 
  index: number; 
  totalFee: number;
  expanded: boolean; 
  onToggle: () => void 
}) {
  const percentage = totalFee > 0 ? ((op.estimatedFee / totalFee) * 100).toFixed(1) : '0'
  
  return (
    <div style={{ border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: palette.bgCard }}>
      <div 
        onClick={onToggle}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '12px 16px', 
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${palette.border}` : 'none',
        }}
      >
        <div style={{ width: '36px', textAlign: 'center', fontSize: '11px', color: palette.muted, fontFamily: 'var(--font-mono)' }}>
          #{index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', color: palette.primary }}>
            {op.operationType}
          </span>
          {op.sourceAccount && (
            <span style={{ fontSize: '10px', color: palette.muted, fontFamily: 'var(--font-mono)', background: palette.elevated, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${palette.border}` }}>
              {op.sourceAccount.slice(0, 8)}...
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', minWidth: '100px' }}>
            <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Fee</div>
            <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.primary }}>
              {op.estimatedFee.toLocaleString()} stroops
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: '70px' }}>
            <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>% of Total</div>
            <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.cyan }}>
              {percentage}%
            </div>
          </div>
          <div style={{ textAlign: 'right', minWidth: '60px' }}>
            <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weight</div>
            <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.muted }}>
              {op.feeBreakdown.operationWeight}x
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{ padding: '4px', color: palette.muted, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      
      {expanded && (
        <div style={{ padding: '16px', background: palette.elevated, display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Base Fee Per Op</div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.primary }}>
                {op.baseFee.toLocaleString()} stroops
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operation Weight</div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.cyan }}>
                {op.feeBreakdown.operationWeight}x
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Complexity Multiplier</div>
              <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.amber }}>
                {op.feeBreakdown.complexityMultiplier}x
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source Account</div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
                {op.sourceAccount || 'Transaction source'}
              </div>
            </div>
          </div>
          
          <div style={{ 
            height: '8px', 
            background: palette.border, 
            borderRadius: '4px', 
            overflow: 'hidden' 
          }}>
            <div style={{ 
              width: `${percentage}%`, 
              height: '100%', 
              background: `linear-gradient(90deg, ${palette.cyan}, ${palette.green})`,
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          
          <div style={{ 
            padding: '10px 12px', 
            background: palette.bgCard, 
            border: `1px solid ${palette.border}`, 
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: palette.muted,
            lineHeight: 1.6,
          }}>
            <strong style={{ color: palette.primary }}>Fee Calculation:</strong> 
            Base ({op.baseFee.toLocaleString()} stroops) × 
            Operation Weight ({op.feeBreakdown.operationWeight}x) × 
            Complexity ({op.feeBreakdown.complexityMultiplier}x) = 
            <strong style={{ color: palette.green }}>{op.estimatedFee.toLocaleString()} stroops</strong>
          </div>
        </div>
      )}
    </div>
  )
}

function FeeBumpSection({ feeBump }: { feeBump: FeeAttributionReport['feeBump'] }) {
  return (
    <div style={{ 
      marginTop: '16px',
      padding: '16px', 
      background: 'rgba(59, 130, 246, 0.1)', 
      border: `1px solid ${palette.cyan}33`, 
      borderRadius: 'var(--radius-md)' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Layers size={16} color={palette.cyan} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: palette.cyan }}>
          Fee-Bump Transaction Details
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fee Source</div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: palette.primary }}>
            {feeBump.feeSource}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fee-Bump Fee</div>
          <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.primary }}>
            {feeBump.baseFee.toLocaleString()} stroops
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inner Transaction Fee</div>
          <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.green }}>
            {feeBump.innerTransactionFee.toLocaleString()} stroops
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: palette.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Fee-Bump Cost</div>
          <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: palette.red }}>
            {(feeBump.baseFee + feeBump.innerTransactionFee).toLocaleString()} stroops
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeeAttributionBreakdown({ 
  operations, 
  baseFee = 100, 
  sourceAccount,
  network = 'testnet',
  memo,
  memoType
}: { 
  operations: Array<{ type: string; params: Record<string, unknown> }>
  baseFee?: number
  sourceAccount?: string
  network?: string
  memo?: string
  memoType?: string
}) {
  const { network: storeNetwork } = useStore()
  const activeNetwork = network || storeNetwork

  const report = useMemo(() => {
    if (operations.length === 0) return null
    return calculateOperationFeeAttribution({
      sourceAccount: sourceAccount || 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      operations,
      baseFee,
      network: activeNetwork,
      memo,
      memoType,
    })
  }, [operations, baseFee, sourceAccount, activeNetwork, memo, memoType])

  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set())

  if (!report) {
    return (
      <div style={{ background: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-lg)', padding: '32px', textAlign: 'center' }}>
        <Calculator size={48} color={palette.muted} style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: '14px', color: palette.muted }}>Add operations to see fee attribution breakdown</div>
      </div>
    )
  }

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>
        Operation Fee Attribution
      </div>
      <div style={{ fontSize: '13px', color: palette.muted, maxWidth: '700px' }}>
        Estimated fee contribution per operation type before submission. 
        Weights based on operation complexity and network resource usage.
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <StatCard
          label="Total Estimated Fee"
          value={`${report.totalFee.toLocaleString()} stroops (${(report.totalFee / 10_000_000).toFixed(7)} XLM)`}
          accent={palette.cyan}
          icon={Zap}
        />
        <StatCard
          label="Base Fee"
          value={`${report.baseFee} stroops/op`}
          accent={palette.muted}
          icon={Layers}
        />
        <StatCard
          label="Operations"
          value={report.operationCount.toString()}
          accent={palette.green}
          icon={Layers}
        />
        <StatCard
          label="Avg Per Operation"
          value={`${Math.round(report.totalFee / Math.max(1, report.operationCount)).toLocaleString()} stroops`}
          accent={palette.amber}
          icon={Calculator}
        />
      </div>

      {/* Operations Breakdown */}
      <div style={{ background: palette.bgCard, border: `1px solid ${palette.border}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${palette.border}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
          Per-Operation Breakdown ({report.operations.length})
        </div>
        <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
          {report.operations.map((op, index) => (
            <OperationFeeRow
              key={index}
              op={op}
              index={index}
              totalFee={report.totalFee}
              expanded={expandedItems.has(index)}
              onToggle={() => toggleExpand(index)}
            />
          ))}
        </div>
      </div>

      {/* Fee-Bump Section */}
      {report.feeBump && (
        <FeeBumpSection feeBump={report.feeBump} />
      )}

      {/* Export Options */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            navigator.clipboard.writeText(formatFeeAttribution(report))
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', fontSize: '12px', fontWeight: 600,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <Copy size={14} /> Copy Breakdown
        </button>
        <button
          onClick={() => {
            const blob = new Blob([formatFeeAttribution(report)], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `fee-attribution-${Date.now()}.txt`
            a.click()
            URL.revokeObjectURL(url)
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', fontSize: '12px', fontWeight: 600,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: 'pointer',
          }}
        >
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* Explanation */}
      <div style={{ 
        padding: '16px', 
        background: palette.elevated, 
        border: `1px solid ${palette.border}`, 
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        color: palette.muted,
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: palette.primary, marginBottom: '8px' }}>How Fee Attribution Works</div>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' }}>
          <li><strong>Base Fee:</strong> Minimum fee per operation (default 100 stroops)</li>
          <li><strong>Operation Weight:</strong> Complexity factor per operation type (e.g., contract calls = 2.0x, path payments = 1.5x)</li>
          <li><strong>Complexity Multiplier:</strong> Additional factor for operations with variable resource usage (e.g., Soroban calls = 2.5x)</li>
          <li><strong>Fee-Bump:</strong> If present, shows separate fee for the bump transaction and inner transaction</li>
          <li><strong>Note:</strong> These are estimates. Actual fees may vary based on network congestion and ledger state.</li>
        </ul>
      </div>
    </div>
  )
}

export default FeeAttributionBreakdown