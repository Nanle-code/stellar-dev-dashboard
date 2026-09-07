import React, { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import {
  fetchClaimableBalances,
  fetchClaimableBalanceById,
  formatClaimPredicate,
  explainClaimPredicate,
  buildClaimPredicate,
  isValidPublicKey,
} from '../../lib/stellar'
import type { ClaimableBalanceRecord, PredicateExplanation } from '../../lib/stellar'
import { simulateTransaction } from '../../lib/transactionBuilder'
import type { SimulateResult } from '../../lib/stellar'
import CopyableValue from './CopyableValue'

interface ClaimStateResult extends SimulateResult {
  minFee?: string
}

interface RowProps {
  label: string
  value?: React.ReactNode
  mono?: boolean
  accent?: string
  copyValue?: string
}

function shortId(id: string): string {
  return id ? `${id.slice(0, 10)}…${id.slice(-6)}` : '—'
}

function Row({ label, value, mono = true, accent, copyValue }: RowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>{label}</span>
      {copyValue ? (
        <CopyableValue value={copyValue} textStyle={{ fontSize: '12px', color: accent || 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>
          {value ?? '—'}
        </CopyableValue>
      ) : (
        <span style={{ fontSize: '12px', color: accent || 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

function claimableBadge(claimableNow: boolean | null) {
  if (claimableNow === true) {
    return <span style={{ fontSize: '10px', color: 'var(--green)', background: 'var(--green-glow, rgba(0,200,100,0.12))', padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--green, #2ecc71)' }}>claimable now</span>
  }
  if (claimableNow === false) {
    return <span style={{ fontSize: '10px', color: 'var(--red)', background: 'var(--red-glow, rgba(255,80,80,0.12))', padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--red, #e74c3c)' }}>not yet</span>
  }
  return <span style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>unknown</span>
}

function PredicateTree({ explanation, depth = 0 }: { explanation: PredicateExplanation; depth?: number }) {
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 12, paddingLeft: depth === 0 ? 0 : 10, borderLeft: depth === 0 ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{explanation.summary}</span>
        {claimableBadge(explanation.claimableNow)}
      </div>
      {explanation.children?.map((child, i) => (
        <PredicateTree key={i} explanation={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ─── Create form ───────────────────────────────────────────────────────────────

interface ClaimantDraft {
  destination: string
  predicateMode: 'unconditional' | 'before' | 'after' | 'relative' | 'advanced'
  before?: string
  after?: string
  relativeSeconds?: string
  advanced?: string
}

function defaultClaimant(): ClaimantDraft {
  return { destination: '', predicateMode: 'unconditional' }
}

function buildPredicateFromDraft(draft: ClaimantDraft): Record<string, unknown> {
  switch (draft.predicateMode) {
    case 'unconditional':
      return buildClaimPredicate({ type: 'unconditional' })
    case 'before':
      return buildClaimPredicate({ type: 'before', date: draft.before || '' })
    case 'after':
      return buildClaimPredicate({ type: 'after', date: draft.after || '' })
    case 'relative':
      return buildClaimPredicate({ type: 'relative', seconds: Number(draft.relativeSeconds) || 0 })
    case 'advanced': {
      const parsed = JSON.parse(draft.advanced || '{}')
      if (!parsed || typeof parsed !== 'object') throw new TypeError('Advanced predicate must be a JSON object')
      return parsed
    }
  }
  return {} as Record<string, unknown>
}

// ─── Workspace ─────────────────────────────────────────────────────────────────

type View = 'list' | 'inspect' | 'create'

export default function ClaimableBalances() {
  const { connectedAddress, network } = useStore()
  const [view, setView] = useState<View>('list')

  const [balances, setBalances] = useState<ClaimableBalanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimState, setClaimState] = useState<Record<string, { loading?: boolean; result?: ClaimStateResult | null; error?: string | null }>>({})

  // Inspect view state
  const [inspect, setInspect] = useState<ClaimableBalanceRecord | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)

  // Create view state
  const [assetType, setAssetType] = useState<'native' | 'custom'>('native')
  const [assetCode, setAssetCode] = useState('')
  const [assetIssuer, setAssetIssuer] = useState('')
  const [amount, setAmount] = useState('')
  const [claimants, setClaimants] = useState<ClaimantDraft[]>([defaultClaimant()])
  const [createLoading, setCreateLoading] = useState(false)
  const [createErrors, setCreateErrors] = useState<string[]>([])
  const [createResult, setCreateResult] = useState<ClaimStateResult | null>(null)

  useEffect(() => {
    if (!connectedAddress || !isValidPublicKey(connectedAddress)) {
      setBalances([])
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    fetchClaimableBalances(connectedAddress, network)
      .then((records) => { if (active) setBalances(records) })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [connectedAddress, network])

  async function handleSimulateClaim(balanceId: string) {
    setClaimState((prev) => ({ ...prev, [balanceId]: { loading: true, result: null, error: null } }))
    try {
      const result = await simulateTransaction({
        sourceAccount: connectedAddress,
        operations: [{ type: 'claimClaimableBalance', params: { balanceId } }],
        network,
      })
      setClaimState((prev) => ({ ...prev, [balanceId]: { loading: false, result, error: null } }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setClaimState((prev) => ({ ...prev, [balanceId]: { loading: false, result: null, error: message } }))
    }
  }

  async function handleInspect(balanceId: string) {
    setView('inspect')
    setInspect(null)
    setInspectLoading(true)
    setInspectError(null)
    try {
      const record = await fetchClaimableBalanceById(balanceId, network)
      setInspect(record)
    } catch (err: unknown) {
      setInspectError(err instanceof Error ? err.message : String(err))
    } finally {
      setInspectLoading(false)
    }
  }

  function updateClaimant(index: number, patch: Partial<ClaimantDraft>) {
    setClaimants((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function resetCreate() {
    setAssetType('native')
    setAssetCode('')
    setAssetIssuer('')
    setAmount('')
    setClaimants([defaultClaimant()])
    setCreateErrors([])
    setCreateResult(null)
  }

  async function handleCreate() {
    setCreateLoading(true)
    setCreateErrors([])
    setCreateResult(null)

    const errors: string[] = []
    const parsedAmount = parseFloat(amount)
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push('Amount must be a positive number')
    }
    if (assetType === 'custom') {
      if (!assetCode.trim()) errors.push('Asset code is required for custom assets')
      else if (assetCode.trim().length > 12) errors.push('Asset code must be 12 characters or fewer')
      if (!isValidPublicKey(assetIssuer)) errors.push('Asset issuer must be a valid Stellar public key')
    }
    if (claimants.length === 0) {
      errors.push('At least one claimant is required')
    }

    const builtClaimants: Array<{ destination: string; predicate: Record<string, unknown> }> = []
    claimants.forEach((draft, i) => {
      if (!isValidPublicKey(draft.destination)) {
        errors.push(`Claimant ${i + 1}: destination is not a valid Stellar public key`)
        return
      }
      try {
        const predicate = buildPredicateFromDraft(draft)
        builtClaimants.push({ destination: draft.destination, predicate })
      } catch (err) {
        errors.push(`Claimant ${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })

    if (errors.length > 0) {
      setCreateErrors(errors)
      setCreateLoading(false)
      return
    }

    try {
      const result = await simulateTransaction({
        sourceAccount: connectedAddress,
        operations: [
          {
            type: 'createClaimableBalance',
            params: {
              assetType,
              assetCode: assetType === 'custom' ? assetCode.trim() : undefined,
              assetIssuer: assetType === 'custom' ? assetIssuer.trim() : undefined,
              amount: String(parsedAmount),
              claimants: builtClaimants,
            },
          },
        ],
        network,
      })
      if (!result.success) {
        setCreateErrors(result.errors.length ? result.errors : ['Transaction simulation failed'])
        setCreateLoading(false)
        return
      }
      setCreateResult(result)
    } catch (err: unknown) {
      setCreateErrors([err instanceof Error ? err.message : String(err)])
    } finally {
      setCreateLoading(false)
    }
  }

  if (!connectedAddress) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Connect an account to use the claimable balance workspace.
      </div>
    )
  }

  // ── Inspect view ──────────────────────────────────────────────────────────
  if (view === 'inspect') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setView('list')} style={tabButton(false)}>← Back</button>
          <div style={headingStyle}>Inspect Claimable Balance</div>
        </div>

        {inspectLoading && <div style={muted}>Loading balance…</div>}
        {inspectError && <div style={errorBox}>{inspectError}</div>}

        {inspect && (
          <div style={card}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CopyableValue value={inspect.id} textStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{shortId(inspect.id)}</CopyableValue>
              <span style={assetBadge}>{inspect.asset}</span>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Row label="Amount" value={`${parseFloat(inspect.amount).toLocaleString()} ${inspect.asset.split(':')[0]}`} accent="var(--cyan)" />
              <Row label="Sponsor" value={inspect.sponsor} mono copyValue={inspect.sponsor} />
              <Row label="Ledger" value={inspect.last_modified_ledger} />
            </div>

            <div style={{ padding: '0 18px 18px' }}>
              <div style={sectionLabel}>Claimants &amp; predicate explanations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                {inspect.claimants.map((c, i) => {
                  const explanation = explainClaimPredicate(c.predicate)
                  return (
                    <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                        <CopyableValue value={c.destination} textStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{`${c.destination.slice(0, 8)}…${c.destination.slice(-6)}`}</CopyableValue>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{formatClaimPredicate(c.predicate)}</span>
                      </div>
                      <PredicateTree explanation={explanation} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Create view ───────────────────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setView('list')} style={tabButton(false)}>← Back</button>
          <div style={headingStyle}>Create Claimable Balance</div>
        </div>

        <div style={card}>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label style={fieldLabel}>
                Asset
                <select value={assetType} onChange={(e) => setAssetType(e.target.value as 'native' | 'custom')} style={inputStyle}>
                  <option value="native">Native (XLM)</option>
                  <option value="custom">Custom asset</option>
                </select>
              </label>
              {assetType === 'custom' && (
                <>
                  <label style={fieldLabel}>
                    Asset code
                    <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} placeholder="USDC" style={inputStyle} />
                  </label>
                  <label style={fieldLabel}>
                    Asset issuer
                    <input value={assetIssuer} onChange={(e) => setAssetIssuer(e.target.value)} placeholder="G…" style={inputStyle} />
                  </label>
                </>
              )}
              <label style={fieldLabel}>
                Amount
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10.5" style={inputStyle} />
              </label>
            </div>

            <div>
              <div style={sectionLabel}>Claimants</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                {claimants.map((draft, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        value={draft.destination}
                        onChange={(e) => updateClaimant(i, { destination: e.target.value })}
                        placeholder="Claimant public key (G…)"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      {claimants.length > 1 && (
                        <button onClick={() => setClaimants((prev) => prev.filter((_, idx) => idx !== i))} style={tabButton(false)}>Remove</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={fieldLabel}>
                        Predicate
                        <select value={draft.predicateMode} onChange={(e) => updateClaimant(i, { predicateMode: e.target.value as ClaimantDraft['predicateMode'] })} style={inputStyle}>
                          <option value="unconditional">Unconditional</option>
                          <option value="before">Before (absolute)</option>
                          <option value="after">After (absolute)</option>
                          <option value="relative">Relative (seconds)</option>
                          <option value="advanced">Advanced (JSON)</option>
                        </select>
                      </label>
                      {draft.predicateMode === 'before' && (
                        <label style={fieldLabel}>Date/time<input type="datetime-local" value={draft.before || ''} onChange={(e) => updateClaimant(i, { before: e.target.value })} style={inputStyle} /></label>
                      )}
                      {draft.predicateMode === 'after' && (
                        <label style={fieldLabel}>Date/time<input type="datetime-local" value={draft.after || ''} onChange={(e) => updateClaimant(i, { after: e.target.value })} style={inputStyle} /></label>
                      )}
                      {draft.predicateMode === 'relative' && (
                        <label style={fieldLabel}>Seconds<input type="number" min="1" value={draft.relativeSeconds || ''} onChange={(e) => updateClaimant(i, { relativeSeconds: e.target.value })} placeholder="86400" style={inputStyle} /></label>
                      )}
                      {draft.predicateMode === 'advanced' && (
                        <label style={fieldLabel}>Predicate JSON<textarea value={draft.advanced || ''} onChange={(e) => updateClaimant(i, { advanced: e.target.value })} placeholder='{ "abs_before": "2030-01-01T00:00:00Z" }' style={{ ...inputStyle, minWidth: '260px', minHeight: '48px' }} /></label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setClaimants((prev) => [...prev, defaultClaimant()])} style={{ ...tabButton(false), marginTop: '10px', alignSelf: 'flex-start' }}>+ Add claimant</button>
            </div>

            {createErrors.length > 0 && (
              <div style={errorBox}>
                {createErrors.map((e, i) => <div key={i}>✗ {e}</div>)}
              </div>
            )}
            {createResult && (
              <div style={{ ...errorBox, borderColor: 'var(--green)', color: 'var(--green)', background: 'var(--green-glow, rgba(0,200,100,0.08))' }}>
                ✓ Simulation OK — fee ~{createResult.fee} stroops, {createResult.operationCount} op(s)
                {createResult.xdr && (
                  <div style={{ marginTop: '6px' }}>
                    <CopyableValue value={createResult.xdr} textStyle={{ fontFamily: 'var(--font-mono)', fontSize: '10px', wordBreak: 'break-all' }}>XDR ready to sign</CopyableValue>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleCreate} disabled={createLoading} style={primaryButton(createLoading)}>
                {createLoading ? 'Building…' : 'Build & Simulate'}
              </button>
              <button onClick={resetCreate} style={tabButton(false)}>Reset</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Simulation is a dry-run that validates the operation and computes the fee. Submitting requires signing the returned XDR with the recipient/source account.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List view (default) ─────────────────────────────────────────────────────
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={headingStyle}>Claimable Balance Workspace</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            List, inspect, create, and claim balances with predicate explanations.
          </div>
        </div>
        <button onClick={() => { resetCreate(); setView('create') }} style={primaryButton(false)}>+ Create balance</button>
      </div>

      {loading && <div style={muted}>Loading…</div>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && balances.length === 0 && (
        <div style={emptyBox}>No claimable balances found for this account.</div>
      )}

      {balances.map((bal) => {
        const myClaimant = bal.claimants.find((c) => c.destination === connectedAddress)
        const state = claimState[bal.id] || {}
        return (
          <div key={bal.id} style={card}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CopyableValue value={bal.id} textStyle={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{shortId(bal.id)}</CopyableValue>
              <span style={assetBadge}>{bal.asset}</span>
            </div>

            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Row label="Amount" value={`${parseFloat(bal.amount).toLocaleString()} ${bal.asset.split(':')[0]}`} accent="var(--cyan)" />
              <Row label="Sponsor" value={bal.sponsor} mono copyValue={bal.sponsor} />
              <Row label="Ledger" value={bal.last_modified_ledger} />
              {myClaimant && (
                <Row label="Your Predicate" value={formatClaimPredicate(myClaimant.predicate)} mono={false} />
              )}
            </div>

            {bal.claimants.length > 1 && (
              <details style={{ padding: '0 18px 14px' }}>
                <summary style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                  {bal.claimants.length} claimants
                </summary>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {bal.claimants.map((c, i) => (
                    <div key={i} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <CopyableValue value={c.destination}>{c.destination.slice(0, 8)}…{c.destination.slice(-6)}</CopyableValue>
                      <span style={{ color: 'var(--text-muted)' }}>{formatClaimPredicate(c.predicate)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => handleInspect(bal.id)} style={tabButton(false)}>Inspect</button>
              <button
                onClick={() => handleSimulateClaim(bal.id)}
                disabled={state.loading}
                style={primaryButton(Boolean(state.loading))}
              >
                {state.loading ? 'Simulating…' : 'Simulate Claim'}
              </button>

              {state.result && (
                <span style={{ fontSize: '11px', color: 'var(--green)' }}>
                  ✓ Simulation OK — fee ~{state.result.fee ?? state.result.minFee ?? '?'} stroops
                </span>
              )}
              {state.error && (
                <span style={{ fontSize: '11px', color: 'var(--red)' }}>✗ {state.error}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '22px',
  fontWeight: 700,
}
const card: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
}
const muted: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '13px' }
const emptyBox: React.CSSProperties = {
  color: 'var(--text-muted)', fontSize: '13px', padding: '24px', textAlign: 'center',
  background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
}
const errorBox: React.CSSProperties = {
  color: 'var(--red)', fontSize: '13px', padding: '12px', background: 'var(--bg-card)',
  borderRadius: 'var(--radius-md)', border: '1px solid var(--red)',
}
const assetBadge: React.CSSProperties = {
  fontSize: '11px', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', background: 'var(--cyan-glow)',
  padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)',
}
const sectionLabel: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px',
}
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }
const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input, #111)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '13px', fontFamily: 'var(--font-mono)', textTransform: 'none', letterSpacing: 'normal',
}
function tabButton(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: active ? 'var(--cyan-glow)' : 'transparent', color: active ? 'var(--cyan)' : 'var(--text-secondary)',
    fontSize: '12px', fontFamily: 'var(--font-mono)', cursor: 'pointer',
  }
}
function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)',
    background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', fontFamily: 'var(--font-mono)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  }
}
