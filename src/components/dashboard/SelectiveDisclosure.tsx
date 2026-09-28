/**
 * Selective Disclosure Component
 * Provides UI for privacy-preserving selective disclosure of credential fields
 */

import React, { useState } from 'react'
import {
  createSelectiveDisclosure,
  supportsSelectiveDisclosure,
  type VerifiableCredential,
} from '../../lib/verifiableCredentials'

interface SelectiveDisclosureProps {
  credential: VerifiableCredential
  onDisclosureCreated?: (disclosedCredential: VerifiableCredential) => void
}

export default function SelectiveDisclosure({
  credential,
  onDisclosureCreated,
}: SelectiveDisclosureProps) {
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [disclosedCredential, setDisclosedCredential] = useState<VerifiableCredential | null>(null)

  const credentialSubject = Array.isArray(credential.credentialSubject)
    ? credential.credentialSubject[0]
    : credential.credentialSubject

  const availableFields = credentialSubject
    ? (Object.keys(credentialSubject).filter((key) => key !== 'id') as string[])
    : []

  const toggleField = (field: string) => {
    const newSelected = new Set(selectedFields)
    if (newSelected.has(field)) {
      newSelected.delete(field)
    } else {
      newSelected.add(field)
    }
    setSelectedFields(newSelected)
  }

  const handleCreateDisclosure = () => {
    if (!supportsSelectiveDisclosure(credential)) {
      alert('This credential does not support selective disclosure')
      return
    }

    const revealFields = Array.from(selectedFields)
    const hideFields = availableFields.filter((field) => !selectedFields.has(field))

    const disclosed = createSelectiveDisclosure(credential, {
      revealFields,
      hideFields,
    })

    setDisclosedCredential(disclosed)
    onDisclosureCreated?.(disclosed)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!supportsSelectiveDisclosure(credential)) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          This credential does not support selective disclosure
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Selective Disclosure
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Choose which fields to reveal from your credential. This allows you to share only the
          information you want while keeping the rest private.
        </p>
      </div>

      {/* Available Fields */}
      <div
        style={{
          padding: '20px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
          Select Fields to Reveal ({selectedFields.size}/{availableFields.length})
        </h3>
        {availableFields.length === 0 ? (
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            No fields available for disclosure
          </div>
        ) : (
          availableFields.map((field) => (
            <div
              key={field}
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: 'var(--radius-sm)',
                background: selectedFields.has(field)
                  ? 'var(--bg-card)'
                  : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
              onClick={() => toggleField(field)}
            >
              <input
                type="checkbox"
                checked={selectedFields.has(field)}
                onChange={() => toggleField(field)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{field}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {String((credentialSubject as any)?.[field] || 'N/A')}
                </div>
              </div>
              {selectedFields.has(field) && (
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--green, #10b981)',
                    color: '#0a0a0a',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  Reveal
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={handleCreateDisclosure}
          disabled={selectedFields.size === 0}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cyan, #06b6d4)',
            border: 'none',
            color: '#0a0a0a',
            cursor: selectedFields.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: selectedFields.size > 0 ? 1 : 0.6,
          }}
        >
          Create Disclosure
        </button>
        <button
          onClick={() => setSelectedFields(new Set())}
          disabled={selectedFields.size === 0}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            cursor: selectedFields.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: selectedFields.size > 0 ? 1 : 0.6,
          }}
        >
          Clear Selection
        </button>
      </div>

      {/* Privacy Notice */}
      <div
        style={{
          padding: '16px',
          marginBottom: '16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Privacy Notice:</strong> Selective
        disclosure allows you to share only specific fields from your credential. Hidden fields will
        not be included in the disclosed credential. Note: In a production implementation, this
        would use cryptographic zero-knowledge proofs to ensure the hidden fields exist without
        revealing their values.
      </div>

      {/* Disclosed Credential */}
      {disclosedCredential && (
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Disclosed Credential</h3>
            <button
              onClick={() => copyToClipboard(JSON.stringify(disclosedCredential, null, 2))}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Copy JSON
            </button>
          </div>
          <pre
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '400px',
            }}
          >
            {JSON.stringify(disclosedCredential, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
