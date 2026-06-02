import React from 'react'
import { useStore } from '../../lib/store'
import { useResponsive } from '../../hooks/useResponsive'
import { fetchAccount, fetchAccountOffers, isValidPublicKey, resolveAddress, shortAddress, formatXLM } from '../../lib/stellar'
import { Copy, Search, Trash2, Plus, Download, ArrowUpDown } from 'lucide-react'
import ComparisonChart from './ComparisonChart'

const COMPARISON_METRICS = [
    { label: 'Status', key: 'status' },
    { label: 'XLM Balance', key: 'balance' },
    { label: 'Assets', key: 'assets' },
    { label: 'Active Orders', key: 'orders' },
    { label: 'Sequence', key: 'sequence' },
    { label: 'Subentries', key: 'subentries' },
    { label: 'Signers', key: 'signers' },
]

export default function AccountComparison() {
    const {
        network,
        comparisonSlots, 
        addComparisonSlot, 
        removeComparisonSlot,
        reorderComparisonSlots,
        setComparisonKey, 
        setComparisonData, 
        setComparisonLoading, 
        setComparisonError
    } = useStore()
    const { isMobile } = useResponsive()

    const handleFetch = async () => {
        const promises = comparisonSlots.map(async (slot, index) => {
            // Trim whitespace
            const input = slot.key?.trim()
            if (!input) {
                setComparisonData(index, null)
                setComparisonError(index, null)
                return
            }

            if (!isValidPublicKey(input)) {
                setComparisonError(index, 'Invalid address format')
                setComparisonData(index, null)
                return
            }

            setComparisonLoading(index, true)
            setComparisonError(index, null)

            try {
                // Resolve the address (handles G, M, and federated formats)
                const resolved = await resolveAddress(input, network)
                
                if (!resolved) {
                    setComparisonError(index, 'Failed to resolve address')
                    setComparisonData(index, null)
                    setComparisonLoading(index, false)
                    return
                }

                // Use the master account for fetching data
                const [data, offers] = await Promise.all([
                    fetchAccount(resolved.accountId, network),
                    fetchAccountOffers(resolved.accountId, network).catch(() => []) // Fallback to empty if error
                ])
                
                // Store the resolved info with the account data
                setComparisonData(index, { 
                    ...data, 
                    offers,
                    _muxedId: resolved.muxedId,
                    _federatedAddress: resolved.federatedAddress,
                    _originalInput: input,
                })
            } catch (err) {
                setComparisonError(index, err.message || 'Account not found')
                setComparisonData(index, null)
            } finally {
                setComparisonLoading(index, false)
            }
        })

        await Promise.allSettled(promises)
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
    }

    const exportToCSV = () => {
        const rows = []
        const headers = ['Metric', ...comparisonSlots.map((s, i) => s.key || `Slot_${i+1}`)]
        rows.push(headers.join(','))

        const metrics = [
            { label: 'Status', key: 'status' },
            { label: 'XLM Balance', key: 'balance' },
            { label: 'Assets', key: 'assets' },
            { label: 'Active Orders', key: 'orders' },
            { label: 'Sequence', key: 'sequence' },
            { label: 'Subentries', key: 'subentries' },
            { label: 'Signers', key: 'signers' }
        ]

        metrics.forEach(row => {
            const rowData = [row.label]
            comparisonSlots.forEach(slot => {
                let cellVal = '—'
                if (slot.data) {
                    if (row.key === 'status') cellVal = 'Active'
                    if (row.key === 'balance') cellVal = slot.data.balances.find(b => b.asset_type === 'native')?.balance || '0'
                    if (row.key === 'assets') cellVal = String(slot.data.balances.filter(b => b.asset_type !== 'native').length)
                    if (row.key === 'orders') cellVal = String(slot.data.offers?.length || 0)
                    if (row.key === 'sequence') cellVal = slot.data.sequence
                    if (row.key === 'subentries') cellVal = String(slot.data.subentry_count)
                    if (row.key === 'signers') cellVal = String(slot.data.signers?.length || 1)
                } else if (slot.error) {
                    cellVal = 'Error'
                }
                rowData.push(cellVal)
            })
            rows.push(rowData.join(','))
        })

        const csvContent = "data:text/csv;charset=utf-8," + rows.join("\n")
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `stellar_comparison_${network}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const sortSlots = (metric) => {
        const sorted = [...comparisonSlots].sort((a, b) => {
            if (!a.data && !b.data) return 0
            if (!a.data) return 1
            if (!b.data) return -1

            let valA = 0, valB = 0
            if (metric === 'balance') {
                valA = parseFloat(a.data.balances.find(b => b.asset_type === 'native')?.balance || '0')
                valB = parseFloat(b.data.balances.find(b => b.asset_type === 'native')?.balance || '0')
            } else if (metric === 'orders') {
                valA = a.data.offers?.length || 0
                valB = b.data.offers?.length || 0
            } else if (metric === 'assets') {
                valA = a.data.balances.filter(b => b.asset_type !== 'native').length
                valB = b.data.balances.filter(b => b.asset_type !== 'native').length
            }
            return valB - valA // descending
        })
        reorderComparisonSlots(sorted) // atomic swap — preserves all data
    }

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Account Comparison</div>
                    <div style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'var(--cyan-glow)',
                        border: '1px solid var(--cyan-dim)',
                        fontSize: '11px',
                        color: 'var(--cyan)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Multi-View
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {comparisonSlots.some(s => s.data) && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select 
                                onChange={(e) => sortSlots(e.target.value)}
                                defaultValue=""
                                style={{
                                    padding: '8px 12px',
                                    paddingRight: '32px',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    outline: 'none',
                                    fontWeight: 600
                                }}
                            >
                                <option value="" disabled>Sort Accounts By...</option>
                                <option value="balance">Highest XLM Balance</option>
                                <option value="orders">Most Active Orders</option>
                                <option value="assets">Most Tokens Asssets</option>
                            </select>
                            <ArrowUpDown size={12} style={{ position: 'absolute', right: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        </div>
                    )}
                    <button
                        onClick={exportToCSV}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'var(--transition)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                        <Download size={14} />
                        Export CSV
                    </button>

                    <button
                        onClick={handleFetch}
                        disabled={comparisonSlots.every(s => !s.key)}
                        style={{
                            padding: '8px 20px',
                            background: 'var(--cyan)',
                            color: '#080c10',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'var(--transition)',
                            boxShadow: '0 0 15px var(--cyan-glow)',
                            opacity: comparisonSlots.every(s => !s.key) ? 0.5 : 1
                        }}
                    >
                        <Search size={16} />
                        Compare All
                    </button>
                </div>
            </div>

            {/* Input grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(comparisonSlots.length + 1, 4)}, 1fr)`, gap: '16px' }}>
                {comparisonSlots.map((slot, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        position: 'relative',
                        transition: 'var(--transition)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 600 }}>ACCOUNT {i + 1}</span>
                            {comparisonSlots.length > 2 && (
                                <button
                                    onClick={() => removeComparisonSlot(i)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="G..."
                            value={slot.key}
                            onChange={(e) => setComparisonKey(i, e.target.value)}
                            style={{
                                width: '100%',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                padding: '12px',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontFamily: 'var(--font-mono)',
                                outline: 'none',
                                transition: 'var(--transition)'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--cyan-dim)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                        {/* Error Indicator inside card */}
                        {slot.error && (
                            <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '-4px' }}>{slot.error}</div>
                        )}
                        {slot.loading && (
                            <div style={{ fontSize: '11px', color: 'var(--cyan)', marginTop: '-4px' }}>Loading...</div>
                        )}
                    </div>
                ))}

                {comparisonSlots.length < 5 && (
                    <button
                        onClick={addComparisonSlot}
                        style={{
                            background: 'transparent',
                            border: '1px dashed var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            minHeight: '100px',
                            transition: 'var(--transition)'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                    >
                        <Plus size={24} />
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Add Account</span>
                    </button>
                )}
            </div>

            {/* Visual Charts */}
            <ComparisonChart comparisonSlots={comparisonSlots} />

            {/* Comparison Table */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
            }}>
                {isMobile ? (
                    <div style={{ display: 'grid', gap: '16px', padding: '18px' }}>
                        {comparisonSlots.map((slot, i) => {
                            const data = slot.data
                            const loading = slot.loading
                            const error = slot.error

                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        padding: '16px',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        background: 'var(--bg-elevated)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                                Slot {i + 1}
                                            </div>
                                            <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: slot.key && !slot.error ? 'var(--cyan)' : 'var(--text-primary)' }}>
                                                {slot.key ? shortAddress(slot.key, 6) : 'Enter an account to compare'}
                                            </div>
                                        </div>
                                        {slot.key && !slot.error && (
                                            <button
                                                onClick={() => copyToClipboard(slot.key)}
                                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px 10px', fontSize: '12px' }}
                                                onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                title="Copy full address"
                                            >
                                                <Copy size={14} /> Copy
                                            </button>
                                        )}
                                    </div>

                                    {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}
                                    {loading && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>}

                                    {data ? (
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            {COMPARISON_METRICS.map((row) => {
                                                const content = renderComparisonCell(slot, row)
                                                return (
                                                    <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>{row.label}</span>
                                                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', textAlign: 'right', minWidth: '80px' }}>{content}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : !loading && !error ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Enter an account address to compare metrics here.</div>
                                    ) : null}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '18px', color: 'var(--text-muted)', fontWeight: 600, width: '150px', fontSize: '11px', letterSpacing: '1px' }}>METRIC</th>
                                    {comparisonSlots.map((slot, i) => (
                                        <th key={i} style={{ padding: '18px', borderLeft: '1px solid var(--border)', minWidth: '200px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ color: slot.key && !slot.error ? 'var(--cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                                    {slot.key ? shortAddress(slot.key, 6) : `Slot ${i + 1}`}
                                                </span>
                                                {slot.key && !slot.error && (
                                                    <button
                                                        onClick={() => copyToClipboard(slot.key)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex', transition: 'var(--transition)' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                        title="Copy full address"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {COMPARISON_METRICS.slice(0, 6).map((row, rowIndex) => (
                                    <tr key={row.key} style={{
                                        borderBottom: rowIndex < 5 ? '1px solid var(--border)' : 'none',
                                        transition: 'var(--transition)'
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '16px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            {row.label}
                                        </td>
                                        {comparisonSlots.map((slot, i) => (
                                            <td key={i} style={{ padding: '16px 18px', borderLeft: '1px solid var(--border)' }}>
                                                {renderComparisonCell(slot, row)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

function renderComparisonCell(slot, row) {
    const data = slot.data
    const loading = slot.loading
    const error = slot.error

    if (loading) return <div className="spinner" />
    if (error) return <span style={{ color: 'var(--red)', fontSize: '11px' }}>Error</span>
    if (!data) return <span style={{ color: 'var(--text-muted)', opacity: 0.7 }}>—</span>

    if (row.key === 'status') {
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--green)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} className="pulse" />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Active</span>
        </span>
    }

    if (row.key === 'balance') {
        const balStr = data.balances.find(b => b.asset_type === 'native')?.balance || '0'
        return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: '15px', fontWeight: 700 }}>
            {formatXLM(balStr)} <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>XLM</span>
        </span>
    }

    if (row.key === 'assets') {
        const otherAssets = data.balances.filter(b => b.asset_type !== 'native')
        return <span style={{ color: otherAssets.length > 0 ? 'var(--amber)' : 'var(--text-primary)' }}>{otherAssets.length} assets</span>
    }

    if (row.key === 'orders') {
        const ordersCount = data.offers?.length || 0
        return <span style={{ color: ordersCount > 0 ? 'var(--purple, #b388ff)' : 'var(--text-secondary)', fontWeight: ordersCount > 0 ? 600 : 400 }}>{ordersCount} orders</span>
    }

    if (row.key === 'sequence') {
        return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{data.sequence}</span>
    }

    if (row.key === 'subentries') {
        return <span style={{ fontWeight: 500 }}>{data.subentry_count}</span>
    }

    if (row.key === 'signers') {
        return <span style={{ fontWeight: 500 }}>{String(data.signers?.length || 1)}</span>
    }

    return <span style={{ color: 'var(--text-muted)' }}>—</span>
}
