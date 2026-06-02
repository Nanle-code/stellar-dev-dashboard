import React from 'react'
import { useStore } from '../../lib/store'
import { getNetworkDetails } from '../../lib/stellar'

export default function NetworkIndicator({ compact = false }) {
  const { network } = useStore()
  const details = getNetworkDetails(network)

  const colorMap = {
    mainnet: 'var(--green)',
    testnet: 'var(--yellow, #f59e0b)',
    futurenet: 'var(--cyan)',
    local: 'var(--purple, #8b5cf6)',
    custom: 'var(--blue, #0ea5e9)',
  }

  const bg = colorMap[network] || 'var(--text-muted)'

  return (
    <div
      aria-hidden="true"
      title={details.name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '6px' : '8px',
        padding: compact ? '6px' : '8px',
        borderRadius: '999px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: bg, display: 'inline-block' }} />
      <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>{details.name}</span>
    </div>
  )
}
