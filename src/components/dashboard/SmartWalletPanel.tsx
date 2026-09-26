/**
 * SmartWalletPanel — UI for passkey-based smart wallet accounts (secp256r1).
 *
 * Responsibilities:
 *  - Create a new passkey credential (navigator.credentials.create)
 *  - Show the smart wallet's SAC token balances and auth history
 *  - Trigger WebAuthn signing for a Soroban auth entry (demo / test flow)
 *  - Surface compatibility, security, and error states to the user
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useStore } from '../../lib/store'
import {
  isPasskeySupported,
  createPasskey,
  loadPasskeyCredential,
  clearPasskeyCredential,
  PasskeyNotSupportedError,
  PasskeyCancelledError,
  PasskeyCredentialNotFoundError,
  PasskeyTimeoutError,
  type PasskeyCredentialMetadata,
} from '../../lib/wallet/passkey'
import {
  fetchSmartWalletAccount,
  signSorobanAuthEntry,
  type SmartWalletAccount,
  type SacBalance,
  type AuthHistoryEntry,
} from '../../lib/wallet/smartWallet'
import { NETWORKS } from '../../lib/stellar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenAddress(addr: string, chars = 6): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompatibilityBanner() {
  const supported = isPasskeySupported()
  if (supported) return null

  return (
    <div
      role="alert"
      style={{
        padding: '12px 16px',
        background: 'var(--amber-glow, rgba(251,191,36,0.12))',
        border: '1px solid var(--amber, #fbbf24)',
        borderRadius: 'var(--radius-md, 8px)',
        color: 'var(--amber, #fbbf24)',
        fontSize: '13px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠</span>
      <div>
        <strong>Browser not supported</strong>
        <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
          WebAuthn passkeys require Chrome 67+, Edge 18+, Safari 14+, or Firefox 60+.
          Passkey creation and signing are unavailable in this browser.
        </p>
      </div>
    </div>
  )
}

function SacBalanceRow({ balance }: { balance: SacBalance }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: '13px',
      }}
    >
      <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontSize: '11px' }}>
        {balance.assetCode}
        {!balance.isNative && balance.issuer && (
          <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
            {shortenAddress(balance.issuer)}
          </span>
        )}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        {balance.balance}
      </span>
    </div>
  )
}

function AuthHistoryRow({ entry }: { entry: AuthHistoryEntry }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '8px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: '12px',
      }}
    >
      <div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            background: entry.success ? 'var(--green-glow, rgba(52,211,153,0.12))' : 'rgba(239,68,68,0.12)',
            color: entry.success ? 'var(--green, #34d399)' : '#ef4444',
            marginRight: '8px',
          }}
        >
          {entry.success ? 'OK' : 'FAIL'}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
          {entry.functionName ?? '__check_auth'}
        </span>
        <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {shortenAddress(entry.txHash)}
        </div>
      </div>
      <div style={{ color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {formatTimestamp(entry.closedAt)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SmartWalletPanel() {
  const { network } = useStore()

  // Passkey credential state
  const [credential, setCredential] = useState<PasskeyCredentialMetadata | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLabel, setCreateLabel] = useState('My Stellar Passkey')

  // Smart wallet account view
  const [contractInput, setContractInput] = useState('')
  const [account, setAccount] = useState<SmartWalletAccount | null>(null)
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  // Signing demo state
  const [authEntryXdr, setAuthEntryXdr] = useState('')
  const [signing, setSigning] = useState(false)
  const [signResult, setSignResult] = useState<string | null>(null)
  const [signError, setSignError] = useState<string | null>(null)

  // Load stored credential on mount
  useEffect(() => {
    setCredential(loadPasskeyCredential())
  }, [])

  // ── Create passkey ──────────────────────────────────────────────────────────

  const handleCreatePasskey = useCallback(async () => {
    setCreating(true)
    setCreateError(null)

    try {
      const meta = await createPasskey({ label: createLabel.trim() || 'Stellar Smart Wallet' })
      setCredential(meta)
    } catch (err: unknown) {
      const error = err as Error
      if (error instanceof PasskeyNotSupportedError) {
        setCreateError(error.message)
      } else if (error instanceof PasskeyCancelledError) {
        setCreateError('Passkey creation was cancelled. Please try again.')
      } else if (error instanceof PasskeyTimeoutError) {
        setCreateError('Passkey creation timed out. Please try again.')
      } else {
        setCreateError(`Failed to create passkey: ${error?.message ?? String(err)}`)
      }
    } finally {
      setCreating(false)
    }
  }, [createLabel])

  const handleClearPasskey = useCallback(() => {
    clearPasskeyCredential()
    setCredential(null)
    setAccount(null)
    setAccountError(null)
  }, [])

  // ── Load smart wallet account ───────────────────────────────────────────────

  const handleLoadAccount = useCallback(async () => {
    const id = contractInput.trim()
    if (!id) {
      setAccountError('Enter a contract address (C-address).')
      return
    }

    setAccountLoading(true)
    setAccountError(null)
    setAccount(null)

    try {
      const result = await fetchSmartWalletAccount(id, network)
      setAccount(result)
    } catch (err: unknown) {
      setAccountError((err as Error)?.message ?? 'Failed to load smart wallet account.')
    } finally {
      setAccountLoading(false)
    }
  }, [contractInput, network])

  // ── Sign Soroban auth entry ─────────────────────────────────────────────────

  const handleSign = useCallback(async () => {
    if (!authEntryXdr.trim()) {
      setSignError('Paste a Base64-encoded SorobanAuthorizationEntry XDR to sign.')
      return
    }

    setSigning(true)
    setSignError(null)
    setSignResult(null)

    try {
      const networkPassphrase = NETWORKS[network]?.passphrase
      if (!networkPassphrase) throw new Error(`No network passphrase for "${network}"`)

      const result = await signSorobanAuthEntry({
        authEntryXdr: authEntryXdr.trim(),
        networkPassphrase,
        credentialId: credential?.credentialId,
        compressedPublicKey: credential?.compressedPublicKey,
      })

      setSignResult(result.authEntryXdr)
    } catch (err: unknown) {
      const error = err as Error
      if (error instanceof PasskeyNotSupportedError) {
        setSignError(error.message)
      } else if (error instanceof PasskeyCancelledError) {
        setSignError('Passkey signing was cancelled.')
      } else if (error instanceof PasskeyCredentialNotFoundError) {
        setSignError(error.message)
      } else if (error instanceof PasskeyTimeoutError) {
        setSignError('Passkey signing timed out. Please try again.')
      } else {
        setSignError(`Signing failed: ${error?.message ?? String(err)}`)
      }
    } finally {
      setSigning(false)
    }
  }, [authEntryXdr, credential, network])

  // ── Render ──────────────────────────────────────────────────────────────────

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-elevated, rgba(255,255,255,0.04))',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md, 8px)',
    overflow: 'hidden',
  }

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--cyan)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm, 6px)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    boxSizing: 'border-box',
  }

  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px',
    background: 'var(--cyan)',
    color: '#0a0f1a',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  const btnDanger: React.CSSProperties = {
    ...btnPrimary,
    background: 'rgba(239,68,68,0.15)',
    color: '#ef4444',
  }

  const errorStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 'var(--radius-sm, 6px)',
    color: '#ef4444',
    fontSize: '13px',
  }

  const successStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: 'var(--green-glow, rgba(52,211,153,0.1))',
    border: '1px solid rgba(52,211,153,0.3)',
    borderRadius: 'var(--radius-sm, 6px)',
    color: 'var(--green, #34d399)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    wordBreak: 'break-all',
  }

  return (
    <div
      className="animate-in"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}
    >
      {/* Page title */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}
      >
        Passkey Smart Wallet
        <span
          style={{
            marginLeft: '10px',
            padding: '2px 8px',
            background: 'rgba(99,102,241,0.15)',
            color: '#818cf8',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          Protocol 21 · secp256r1
        </span>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
        Passkey smart wallets are Soroban contract accounts (C-addresses) whose{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>__check_auth</code> function
        verifies WebAuthn / P-256 signatures instead of Ed25519. Create a passkey below to register
        credentials, then load a smart wallet contract to view balances and auth history.
      </p>

      {/* Browser compatibility warning */}
      <CompatibilityBanner />

      {/* ── Section 1: Credential management ─────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>🔑</span>
          Passkey Credential
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {credential ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '6px 16px',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Label</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {credential.label ?? '—'}
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Credential ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', wordBreak: 'break-all', fontSize: '11px' }}>
                  {credential.credentialId}
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Public Key (hex)</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all', fontSize: '11px' }}>
                  {credential.compressedPublicKey}
                </span>

                {credential.contractId && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Contract</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: '11px' }}>
                      {credential.contractId}
                    </span>
                  </>
                )}

                <span style={{ color: 'var(--text-muted)' }}>Created</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {formatTimestamp(credential.createdAt)}
                </span>
              </div>

              <button
                onClick={handleClearPasskey}
                style={btnDanger}
                aria-label="Remove stored passkey credential"
              >
                Remove credential
              </button>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor="passkey-label"
                  style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}
                >
                  Credential label
                </label>
                <input
                  id="passkey-label"
                  type="text"
                  value={createLabel}
                  onChange={(e) => setCreateLabel(e.target.value)}
                  placeholder="My Stellar Passkey"
                  style={inputStyle}
                  disabled={creating}
                />
              </div>

              <button
                onClick={handleCreatePasskey}
                disabled={creating || !isPasskeySupported()}
                style={{
                  ...btnPrimary,
                  opacity: creating || !isPasskeySupported() ? 0.5 : 1,
                  cursor: creating || !isPasskeySupported() ? 'not-allowed' : 'pointer',
                }}
                aria-label="Create new passkey credential"
              >
                {creating ? 'Creating…' : 'Create Passkey'}
              </button>

              {createError && (
                <div role="alert" style={errorStyle}>
                  {createError}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section 2: Smart wallet account loader ────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>◉</span>
          Smart Wallet Account
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="contract-id-input"
                style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}
              >
                Contract address (C-address)
              </label>
              <input
                id="contract-id-input"
                type="text"
                value={contractInput}
                onChange={(e) => setContractInput(e.target.value)}
                placeholder="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM"
                style={inputStyle}
                disabled={accountLoading}
                aria-label="Smart wallet contract address"
              />
            </div>
            <div style={{ paddingTop: '22px' }}>
              <button
                onClick={handleLoadAccount}
                disabled={accountLoading}
                style={{
                  ...btnPrimary,
                  opacity: accountLoading ? 0.5 : 1,
                  cursor: accountLoading ? 'not-allowed' : 'pointer',
                }}
                aria-label="Load smart wallet account"
              >
                {accountLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
          </div>

          {accountError && (
            <div role="alert" style={errorStyle}>
              {accountError}
            </div>
          )}

          {account && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Identity */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '6px 16px', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Contract</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: '11px', wordBreak: 'break-all' }}>
                  {account.contractId}
                </span>

                <span style={{ color: 'var(--text-muted)' }}>Type</span>
                <span>
                  {account.isPasskeySmartWallet ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        background: 'rgba(52,211,153,0.12)',
                        color: 'var(--green, #34d399)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Passkey Smart Wallet ✓
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      Contract account (passkey interface not detected)
                    </span>
                  )}
                </span>

                {account.registeredPublicKey && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>Registered PK</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                      {account.registeredPublicKey}
                    </span>
                  </>
                )}

                <span style={{ color: 'var(--text-muted)' }}>Network</span>
                <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{account.network}</span>

                <span style={{ color: 'var(--text-muted)' }}>Fetched</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {formatTimestamp(account.fetchedAt)}
                </span>
              </div>

              {/* SAC Balances */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: '8px',
                  }}
                >
                  Token Balances (SAC)
                </div>
                {account.sacBalances.length === 0 ? (
                  <div
                    style={{
                      padding: '12px 18px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No SAC balances found.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', overflow: 'hidden' }}>
                    {account.sacBalances.map((b) => (
                      <SacBalanceRow key={b.contractId} balance={b} />
                    ))}
                  </div>
                )}
              </div>

              {/* Auth History */}
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    marginBottom: '8px',
                  }}
                >
                  Auth History (__check_auth)
                </div>
                {account.authHistory.length === 0 ? (
                  <div
                    style={{
                      padding: '12px 18px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    No auth history found.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm, 6px)', overflow: 'hidden' }}>
                    {account.authHistory.map((entry) => (
                      <AuthHistoryRow key={entry.txHash} entry={entry} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Sign Soroban auth entry ───────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>✍</span>
          Sign Auth Entry (WebAuthn)
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Paste a Base64-encoded <code style={{ fontFamily: 'var(--font-mono)' }}>SorobanAuthorizationEntry</code> XDR.
            The passkey will sign it and return the credential ScMap for the relayer.
          </p>

          {!credential && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: 'var(--radius-sm, 6px)',
                color: 'var(--amber, #fbbf24)',
                fontSize: '13px',
              }}
            >
              Create a passkey credential first before signing.
            </div>
          )}

          <div>
            <label
              htmlFor="auth-entry-xdr"
              style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}
            >
              SorobanAuthorizationEntry XDR (Base64)
            </label>
            <textarea
              id="auth-entry-xdr"
              value={authEntryXdr}
              onChange={(e) => setAuthEntryXdr(e.target.value)}
              placeholder="AAAAA..."
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
              disabled={signing || !credential}
              aria-label="SorobanAuthorizationEntry XDR input"
            />
          </div>

          <button
            onClick={handleSign}
            disabled={signing || !credential || !isPasskeySupported()}
            style={{
              ...btnPrimary,
              opacity: signing || !credential || !isPasskeySupported() ? 0.5 : 1,
              cursor: signing || !credential || !isPasskeySupported() ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
            aria-label="Sign auth entry with passkey"
          >
            {signing ? 'Waiting for authenticator…' : 'Sign with Passkey'}
          </button>

          {signError && (
            <div role="alert" style={errorStyle}>
              {signError}
            </div>
          )}

          {signResult && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Signed credential ScMap (Base64 XDR):
              </div>
              <div style={successStyle} role="status" aria-label="Signing result">
                {signResult}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Security & compatibility notes ─────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>ℹ</span>
          Compatibility &amp; Security Notes
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Browser support:</strong>{' '}
            Chrome 67+, Edge 18+, Safari 14+, Firefox 60+. Platform authenticators
            (Touch ID, Windows Hello, Face ID) are preferred. Security keys (FIDO2 USB) are also
            supported where the browser exposes them.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Key material:</strong>{' '}
            The P-256 private key never leaves the authenticator. Only the public key and
            signature are transmitted. Credentials are bound to this origin (
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code>
            ) and cannot be phished by a different domain.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Relayer / fee sponsorship:</strong>{' '}
            Smart wallet transactions are submitted via a fee-sponsor relayer because
            the C-address account does not hold XLM for fees. The relayer wraps the signed
            auth entry into a fee-bump transaction before broadcasting.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Migration:</strong>{' '}
            Existing G-address accounts are not affected. You can use both a classic account
            and a smart wallet simultaneously from the same dashboard session.
          </p>
        </div>
      </div>
    </div>
  )
}
