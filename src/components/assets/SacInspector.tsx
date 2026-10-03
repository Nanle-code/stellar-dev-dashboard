import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { NETWORKS, type NetworkName } from '../../lib/stellar'
import { inspectSac, submitSacDeployment, type SacAsset, type SacInspection } from '../../lib/sac'
import { signTransactionWithFreighter } from '../../lib/wallet/freighter'
import { getAssetUrl, getContractUrl } from '../../lib/externalExplorers'

interface SacInspectorProps { asset: SacAsset; network: NetworkName }

export default function SacInspector({ asset, network }: SacInspectorProps) {
  const connectedAddress = useStore((state) => state.connectedAddress)
  const walletType = useStore((state) => state.walletType)
  const [inspection, setInspection] = useState<SacInspection | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setMessage('')
    void inspectSac(asset, network).then((result) => { if (active) setInspection(result) })
    return () => { active = false }
  }, [asset.code, asset.issuer, asset.asset_type, network])

  if (!inspection) return <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Inspecting SAC…</div>

  const deploy = async () => {
    if (!connectedAddress) return setMessage('Connect a wallet before deploying a SAC.')
    if (walletType !== 'freighter') return setMessage('SAC deployment currently requires a connected Freighter wallet.')
    if (network === 'mainnet' && !window.confirm('Deploy this SAC on Stellar Mainnet? This is an irreversible network transaction.')) return
    try {
      setBusy(true)
      const result = await submitSacDeployment(asset, connectedAddress, network, signTransactionWithFreighter)
      setMessage(`Submitted ${result.hash.slice(0, 12)}…`)
      setInspection(await inspectSac(asset, network))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'SAC deployment failed.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <strong>Stellar Asset Contract</strong>
        <span style={{ color: inspection.deployed ? 'var(--green)' : 'var(--amber)', fontSize: 11 }}>
          {inspection.deployed ? 'Deployed' : 'Not deployed'}
        </span>
      </div>
      <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, wordBreak: 'break-all' }}>{inspection.contractId}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }}>
        <a href={getContractUrl('stellarExpert', network, inspection.contractId)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Open SAC ↗</a>
        {asset.issuer && asset.code && <a href={getAssetUrl('stellarExpert', network, asset.code, asset.issuer)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Open classic asset ↗</a>}
      </div>
      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
        <span>Name: {inspection.metadata.name || '—'}</span>
        <span>Symbol: {inspection.metadata.symbol || '—'}</span>
        <span>Decimals: {inspection.metadata.decimals ?? '—'}</span>
        <span>Admin: {inspection.metadata.admin ? `${inspection.metadata.admin.slice(0, 5)}…` : '—'}</span>
      </div>
      {!inspection.deployed && (
        <button type="button" onClick={() => void deploy()} disabled={busy} style={{ marginTop: 10, padding: '7px 10px', border: '1px solid var(--cyan)', borderRadius: 4, background: 'var(--cyan-glow)', color: 'var(--cyan)', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Deploying…' : `Deploy on ${NETWORKS[network].name}`}
        </button>
      )}
      {message && <div role="status" style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 11 }}>{message}</div>}
      {inspection.error && !inspection.deployed && <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 10 }}>Status query: {inspection.error}</div>}
    </div>
  )
}
