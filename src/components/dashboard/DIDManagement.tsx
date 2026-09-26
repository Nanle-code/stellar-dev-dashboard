/**
 * DID Document Management Component
 * Provides UI for managing decentralized identity documents
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../../lib/store'
import {
  generateDID,
  createDIDDocumentFromPublicKey,
  resolveDID,
  addServiceEndpoint,
  removeServiceEndpoint,
  addVerificationMethod,
  deactivateDIDDocument,
  validateDIDDocument,
  type DIDDocument,
  type ServiceEndpoint,
  type VerificationMethod,
} from '../../lib/did'
import {
  createCredential,
  signCredential,
  verifyCredential,
  type VerifiableCredential,
} from '../../lib/verifiableCredentials'
import {
  isAuthenticated,
  getAuthenticatedDID,
  authenticateWithFreighter,
  logout,
} from '../../lib/didAuth'

export default function DIDManagement() {
  const { connectedAddress, network } = useStore()
  const [didDocument, setDidDocument] = useState<DIDDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'credentials' | 'services' | 'auth'>('overview')
  const [newServiceType, setNewServiceType] = useState('')
  const [newServiceEndpoint, setNewServiceEndpoint] = useState('')
  const [credentials, setCredentials] = useState<VerifiableCredential[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authDID, setAuthDID] = useState<string | null>(null)

  // Load DID document on mount or when address changes
  useEffect(() => {
    if (connectedAddress) {
      loadDIDDocument()
    }
  }, [connectedAddress, network])

  // Check authentication status
  useEffect(() => {
    const authStatus = isAuthenticated()
    setIsAuthenticated(authStatus)
    setAuthDID(getAuthenticatedDID())
  }, [])

  const loadDIDDocument = async () => {
    if (!connectedAddress) return

    setLoading(true)
    setError(null)

    try {
      const did = generateDID(connectedAddress, network)
      const result = await resolveDID(did)

      if (result.didResolutionMetadata.error) {
        setError(result.didResolutionMetadata.error as string)
        setDidDocument(null)
      } else {
        setDidDocument(result.didDocument)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DID document')
      setDidDocument(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAddService = () => {
    if (!didDocument || !newServiceType || !newServiceEndpoint) return

    const service: ServiceEndpoint = {
      id: `${didDocument.id}#service-${Date.now()}`,
      type: newServiceType,
      serviceEndpoint: newServiceEndpoint,
    }

    const updated = addServiceEndpoint(didDocument, service)
    setDidDocument(updated)
    setNewServiceType('')
    setNewServiceEndpoint('')
  }

  const handleRemoveService = (serviceId: string) => {
    if (!didDocument) return
    const updated = removeServiceEndpoint(didDocument, serviceId)
    setDidDocument(updated)
  }

  const handleDeactivate = () => {
    if (!didDocument) return
    if (confirm('Are you sure you want to deactivate this DID? This action cannot be undone.')) {
      const updated = deactivateDIDDocument(didDocument)
      setDidDocument(updated)
    }
  }

  const handleAuthenticate = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await authenticateWithFreighter()
      if (result.success) {
        setIsAuthenticated(true)
        setAuthDID(result.did)
        // Reload DID document with authenticated DID
        if (result.did) {
          const didResult = await resolveDID(result.did)
          if (!didResult.didResolutionMetadata.error) {
            setDidDocument(didResult.didDocument)
          }
        }
      } else {
        setError(result.error || 'Authentication failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    setIsAuthenticated(false)
    setAuthDID(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading && !didDocument) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>Loading DID document...</div>
      </div>
    )
  }

  if (!connectedAddress) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
          Please connect a wallet to manage your DID
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, marginBottom: '8px' }}>
          Decentralized Identity
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Manage your self-sovereign identity on Stellar using W3C DID standards
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

      {/* Authentication Status */}
      <div
        style={{
          padding: '16px',
          marginBottom: '24px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isAuthenticated ? 'var(--green, #10b981)' : 'var(--orange, #f59e0b)',
              }}
            />
            <span style={{ fontWeight: 500 }}>
              {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
            </span>
          </div>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          ) : (
            <button
              onClick={handleAuthenticate}
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--cyan, #06b6d4)',
                border: 'none',
                color: '#0a0a0a',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Authenticating...' : 'Authenticate with DID'}
            </button>
          )}
        </div>
        {authDID && (
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 500 }}>Authenticated DID:</span>{' '}
            <code
              style={{
                background: 'var(--bg-elevated)',
                padding: '2px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => copyToClipboard(authDID)}
              title="Click to copy"
            >
              {authDID}
            </code>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0',
        }}
      >
        {(['overview', 'credentials', 'services', 'auth'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--cyan, #06b6d4)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 500 : 400,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && didDocument && (
        <div>
          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              marginBottom: '16px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>DID Document</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                DID
              </label>
              <code
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  wordBreak: 'break-all',
                  cursor: 'pointer',
                }}
                onClick={() => copyToClipboard(didDocument.id)}
                title="Click to copy"
              >
                {didDocument.id}
              </code>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                Created
              </label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {didDocument.created ? new Date(didDocument.created).toLocaleString() : 'N/A'}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                Updated
              </label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                {didDocument.updated ? new Date(didDocument.updated).toLocaleString() : 'N/A'}
              </div>
            </div>

            {didDocument.deactivated && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-error)',
                  color: 'var(--text-error)',
                  fontSize: '14px',
                }}
              >
                This DID has been deactivated
              </div>
            )}

            {!didDocument.deactivated && (
              <button
                onClick={handleDeactivate}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-error)',
                  border: '1px solid var(--border-error)',
                  color: 'var(--text-error)',
                  cursor: 'pointer',
                }}
              >
                Deactivate DID
              </button>
            )}
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Verification Methods ({didDocument.verificationMethod?.length || 0})
            </h3>
            {didDocument.verificationMethod?.map((vm) => (
              <div
                key={vm.id}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  fontSize: '14px',
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{vm.id}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Type: {vm.type}
                </div>
                {vm.publicKeyBase58 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Public Key:{' '}
                    <code style={{ fontSize: '12px' }}>{vm.publicKeyBase58.slice(0, 16)}...</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'services' && didDocument && (
        <div>
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
              Add Service Endpoint
            </h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Service Type (e.g., DIDCommMessaging)"
                value={newServiceType}
                onChange={(e) => setNewServiceType(e.target.value)}
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
                placeholder="Service Endpoint URL"
                value={newServiceEndpoint}
                onChange={(e) => setNewServiceEndpoint(e.target.value)}
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
              <button
                onClick={handleAddService}
                disabled={!newServiceType || !newServiceEndpoint}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--cyan, #06b6d4)',
                  border: 'none',
                  color: '#0a0a0a',
                  cursor: newServiceType && newServiceEndpoint ? 'pointer' : 'not-allowed',
                  opacity: newServiceType && newServiceEndpoint ? 1 : 0.6,
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Service Endpoints ({didDocument.service?.length || 0})
            </h3>
            {didDocument.service?.length === 0 ? (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                No service endpoints configured
              </div>
            ) : (
              didDocument.service?.map((service) => (
                <div
                  key={service.id}
                  style={{
                    padding: '12px',
                    marginBottom: '8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{service.type}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {typeof service.serviceEndpoint === 'string'
                        ? service.serviceEndpoint
                        : JSON.stringify(service.serviceEndpoint)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveService(service.id)}
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
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'credentials' && (
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            Verifiable Credentials
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Manage your verifiable credentials. This feature allows you to issue, verify, and present
            credentials according to W3C standards.
          </p>
          {credentials.length === 0 ? (
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              No credentials available. Connect with an issuer to receive credentials.
            </div>
          ) : (
            credentials.map((cred, index) => (
              <div
                key={index}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                  {Array.isArray(cred.type) ? cred.type.join(', ') : cred.type}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Issuer: {cred.issuer}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Issued: {new Date(cred.issuanceDate).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'auth' && (
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
            DID Authentication
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Authenticate using your decentralized identity. This allows you to prove ownership of your
            DID without revealing your private key.
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
              Authentication Methods
            </label>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              • Freighter Wallet Integration
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              • Ledger Hardware Wallet (Coming Soon)
            </div>
          </div>

          {isAuthenticated ? (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--green, #10b981)',
                color: '#0a0a0a',
                fontSize: '14px',
              }}
            >
              ✓ Successfully authenticated with DID: {authDID}
            </div>
          ) : (
            <button
              onClick={handleAuthenticate}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--cyan, #06b6d4)',
                border: 'none',
                color: '#0a0a0a',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Authenticating...' : 'Authenticate with DID'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
