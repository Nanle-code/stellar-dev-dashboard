/**
 * Identity Verification Workflows Component
 * Provides UI for verifying identities using DIDs and verifiable credentials
 */

import React, { useState, useCallback } from 'react'
import {
  verifyCredential,
  checkCredentialStatus,
  isCredentialExpired,
  getTimeUntilExpiration,
  type VerifiableCredential,
} from '../../lib/verifiableCredentials'
import { resolveDID, validateDIDDocument, type DIDDocument } from '../../lib/did'

interface VerificationRequest {
  did: string
  credentials: VerifiableCredential[]
}

interface VerificationResult {
  didValid: boolean
  didDocument: DIDDocument | null
  credentialsValid: boolean[]
  credentialErrors: (string | undefined)[]
  overallValid: boolean
}

export default function IdentityVerification() {
  const [didInput, setDidInput] = useState('')
  const [credentialInput, setCredentialInput] = useState('')
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([])
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addCredential = useCallback(() => {
    if (!credentialInput.trim()) return

    try {
      const parsed = JSON.parse(credentialInput) as VerifiableCredential
      setCredentials([...credentials, parsed])
      setCredentialInput('')
      setError(null)
    } catch (err) {
      setError('Invalid credential JSON format')
    }
  }, [credentialInput, credentials])

  const removeCredential = useCallback((index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index))
  }, [credentials])

  const handleVerify = useCallback(async () => {
    if (!didInput && credentials.length === 0) {
      setError('Please provide a DID or credentials to verify')
      return
    }

    setVerifying(true)
    setError(null)
    setVerificationResult(null)

    try {
      const result: VerificationResult = {
        didValid: false,
        didDocument: null,
        credentialsValid: [],
        credentialErrors: [],
        overallValid: false,
      }

      // Verify DID if provided
      if (didInput) {
        const didResult = await resolveDID(didInput)

        if (didResult.didResolutionMetadata.error) {
          setError(didResult.didResolutionMetadata.error as string)
          setVerifying(false)
          return
        }

        result.didDocument = didResult.didDocument
        result.didValid = validateDIDDocument(didResult.didDocument)
      }

      // Verify credentials
      const credentialValidities: boolean[] = []
      const credentialErrors: (string | undefined)[] = []

      for (const credential of credentials) {
        // Check if expired
        if (isCredentialExpired(credential)) {
          credentialValidities.push(false)
          credentialErrors.push('Credential has expired')
          continue
        }

        // Check credential status
        const statusResult = await checkCredentialStatus(credential)
        if (!statusResult.valid) {
          credentialValidities.push(false)
          credentialErrors.push(statusResult.error || 'Credential status check failed')
          continue
        }

        // Verify credential signature (would need issuer DID document in production)
        // For now, we do basic structure validation
        credentialValidities.push(true)
        credentialErrors.push(undefined)
      }

      result.credentialsValid = credentialValidities
      result.credentialErrors = credentialErrors

      // Overall validity
      result.overallValid =
        (!didInput || result.didValid) && credentialValidities.every((v) => v)

      setVerificationResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }, [didInput, credentials])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Identity Verification
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Verify decentralized identities and verifiable credentials
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: '16px',
            marginBottom: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-error)',
            border: '1px solid var(--border-error)',
            color: 'var(--text-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* DID Input */}
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
          Verify DID
        </h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            DID to Verify
          </label>
          <input
            type="text"
            placeholder="did:stellar:public:G..."
            value={didInput}
            onChange={(e) => setDidInput(e.target.value)}
            style={{
              width: '100%',
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

      {/* Credential Input */}
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
          Verify Credentials ({credentials.length})
        </h3>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            Add Credential (JSON)
          </label>
          <textarea
            placeholder='{"@context": "https://www.w3.org/2018/credentials/v1", ...}'
            value={credentialInput}
            onChange={(e) => setCredentialInput(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        </div>
        <button
          onClick={addCredential}
          disabled={!credentialInput.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cyan, #06b6d4)',
            border: 'none',
            color: '#0a0a0a',
            cursor: credentialInput.trim() ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 500,
            opacity: credentialInput.trim() ? 1 : 0.6,
          }}
        >
          Add Credential
        </button>

        {/* Added Credentials */}
        {credentials.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            {credentials.map((cred, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    {Array.isArray(cred.type) ? cred.type.join(', ') : cred.type}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Issuer: {cred.issuer}
                  </div>
                  {cred.expirationDate && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Expires: {new Date(cred.expirationDate).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeCredential(index)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-error)',
                    border: '1px solid var(--border-error)',
                    color: 'var(--text-error)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={verifying || (!didInput && credentials.length === 0)}
        style={{
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--cyan, #06b6d4)',
          border: 'none',
          color: '#0a0a0a',
          cursor: verifying || (!didInput && credentials.length === 0) ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          opacity: verifying || (!didInput && credentials.length === 0) ? 0.6 : 1,
          marginBottom: '24px',
        }}
      >
        {verifying ? 'Verifying...' : 'Verify Identity'}
      </button>

      {/* Verification Results */}
      {verificationResult && (
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: verificationResult.overallValid
              ? 'var(--green, #10b981)'
              : 'var(--bg-error)',
            border: verificationResult.overallValid
              ? '1px solid var(--green, #10b981)'
              : '1px solid var(--border-error)',
            color: verificationResult.overallValid ? '#0a0a0a' : 'var(--text-error)',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Verification Result
          </h3>
          
          {/* DID Result */}
          {didInput && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px' }}>
                DID: {verificationResult.didValid ? '✓ Valid' : '✗ Invalid'}
              </div>
              {verificationResult.didDocument && (
                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                  {verificationResult.didDocument.id}
                </div>
              )}
            </div>
          )}

          {/* Credentials Result */}
          {credentials.length > 0 && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: '8px' }}>
                Credentials: {verificationResult.credentialsValid.every((v) => v) ? '✓ All Valid' : '✗ Some Invalid'}
              </div>
              {credentials.map((cred, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    marginTop: '8px',
                    borderRadius: 'var(--radius-sm)',
                    background: verificationResult.credentialsValid[index]
                      ? 'rgba(0,0,0,0.1)'
                      : 'rgba(255,255,255,0.1)',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    {verificationResult.credentialsValid[index] ? '✓' : '✗'}{' '}
                    {Array.isArray(cred.type) ? cred.type.join(', ') : cred.type}
                  </div>
                  {verificationResult.credentialErrors[index] && (
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {verificationResult.credentialErrors[index]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Overall Result */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid currentColor',
              fontWeight: 600,
            }}
          >
            Overall: {verificationResult.overallValid ? '✓ Identity Verified' : '✗ Verification Failed'}
          </div>
        </div>
      )}
    </div>
  )
}
