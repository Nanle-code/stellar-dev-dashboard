import React, { useState, useEffect, useCallback } from 'react'
import {
  getProposals, createProposal, castVote, getVotes, getVoterVote,
  getProposalResult, addComment, getComments, delegate, revokeDelegation,
  getDelegations, getGovernanceAnalytics, cancelProposal,
  subscribeGovernance, exportGovernanceData,
  type Proposal, type VoteChoice, type ProposalStatus,
} from '../../lib/governance'
import { useStore } from '../../lib/store'

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: 'var(--text-muted)',
  active: 'var(--cyan)',
  passed: 'var(--green)',
  rejected: 'var(--red)',
  cancelled: 'var(--amber)',
  executed: 'var(--purple)',
}

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: '3px',
      color: STATUS_COLORS[status],
      border: `1px solid ${STATUS_COLORS[status]}`,
      background: `${STATUS_COLORS[status]}18`,
      letterSpacing: '0.06em',
    }}>
      {status}
    </span>
  )
}

function VoteBar({ forPct, againstPct, abstainPct }: { forPct: number; againstPct: number; abstainPct: number }) {
  return (
    <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', background: 'var(--bg-elevated)' }}>
      <div style={{ width: `${forPct}%`, background: 'var(--green)', transition: 'width 0.4s ease' }} />
      <div style={{ width: `${abstainPct}%`, background: 'var(--amber)', transition: 'width 0.4s ease' }} />
      <div style={{ width: `${againstPct}%`, background: 'var(--red)', transition: 'width 0.4s ease' }} />
    </div>
  )
}

function ProposalCard({ proposal, onSelect }: { proposal: Proposal; onSelect: (p: Proposal) => void }) {
  const result = getProposalResult(proposal.id)
  const timeLeft = proposal.endAt - Date.now()
  const daysLeft = Math.max(0, Math.floor(timeLeft / 86_400_000))
  const hoursLeft = Math.max(0, Math.floor((timeLeft % 86_400_000) / 3_600_000))

  return (
    <div
      onClick={() => onSelect(proposal)}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer',
        transition: 'var(--transition)',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', flex: 1 }}>{proposal.title}</div>
        <StatusBadge status={proposal.status} />
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {proposal.description.slice(0, 140)}{proposal.description.length > 140 ? '…' : ''}
      </div>
      {result && (
        <>
          <VoteBar forPct={result.forPct} againstPct={result.againstPct} abstainPct={result.abstainPct} />
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
            <span style={{ color: 'var(--green)' }}>For {result.forPct.toFixed(1)}%</span>
            <span style={{ color: 'var(--red)' }}>Against {result.againstPct.toFixed(1)}%</span>
            <span style={{ color: 'var(--text-muted)' }}>{result.totalVotes} votes</span>
          </div>
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>{proposal.category}</span>
        {proposal.status === 'active' && (
          <span>{daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft}h left</span>
        )}
      </div>
    </div>
  )
}

function ProposalDetail({ proposal, voter, onBack }: { proposal: Proposal; voter: string; onBack: () => void }) {
  const result = getProposalResult(proposal.id)
  const existingVote = getVoterVote(proposal.id, voter)
  const comments = getComments(proposal.id)
  const [commentBody, setCommentBody] = useState('')
  const [casting, setCasting] = useState(false)
  const [delegateAddr, setDelegateAddr] = useState('')
  const [reason, setReason] = useState('')

  const handleVote = async (choice: VoteChoice) => {
    if (!voter || casting) return
    setCasting(true)
    await castVote(proposal.id, voter, choice, 1, reason)
    setCasting(false)
  }

  const handleComment = () => {
    if (!commentBody.trim() || !voter) return
    addComment(proposal.id, voter, commentBody.trim())
    setCommentBody('')
  }

  const handleDelegate = () => {
    if (!delegateAddr.trim() || !voter) return
    try {
      delegate(voter, delegateAddr.trim(), proposal.id)
      setDelegateAddr('')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delegation failed')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontSize: '13px' }}>
        ← Back to proposals
      </button>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, flex: 1 }}>{proposal.title}</div>
          <StatusBadge status={proposal.status} />
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          by {proposal.creator.slice(0, 12)}… · {proposal.category} · Quorum {proposal.quorumPct}% · Pass {proposal.passPct}%
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{proposal.description}</div>
      </div>

      {result && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>Current Results</div>
          <VoteBar forPct={result.forPct} againstPct={result.againstPct} abstainPct={result.abstainPct} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px', textAlign: 'center' }}>
            {[['For', result.forPct, 'var(--green)'], ['Against', result.againstPct, 'var(--red)'], ['Abstain', result.abstainPct, 'var(--amber)']].map(([label, pct, color]) => (
              <div key={String(label)} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '8px' }}>
                <div style={{ color: color as string, fontWeight: 700, fontSize: '16px' }}>{(pct as number).toFixed(1)}%</div>
                <div style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {result.totalVotes} total votes · Quorum {result.quorumReached ? '✓ reached' : '✗ not reached'}
          </div>
        </div>
      )}

      {proposal.status === 'active' && !existingVote && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px' }}>Cast Your Vote</div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason…" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['for', 'against', 'abstain'] as VoteChoice[]).map(choice => (
              <button key={choice} onClick={() => handleVote(choice)} disabled={casting} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${choice === 'for' ? 'var(--green)' : choice === 'against' ? 'var(--red)' : 'var(--amber)'}`, background: `${choice === 'for' ? 'var(--green)' : choice === 'against' ? 'var(--red)' : 'var(--amber)'}18`, color: choice === 'for' ? 'var(--green)' : choice === 'against' ? 'var(--red)' : 'var(--amber)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
                {choice}
              </button>
            ))}
          </div>
        </div>
      )}

      {existingVote && (
        <div style={{ padding: '12px', background: 'var(--cyan-glow)', border: '1px solid var(--cyan-dim)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--cyan)' }}>
          ✓ You voted <strong>{existingVote.choice}</strong>{existingVote.reason ? ` — "${existingVote.reason}"` : ''}
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>Delegate Your Vote</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={delegateAddr} onChange={e => setDelegateAddr(e.target.value)} placeholder="Delegate address G…" style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)' }} />
          <button onClick={handleDelegate} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', cursor: 'pointer' }}>Delegate</button>
          <button onClick={() => revokeDelegation(voter, proposal.id)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Revoke</button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>Discussion ({comments.length})</div>
        {comments.map(c => (
          <div key={c.id} style={{ padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{c.author.slice(0, 12)}… · {new Date(c.createdAt).toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.body}</div>
          </div>
        ))}
        {voter && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Add a comment…" rows={2} style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', resize: 'vertical' }} />
            <button onClick={handleComment} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-start' }}>Post</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateProposalForm({ creator, onCreated, onCancel }: { creator: string; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('protocol')
  const [quorumPct, setQuorumPct] = useState(20)
  const [passPct, setPassPct] = useState(51)
  const [durationDays, setDurationDays] = useState(7)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (!description.trim()) { setError('Description is required'); return }
    const now = Date.now()
    createProposal({
      title: title.trim(), description: description.trim(), category, creator,
      votingMode: 'equal_weight', quorumPct, passPct,
      startAt: now, endAt: now + durationDays * 86_400_000,
    })
    onCreated()
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px' }}>Create Proposal</div>
      {error && <div style={{ padding: '8px 12px', background: 'rgba(255,0,0,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--red)' }}>{error}</div>}
      {[
        { label: 'Title', el: <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Proposal title" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', width: '100%' }} /> },
        { label: 'Category', el: <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', width: '100%' }}>{['protocol', 'treasury', 'governance', 'technical', 'community'].map(c => <option key={c} value={c}>{c}</option>)}</select> },
        { label: 'Description', el: <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Detailed description of the proposal…" style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px', width: '100%', resize: 'vertical' }} /> },
      ].map(({ label, el }) => (
        <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
          {el}
        </label>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Quorum %', value: quorumPct, onChange: setQuorumPct, min: 0, max: 100 },
          { label: 'Pass threshold %', value: passPct, onChange: setPassPct, min: 51, max: 100 },
          { label: 'Duration (days)', value: durationDays, onChange: setDurationDays, min: 1, max: 90 },
        ].map(({ label, value, onChange, min, max }) => (
          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
            <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max} style={{ padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={handleSubmit} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Submit Proposal</button>
      </div>
    </div>
  )
}

export default function Governance() {
  const { connectedAddress } = useStore()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [selected, setSelected] = useState<Proposal | null>(null)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all')
  const [analytics, setAnalytics] = useState(getGovernanceAnalytics())
  const [activeTab, setActiveTab] = useState<'proposals' | 'analytics'>('proposals')

  const refresh = useCallback(() => {
    const filter = statusFilter !== 'all' ? { status: statusFilter as ProposalStatus } : undefined
    setProposals(getProposals(filter))
    setAnalytics(getGovernanceAnalytics())
  }, [statusFilter])

  useEffect(() => {
    refresh()
    const unsubs = [
      subscribeGovernance('proposals', refresh),
      subscribeGovernance('votes', refresh),
      subscribeGovernance('comments', refresh),
    ]
    return () => unsubs.forEach(u => u())
  }, [refresh])

  if (!connectedAddress) {
    return <div className="animate-in" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Connect an account to participate in governance</div>
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Governance</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>On-chain voting, proposals, and decentralized decision-making</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { const d = exportGovernanceData(); const a = document.createElement('a'); a.href = `data:application/json,${encodeURIComponent(d)}`; a.download = 'governance-export.json'; a.click() }} style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Export</button>
          {!creating && !selected && <button onClick={() => setCreating(true)} style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--cyan-dim)', background: 'var(--cyan-glow)', color: 'var(--cyan)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>+ Create Proposal</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
        {(['proposals', 'analytics'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '2px solid transparent', color: activeTab === tab ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {[
            { label: 'Total Proposals', value: analytics.totalProposals },
            { label: 'Active', value: analytics.activeProposals, accent: 'var(--cyan)' },
            { label: 'Passed', value: analytics.passedProposals, accent: 'var(--green)' },
            { label: 'Rejected', value: analytics.rejectedProposals, accent: 'var(--red)' },
            { label: 'Total Votes Cast', value: analytics.totalVotes },
            { label: 'Avg Participation', value: `${analytics.averageParticipation} votes` },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: accent ?? 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>Top Voters</div>
            {analytics.topVoters.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No votes recorded yet</div> : analytics.topVoters.map((v, i) => (
              <div key={v.address} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>#{i + 1} {v.address.slice(0, 14)}…</span>
                <span style={{ color: 'var(--cyan)' }}>{v.voteCount} votes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'proposals' && (
        <>
          {creating && (
            <CreateProposalForm creator={connectedAddress} onCreated={() => { setCreating(false); refresh() }} onCancel={() => setCreating(false)} />
          )}
          {selected ? (
            <ProposalDetail proposal={selected} voter={connectedAddress} onBack={() => setSelected(null)} />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['all', 'active', 'passed', 'rejected', 'draft'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${statusFilter === s ? 'var(--cyan)' : 'var(--border)'}`, background: statusFilter === s ? 'var(--cyan-glow)' : 'var(--bg-elevated)', color: statusFilter === s ? 'var(--cyan)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{s}</button>
                ))}
              </div>
              {proposals.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                  No proposals found. Create the first one!
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {proposals.map(p => <ProposalCard key={p.id} proposal={p} onSelect={setSelected} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
