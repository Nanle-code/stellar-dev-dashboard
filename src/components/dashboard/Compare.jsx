import React from 'react'
import { useStore } from '../../lib/store'
import { fetchAccount, isValidPublicKey, shortAddress, formatXLM } from '../../lib/stellar'
import { Copy, Search, Trash2 } from 'lucide-react'

export default function Compare() {
    const {
        network,
        comparisonKeys, setComparisonKey,
        comparisonData, setComparisonData,
        comparisonLoading, setComparisonLoading,
        comparisonErrors, setComparisonError
    } = useStore()

    const handleFetch = async () => {
        const promises = comparisonKeys.map(async (key, index) => {
            if (!key) {
                setComparisonData(index, null)
                setComparisonError(index, null)
                return
            }

            if (!isValidPublicKey(key)) {
                setComparisonError(index, 'Invalid public key')
                setComparisonData(index, null)
                return
            }

            setComparisonLoading(index, true)
            setComparisonError(index, null)

            try {
                const data = await fetchAccount(key, network)
                setComparisonData(index, data)
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

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700 }}>Compare Accounts</div>
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
                <button
                    onClick={handleFetch}
                    disabled={comparisonKeys.every(k => !k)}
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
                        boxShadow: '0 0 15px var(--cyan-glow)'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Search size={16} />
                    Compare All
                </button>
            </div>

            {/* Input section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'var(--transition)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', fontWeight: 600 }}>ACCOUNT {i + 1}</span>
                            {comparisonKeys[i] && (
                                <button
                                    onClick={() => {
                                        setComparisonKey(i, '')
                                        setComparisonData(i, null)
                                        setComparisonError(i, null)
                                    }}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Enter public key..."
                            value={comparisonKeys[i]}
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
                    </div>
                ))}
            </div>

            {/* Comparison Table */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '18px', color: 'var(--text-muted)', fontWeight: 600, width: '180px', fontSize: '11px', letterSpacing: '1px' }}>METRIC</th>
                                {[0, 1, 2].map(i => (
                                    <th key={i} style={{ padding: '18px', borderLeft: '1px solid var(--border)', minWidth: '240px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ color: comparisonKeys[i] ? 'var(--cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                                {comparisonKeys[i] ? shortAddress(comparisonKeys[i], 6) : `Empty Slot ${i + 1}`}
                                            </span>
                                            {comparisonKeys[i] && (
                                                <button
                                                    onClick={() => copyToClipboard(comparisonKeys[i])}
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
                            {[
                                { label: 'Status', key: 'status' },
                                { label: 'XLM Balance', key: 'balance' },
                                { label: 'Assets', key: 'assets' },
                                { label: 'Sequence', key: 'sequence' },
                                { label: 'Subentries', key: 'subentries' },
                            ].map((row, rowIndex) => (
                                <tr key={row.key} style={{
                                    borderBottom: rowIndex < 4 ? '1px solid var(--border)' : 'none',
                                    transition: 'var(--transition)'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '16px 18px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        {row.label}
                                    </td>
                                    {[0, 1, 2].map(i => {
                                        const data = comparisonData[i]
                                        const loading = comparisonLoading[i]
                                        const error = comparisonErrors[i]

                                        let content = <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
                                        if (loading) content = <div className="spinner" />
                                        else if (error) content = <span style={{ color: 'var(--red)', fontSize: '11px' }}>{error}</span>
                                        else if (data) {
                                            if (row.key === 'status') {
                                                content = <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} className="pulse" />
                                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Active</span>
                                                </div>
                                            } else if (row.key === 'balance') {
                                                const bal = data.balances.find(b => b.asset_type === 'native')?.balance
                                                content = <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: '15px', fontWeight: 700 }}>
                                                    {bal ? formatXLM(bal) : '0'} <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>XLM</span>
                                                </span>
                                            } else if (row.key === 'assets') {
                                                const otherAssets = data.balances.filter(b => b.asset_type !== 'native')
                                                content = <span style={{ color: otherAssets.length > 0 ? 'var(--amber)' : 'var(--text-primary)' }}>{otherAssets.length} assets</span>
                                            } else if (row.key === 'sequence') {
                                                content = <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{data.sequence}</span>
                                            } else if (row.key === 'subentries') {
                                                content = <span style={{ fontWeight: 500 }}>{data.subentry_count}</span>
                                            }
                                        }

                                        return (
                                            <td key={i} style={{ padding: '16px 18px', borderLeft: '1px solid var(--border)' }}>
                                                {content}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
