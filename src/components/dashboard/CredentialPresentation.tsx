/**
 * Credential Presentation and Verification Component
 * Provides UI for presenting and verifying verifiable credentials
 */

import React, { useState, useCallback } from 'react'
import { Keypair } from '@stellar/stellar-sdk'
import {
  createPresentation,
  signPresentation,
  verifyPresentation,
  type Presentation,
  type VerifiableCredential,
} from '../../lib/verifiableCredentials'
import { resolveDID, type DIDDocument } from '../../lib/did'

interface CredentialPresentationProps {
  credentials: VerifiableCredential[]
  holderDID: string
  onPresentationCreated?: (presentation: Presentation) => void
}

export default function CredentialPresentation({
  credentials,
  holderDID,
  onPresentationCreated,
}: CredentialPresentationProps) {
  const [selectedCredentials, setSelectedCredentials] = useState<Set<string>>(new Set())
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean
    error?: string
  } | null>(null)
  const [challenge, setChallenge] = useState('')
  const [domain, setDomain] = useState('')

  const toggleCredential = (credentialId: string) => {
    const newSelected = new Set(selectedCredentials)
    if (newSelected.has(credentialId)) {
      newSelected.delete(credentialId)
    } else {
      newSelected.add(credentialId)
    }
    setSelectedCredentials(newSelected)
  }

  const handleCreatePresentation = useCallback(async () => {
    if (selectedCredentials.size === 0) return

    const selectedCreds = credentials.filter((cred) =>
      cred.id ? selectedCredentials.has(cred.id) : false
    )

    const presentationData = createPresentation(selectedCreds, {
      holder: holderDID,
    })

    setPresentation(presentationData as Presentation)
    onPresentationCreated?.(presentationData as Presentation)
  }, [credentials, selectedCredentials, holderDID, onPresentationCreated])

  const handleSignPresentation = useCallback(async () => {
    if (!presentation) return

    // Note: In a real implementation, you would use the wallet to sign
    // This is a placeholder for demonstration
    const keypair = Keypair.random()
    const verificationMethodId = `${holderDID}#key-1`

    const signed = signPresentation(
      presentation,
      keypair,
      verificationMethodId,
      challenge || undefined,
      domain || undefined
    )

    setPresentation(signed)
  }, [presentation, holderDID, challenge, domain])

  const handleVerifyPresentation = useCallback(async () => {
    if (!presentation) return

    setVerifying(true)
    setVerificationResult(null)

    try {
      // Resolve holder DID document
      const didResult = await resolveDID(holderDID)

      if (didResult.didResolutionMetadata.error) {
        setVerificationResult({
          valid: false,
          error: didResult.didResolutionMetadata.error as string,
        })
        return
      }

      const result = await verifyPresentation(
        presentation,
        didResult.didDocument,
        challenge || undefined
      )

      setVerificationResult(result)
    } catch (error) {
      setVerificationResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      })
    } finally {
      setVerifying(false)
    }
  }, [presentation, holderDID, challenge])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Credential Presentation
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Select credentials to include in a verifiable presentation
        </p>
      </div>

      {/* Credential Selection */}
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
          Select Credentials ({selectedCredentials.size})
        </h3>
        {credentials.length === 0 ? (
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            No credentials available
          </div>
        ) : (
          credentials.map((cred, index) => (
            <div
              key={cred.id || index}
              style={{
                padding: '12px',
                marginBottom: '8px',
                borderRadius: 'var(--radius-sm)',
                background: selectedCredentials.has(cred.id || `${index}`)
                  ? 'var(--bg-card)'
                  : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
              onClick={() => cred.id && toggleCredential(cred.id)}
            >
              <input
                type="checkbox"
                checked={cred.id ? selectedCredentials.has(cred.id) : false}
                onChange={() => cred.id && toggleCredential(cred.id)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                  {Array.isArray(cred.type) ? cred.type.join(', ') : cred.type}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Issuer: {cred.issuer}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Presentation Actions */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={handleCreatePresentation}
          disabled={selectedCredentials.size === 0}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cyan, #06b6d4)',
            border: 'none',
            color: '#0a0a0a',
            cursor: selectedCredentials.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: selectedCredentials.size > 0 ? 1 : 0.6,
          }}
        >
          Create Presentation
        </button>
        <button
          onClick={handleSignPresentation}
          disabled={!presentation}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            cursor: presentation ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: presentation ? 1 : 0.6,
          }}
        >
          Sign Presentation
        </button>
        <button
          onClick={handleVerifyPresentation}
          disabled={!presentation || !presentation.proof}
          style={{
            padding: '12px 24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            cursor: presentation && presentation.proof ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: presentation && presentation.proof ? 1 : 0.6,
          }}
        >
          Verify Presentation
        </button>
      </div>

      {/* Verification Options */}
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
          Verification Options
        </h3>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Challenge (optional)"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
          <input
            type="text"
            placeholder="Domain (optional)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <div
          style={{
            padding: '16px',
            marginBottom: '16px',
            borderRadius: 'var(--radius-md)',
            background: verificationResult.valid
              ? 'var(--green, #10b981)'
              : 'var(--bg-error)',
            border: verificationResult.valid
              ? '1px solid var(--green, #10b981)'
              : '1px solid var(--border-error)',
            color: verificationResult.valid ? '#0a0a0a' : 'var(--text-error)',
          }}
        >
          {verificationResult.valid ? (
            <div style={{ fontWeight: 500 }}>✓ Presentation is valid</div>
          ) : (
            <div>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                ✗ Presentation verification failed
              </div>
              <div style={{ fontSize: '14px' }}>{verificationResult.error}</div>
            </div>
          )}
        </div>
      )}

      {/* Presentation Display */}
      {presentation && (
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              Presentation {presentation.proof ? '(Signed)' : '(Unsigned)'}
            </h3>
            <button
              onClick={() => copyToClipboard(JSON.stringify(presentation, null, 2))}
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
            {JSON.stringify(presentation, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
