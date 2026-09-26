import React, { useState } from 'react'
import { buildDeploymentConfig, buildTemplateSource } from '../../lib/templateManager'
import { useStore } from '../../lib/store'
import { downloadScaffold } from '../../lib/contractDevelopment'
import TemplateCustomizer from './TemplateCustomizer'

export default function TemplateDeployer({ template, onClose }) {
  const { network, connectedAddress } = useStore()
  const [args, setArgs] = useState({})
  const [deployed, setDeployed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('configure')

  const config = buildDeploymentConfig(template, network, connectedAddress || '', args)
  const source = buildTemplateSource(template)

  const handleDeploy = async () => {
    setLoading(true)
    // Simulate deployment (real deployment would use ContractDeployer)
    await new Promise((r) => setTimeout(r, 1200))
    setLoading(false)
    setDeployed(true)
  }

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '6px 14px',
        background: activeTab === id ? 'var(--cyan-glow)' : 'transparent',
        border: `1px solid ${activeTab === id ? 'var(--cyan-dim)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: activeTab === id ? 'var(--cyan)' : 'var(--text-secondary)',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px' }}>
            Deploy: {template.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {template.description}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px' }}>
        <Tab id="configure" label="Configure" />
        <Tab id="source" label="Source Preview" />
        <Tab id="plan" label="Deploy Plan" />
      </div>

      <div style={{ padding: '18px' }}>
        {activeTab === 'configure' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TemplateCustomizer template={template} onArgsChange={setArgs} />

            {deployed ? (
              <div style={{
                padding: '12px 16px',
                background: 'var(--green-glow)',
                border: '1px solid var(--green)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--green)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                ✓ Template deployed successfully on {network}
              </div>
            ) : (
              <button
                onClick={handleDeploy}
                disabled={loading || network === 'mainnet'}
                style={{
                  padding: '10px 20px',
                  background: loading ? 'var(--bg-elevated)' : 'var(--cyan)',
                  color: loading ? 'var(--text-muted)' : 'var(--bg-base)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: loading || network === 'mainnet' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {loading && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
                {loading ? 'Deploying...' : network === 'mainnet' ? 'Testnet Only' : '🚀 One-Click Deploy'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'source' && (
          <pre style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            overflowX: 'auto',
            lineHeight: 1.6,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {source}
          </pre>
        )}

        {activeTab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Estimated fee: <span style={{ color: 'var(--amber)' }}>{config.estimatedFee} stroops</span>
            </div>
            {config.steps.map((step, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}>
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--cyan-glow)',
                  border: '1px solid var(--cyan-dim)',
                  color: 'var(--cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
      {template && (
  <div style={{
    marginTop: '16px',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface)',
  }}>
    <h4 style={{ fontSize: '12px', color: 'var(--cyan)', margin: '0 0 8px 0' }}>
      📥 Quick Downloads
    </h4>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button
        onClick={() => downloadScaffold(template.id)}
        style={{
          padding: '4px 10px',
          fontSize: '10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        ⬇ Spec + README
      </button>
      <a
        href="https://developers.stellar.org/docs/smart-contracts"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '4px 10px',
          fontSize: '10px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--cyan)',
          textDecoration: 'none',
        }}
      >
        📖 Stellar Docs
      </a>
    </div>
  </div>
)}
    </div>
  )
}
