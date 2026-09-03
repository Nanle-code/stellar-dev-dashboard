import React, { useState } from 'react'
import { getAllTemplates } from '../../lib/templateManager'
import { getContractTemplates, downloadScaffold } from '../../lib/contractDevelopment'
import {
  clearCachedUserTransactionTemplates,
  deleteUserTransactionTemplate,
  exportUserTemplatesEncryptedFile,
  getCachedUserTransactionTemplates,
  importUserTemplatesEncryptedFile,
  loadUserTransactionTemplates,
} from '../../lib/transactionTemplateVault.ts'
import TemplateCard from './TemplateCard'
import TemplateDeployer from './TemplateDeployer'

const CATEGORIES = ['all', 'token', 'escrow', 'governance', 'nft', 'scaffold']

export default function TemplateLibrary() {
  const templates = getAllTemplates()
  const contractTemplates = getContractTemplates()
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('all')
  const [scaffoldDownloaded, setScaffoldDownloaded] = useState(null)
  const [templatePassphrase, setTemplatePassphrase] = useState('')
  const [vaultStatus, setVaultStatus] = useState({ unlocked: false, count: 0, error: '' })
  const [importMode, setImportMode] = useState('replace')

  const filtered = filter === 'all'
    ? templates
    : filter === 'scaffold'
      ? [] // Scaffold section is separate
      : templates.filter((t) => t.category === filter)

  const unlockedUserTemplates = getCachedUserTransactionTemplates()

  const handleScaffoldDownload = (templateId) => {
    try {
      const bundle = downloadScaffold(templateId)
      setScaffoldDownloaded(templateId)
      setTimeout(() => setScaffoldDownloaded(null), 2000)
    } catch (err) {
      console.error('Scaffold download failed:', err)
    }
  }

  const unlockTemplateVault = async () => {
    setVaultStatus({ unlocked: false, count: 0, error: '' })
    if (!templatePassphrase) {
      setVaultStatus({ unlocked: false, count: 0, error: 'Enter a password to unlock templates.' })
      return
    }
    try {
      const templates = await loadUserTransactionTemplates(templatePassphrase)
      setVaultStatus({ unlocked: true, count: templates.length, error: '' })
    } catch (e) {
      setVaultStatus({ unlocked: false, count: 0, error: e?.message || 'Failed to unlock template vault.' })
    }
  }

  const lockTemplateVault = () => {
    clearCachedUserTransactionTemplates()
    setVaultStatus({ unlocked: false, count: 0, error: '' })
  }

  const downloadEncryptedExport = async () => {
    setVaultStatus((s) => ({ ...s, error: '' }))
    if (!templatePassphrase) {
      setVaultStatus((s) => ({ ...s, error: 'Enter a password to export templates.' }))
      return
    }
    try {
      const { file, filename } = await exportUserTemplatesEncryptedFile(templatePassphrase)
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setVaultStatus((s) => ({ ...s, error: e?.message || 'Export failed.' }))
    }
  }

  const onImportFilePicked = async (file) => {
    setVaultStatus((s) => ({ ...s, error: '' }))
    if (!templatePassphrase) {
      setVaultStatus((s) => ({ ...s, error: 'Enter a password to import templates.' }))
      return
    }
    try {
      const text = await file.text()
      await importUserTemplatesEncryptedFile(templatePassphrase, text, { mode: importMode })
      const templates = await loadUserTransactionTemplates(templatePassphrase)
      setVaultStatus({ unlocked: true, count: templates.length, error: '' })
    } catch (e) {
      setVaultStatus((s) => ({ ...s, error: e?.message || 'Import failed.' }))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Transaction Template Vault (Encrypted) */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        backgroundColor: 'var(--surface)',
      }}>
        <h3 style={{
          fontSize: '14px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--cyan)',
          margin: '0 0 12px 0',
        }}>
          🔐 Transaction Templates (Encrypted Backup)
        </h3>
        <p style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          margin: '0 0 14px 0',
        }}>
          Unlock your locally saved transaction templates using a password, then export/import an encrypted template pack.
          Nothing is stored in plaintext in IndexedDB.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="password"
            value={templatePassphrase}
            onChange={(e) => setTemplatePassphrase(e.target.value)}
            placeholder="Password (not stored)"
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
            }}
          />
          <button
            onClick={unlockTemplateVault}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Unlock
          </button>
          <button
            onClick={lockTemplateVault}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Lock
          </button>
          <button
            onClick={downloadEncryptedExport}
            disabled={!vaultStatus.unlocked}
            style={{
              padding: '8px 12px',
              background: vaultStatus.unlocked ? 'var(--cyan-glow)' : 'transparent',
              border: `1px solid ${vaultStatus.unlocked ? 'var(--cyan)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: vaultStatus.unlocked ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '11px',
              cursor: vaultStatus.unlocked ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Export Encrypted
          </button>
          <label style={{
            padding: '8px 12px',
            background: vaultStatus.unlocked ? 'var(--bg-elevated)' : 'transparent',
            border: `1px solid ${vaultStatus.unlocked ? 'var(--border-bright)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: vaultStatus.unlocked ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '11px',
            cursor: vaultStatus.unlocked ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono)',
          }}>
            Import…
            <input
              type="file"
              accept="application/json"
              disabled={!vaultStatus.unlocked}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImportFilePicked(file)
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />
          </label>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value)}
            disabled={!vaultStatus.unlocked}
            style={{
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
            }}
          >
            <option value="replace">Replace</option>
            <option value="merge">Merge</option>
          </select>
        </div>

        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Status: {vaultStatus.unlocked ? `Unlocked (${vaultStatus.count} templates)` : 'Locked'}
          {vaultStatus.error && (
            <span style={{ color: 'var(--red)', marginLeft: '10px' }}>{vaultStatus.error}</span>
          )}
        </div>

        {vaultStatus.unlocked && unlockedUserTemplates.length > 0 && (
          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {unlockedUserTemplates.map((tpl) => (
              <div key={tpl.id} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                background: 'var(--bg-elevated)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {tpl.label}
                </div>
                {tpl.description && (
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    {tpl.description}
                  </div>
                )}
                <button
                  onClick={async () => {
                    try {
                      await deleteUserTransactionTemplate(templatePassphrase, tpl.id)
                      const templates = await loadUserTransactionTemplates(templatePassphrase)
                      setVaultStatus({ unlocked: true, count: templates.length, error: '' })
                    } catch (e) {
                      setVaultStatus((s) => ({ ...s, error: e?.message || 'Delete failed.' }))
                    }
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '6px 10px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: '5px 12px',
              background: filter === cat ? 'var(--cyan-glow)' : 'transparent',
              border: `1px solid ${filter === cat ? 'var(--cyan-dim)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              color: filter === cat ? 'var(--cyan)' : 'var(--text-secondary)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {(filter !== 'scaffold') && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px',
        }}>
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selected?.id === template.id}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      {/* Scaffold Section */}
      {(filter === 'all' || filter === 'scaffold') && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          backgroundColor: 'var(--surface)',
        }}>
          <h3 style={{
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--cyan)',
            margin: '0 0 12px 0',
          }}>
            📦 Contract Scaffolds
          </h3>
          <p style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            margin: '0 0 16px 0',
          }}>
            Download starter spec + README for token, escrow, and oracle patterns.
            Real contracts require a full Rust build with Soroban SDK.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '10px',
          }}>
            {contractTemplates.map((template) => (
              <div
                key={template.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text)' }}>
                  {template.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', flex: 1 }}>
                  {template.description}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '9px',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-hover)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleScaffoldDownload(template.id)}
                  style={{
                    padding: '6px 12px',
                    background: scaffoldDownloaded === template.id ? 'var(--cyan-glow)' : 'transparent',
                    border: `1px solid ${scaffoldDownloaded === template.id ? 'var(--cyan)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: scaffoldDownloaded === template.id ? 'var(--cyan)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {scaffoldDownloaded === template.id ? '✓ Downloaded' : 'Download Scaffold'}
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', fontSize: '10px', color: 'var(--text-secondary)' }}>
            <a
              href="https://developers.stellar.org/docs/smart-contracts"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--cyan)', textDecoration: 'none' }}
            >
              📖 Stellar Smart Contract Docs →
            </a>
          </div>
        </div>
      )}

      {/* Deployer panel */}
      {selected && (
        <TemplateDeployer
          template={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
