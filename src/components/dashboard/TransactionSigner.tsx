import React, { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../../lib/store'
import { signTransactionWithFreighter } from '../../lib/wallet/freighter'
import { signXdrWithLedger, isLedgerSupported, getActiveLedgerSession } from '../../lib/wallet/ledger'
import { NETWORKS, fetchAccount } from '../../lib/stellar'
import * as StellarSdk from '@stellar/stellar-sdk'
import { measureAsync } from '../../lib/performanceMonitoring'
import { loadPreferences, DEFAULT_PREFERENCES } from '../../lib/userPreferences'
import type { UserPreferences } from '../../lib/userPreferences'
import Card from './Card'
import EnhancedTransactionConfirmation from '../security/EnhancedTransactionConfirmation'
import MainnetReviewModal from '../security/MainnetReviewModal'
import type { MainnetReviewItem } from '../security/MainnetReviewModal'
import BiometricAuthOverlay from '../biometrics/BiometricAuthOverlay'
import { useBehavioralBiometrics } from '../../hooks/useBehavioralBiometrics'

export default function TransactionSigner() {
  const { walletConnected, walletType, walletPublicKey, network } = useStore()
  const [xdr, setXdr] = useState('')
  const [signedXdr, setSignedXdr] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [ledgerPrompt, setLedgerPrompt] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showBiometricOverlay, setShowBiometricOverlay] = useState(false)
  const [showMainnetReview, setShowMainnetReview] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)

  // ─── Behavioral Biometrics ─────────────────────────────────────────────────
  const bio = useBehavioralBiometrics(walletPublicKey)

  const [accountInfo, setAccountInfo] = useState<any>(null)

  useEffect(() => {
    async function fetchPreferences() {
      const prefs = await loadPreferences()
      setPreferences(prefs)
    }
    fetchPreferences()
  }, [])

  const networkPassphrase: string = NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase

  useEffect(() => {
    async function loadAccountInfo() {
      if (!xdr.trim()) {
        setAccountInfo(null);
        return;
      }
      try {
        const tx = StellarSdk.TransactionBuilder.fromXDR(xdr.trim(), networkPassphrase) as any;
        const sourceAccount = tx.source || tx.sourceAccount?.accountId?.();
        if (sourceAccount) {
          const account = await fetchAccount(sourceAccount, network);
          setAccountInfo({
            sourceAccount,
            thresholds: account.thresholds,
            signers: account.signers
          });
        }
      } catch (e) {
        setAccountInfo(null);
      }
    }
    const t = setTimeout(loadAccountInfo, 500);
    return () => clearTimeout(t);
  }, [xdr, network, networkPassphrase])

  // Start collecting behavior as soon as user interacts with the XDR textarea
  const handleXdrChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setXdr(e.target.value)
    if (bio.enabled && !bio.authStatus.match(/collecting|evaluating/)) {
      bio.startCollection()
    }
  }, [bio])

  // networkPassphrase moved up
  const handleSign = async () => {
    if (!xdr.trim()) {
      setError('Please enter a transaction XDR to sign')
      return
    }

    // Run biometric check if enabled
    if (bio.enabled && bio.isEstablished) {
      const result = await bio.evaluateAndRecord()
      if (result) {
        setShowBiometricOverlay(true)
        // For strict mode anomalies, stop here — overlay handles cancel
        if (result.isAnomaly && bio.strictMode) return
        // For non-anomaly or warn mode, overlay will call onDismiss/onProceedAnyway
        if (!result.isAnomaly) {
          // Auto-dismiss quickly for a passed check — show briefly then proceed
          setTimeout(() => {
            setShowBiometricOverlay(false)
            _proceedToSign()
          }, 1200)
          return
        }
        // Anomaly in warn mode: wait for user action via overlay
        return
      }
    } else if (bio.enabled && !bio.isEstablished) {
      // Learning mode: still evaluate (returns learning result) and show briefly
      const result = await bio.evaluateAndRecord()
      if (result) {
        setShowBiometricOverlay(true)
        setTimeout(() => {
          setShowBiometricOverlay(false)
          _proceedToSign()
        }, 1500)
        return
      }
    }

    await _proceedToSign()
  }

  const _proceedToSign = async () => {
    // On Mainnet, show the explicit review step before confirmation/signing
    if (network === 'mainnet' && !showMainnetReview) {
      setShowMainnetReview(true)
      return
    }
    if (preferences.transactionConfirmation.enabled) {
      setShowConfirmation(true)
      return
    }
    await doSign()
  }

  const _buildMainnetReviewItems = (): MainnetReviewItem[] => {
    const items: MainnetReviewItem[] = []
    try {
      const tx = StellarSdk.TransactionBuilder.fromXDR(xdr.trim(), networkPassphrase) as any
      const source: string = tx.source || tx.sourceAccount?.accountId?.() || '—'
      items.push({ label: 'Network', value: 'Mainnet (Public)', highlight: true })
      items.push({ label: 'Source', value: `${source.slice(0, 8)}…${source.slice(-8)}`, mono: true })
      const fee = tx.fee ?? '—'
      items.push({ label: 'Fee', value: `${fee} stroops`, mono: true })
      const ops: any[] = tx.operations || []
      items.push({ label: 'Operations', value: String(ops.length) })
      ops.forEach((op: any, idx: number) => {
        if (op.type === 'payment' || op.type === 'createAccount') {
          const dest: string = op.destination || '—'
          items.push({
            label: `Destination ${idx + 1}`,
            value: `${dest.slice(0, 8)}…${dest.slice(-8)}`,
            mono: true,
          })
          const amt = op.amount ?? op.startingBalance ?? '—'
          const assetLabel =
            !op.asset || (op.asset && typeof op.asset.isNative === 'function' && op.asset.isNative())
              ? 'XLM'
              : op.asset?.code ?? 'unknown'
          items.push({ label: `Amount ${idx + 1}`, value: `${amt} ${assetLabel}`, highlight: true })
        } else if (op.type === 'invokeHostFunction') {
          items.push({ label: `Op ${idx + 1}`, value: 'Smart contract invocation' })
        } else {
          items.push({ label: `Op ${idx + 1}`, value: op.type ?? 'unknown' })
        }
      })
    } catch {
      items.push({ label: 'Network', value: 'Mainnet (Public)', highlight: true })
      items.push({ label: 'Transaction', value: 'Unable to parse XDR for preview' })
    }
    return items
  }

  const doSign = async () => {
    setSigning(true)
    setError(null)
    setSignedXdr(null)

    try {
      let result: string | null = null

      if (walletType === 'freighter') {
        const networkName = network === 'mainnet' ? 'PUBLIC' : 'TESTNET'
        result = await measureAsync(
          'TRANSACTION_SIGNING_DURATION',
          () => signTransactionWithFreighter(xdr.trim(), networkName),
          { network, walletType: 'freighter' },
        )
      } else if (walletType === 'ledger') {
        await _signWithLedger()
        return
      } else {
        throw new Error('No wallet connected. Connect a wallet first.')
      }

      setSignedXdr(result)
      // Record this successful sign to the behavioral profile
      if (bio.enabled) {
        bio.recordSuccessfulSign().catch(() => {})
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSigning(false)
    }
  }

  const handleConfirm = async () => {
    setShowConfirmation(false)
    await doSign()
  }

  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
    setShowMainnetReview(false)
    bio.abort()
  }

  const handleMainnetReviewConfirm = async () => {
    setShowMainnetReview(false)
    if (preferences.transactionConfirmation.enabled) {
      setShowConfirmation(true)
      return
    }
    await doSign()
  }

  const handleMainnetReviewCancel = () => {
    setShowMainnetReview(false)
    bio.abort()
  }

  // Biometric overlay handlers
  const handleBiometricProceed = async () => {
    setShowBiometricOverlay(false)
    await _proceedToSign()
  }

  const handleBiometricCancel = () => {
    setShowBiometricOverlay(false)
    bio.abort()
  }

  const handleBiometricDismiss = async () => {
    setShowBiometricOverlay(false)
    await _proceedToSign()
  }

  const _signWithLedger = async () => {
    const supported = await isLedgerSupported()
    if (!supported) {
      setError(
        'WebUSB/WebHID is not supported in this browser. ' +
        'Please use Chrome or a Chromium-based browser to sign with Ledger.'
      )
      setSigning(false)
      return
    }

    const { stellarApp, publicKey } = getActiveLedgerSession()
    if (!stellarApp) {
      setError(
        'Ledger session not found. Please connect your Ledger in the Wallet tab first, ' +
        'then return here to sign.'
      )
      setSigning(false)
      return
    }

    try {
      setLedgerPrompt(true)
      const signed = await measureAsync(
        'TRANSACTION_SIGNING_DURATION',
        () => signXdrWithLedger(
          xdr.trim(),
          networkPassphrase,
          stellarApp,
          publicKey || walletPublicKey
        ),
        { network, walletType: 'ledger' },
      )
      setSignedXdr(signed as string)
      // Record this successful sign to the behavioral profile
      if (bio.enabled) {
        bio.recordSuccessfulSign().catch(() => {})
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLedgerPrompt(false)
      setSigning(false)
    }
  }

  const handleCopy = () => {
    if (signedXdr) {
      navigator.clipboard.writeText(signedXdr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!walletConnected) {
    return (
      <Card title="Transaction Signer" subtitle="Sign transactions with your wallet">
        <div style={{
          padding: '32px 18px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>✎</div>
          Connect a wallet to sign transactions.
          <br />
          <span style={{ fontSize: '11px' }}>Use the Wallet tab to connect Freighter or Ledger.</span>
        </div>
      </Card>
    )
  }

  if (showConfirmation) {
    return (
      <EnhancedTransactionConfirmation
        transactionXdr={xdr}
        network={network}
        preferences={preferences}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirmation}
        sourceAccount={walletPublicKey}
      />
    )
  }

  return (
    <>
    <Card title="Transaction Signer" subtitle={`Signing with ${walletType}`}>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px',
          background: 'var(--cyan-glow)',
          border: '1px solid var(--cyan-dim)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px', color: 'var(--cyan)',
        }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signer:</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {walletPublicKey?.slice(0, 8)}…{walletPublicKey?.slice(-8)}
          </span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{walletType}</span>
        </div>

        {ledgerPrompt && (
          <div style={{
            padding: '12px',
            background: 'var(--amber-glow, rgba(245,158,11,0.1))',
            border: '1px solid var(--amber, #f59e0b)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--amber, #f59e0b)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
            Review and confirm the transaction on your Ledger device…
          </div>
        )}

        <div>
          <label style={{
            fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px',
            textTransform: 'uppercase', display: 'block', marginBottom: '6px',
          }}>
            TRANSACTION XDR
          </label>
          <textarea
            value={xdr}
            onChange={handleXdrChange}
            placeholder="Paste the unsigned transaction XDR envelope here…"
            rows={5}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
              lineHeight: 1.5,
              outline: 'none',
            }}
          />
        </div>

        {accountInfo && (
          <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Signer Requirements
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>LOW</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{accountInfo.thresholds?.low_threshold}</div>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MED</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{accountInfo.thresholds?.med_threshold}</div>
              </div>
              <div style={{ background: 'var(--bg-base)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HIGH</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{accountInfo.thresholds?.high_threshold}</div>
              </div>
            </div>
            
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Current Signers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
              {accountInfo.signers?.map((s: any) => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '4px 8px', background: 'var(--bg-base)', borderRadius: '4px' }}>
                  <span>{s.key.slice(0, 8)}...{s.key.slice(-8)}</span>
                  <span style={{ color: 'var(--cyan)' }}>Weight: {s.weight}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSign}
          disabled={signing || !xdr.trim()}
          style={{
            padding: '12px 20px',
            background: signing ? 'transparent' : 'var(--cyan-glow)',
            border: `1px solid ${signing ? 'var(--border)' : 'var(--cyan)'}`,
            borderRadius: 'var(--radius-md)',
            color: signing ? 'var(--text-muted)' : 'var(--cyan)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: signing ? 'wait' : 'pointer',
            transition: 'var(--transition)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            opacity: !xdr.trim() ? 0.5 : 1,
          }}
        >
          {signing ? (
            <>
              <div className="spinner" />
              {ledgerPrompt ? 'Waiting for Ledger…' : 'Signing…'}
            </>
          ) : (
            'Sign Transaction'
          )}
        </button>

        {error && (
          <div style={{
            padding: '12px',
            background: 'var(--red-glow)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--red)',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {signedXdr && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                SIGNED XDR
              </label>
              <button
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: copied ? 'var(--green)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  transition: 'var(--transition)',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{
              padding: '12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--green)',
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
              maxHeight: '120px',
              overflowY: 'auto',
            }}>
              {signedXdr}
            </div>
          </div>
        )}

        {/* Biometric status badge (shown in learning mode) */}
        {bio.enabled && !bio.isEstablished && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px',
            background: 'rgba(6,182,212,0.06)',
            border: '1px solid var(--cyan-dim, rgba(6,182,212,0.2))',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11px',
            color: 'var(--cyan, #06b6d4)',
          }}>
            <span>📖</span>
            <span>
              Behavioral profile learning — {bio.samplesNeeded} more transaction{bio.samplesNeeded === 1 ? '' : 's'} to establish your identity
            </span>
          </div>
        )}
      </div>
    </Card>

    {/* Mainnet review modal — must be confirmed before signing proceeds */}
    {showMainnetReview && (
      <MainnetReviewModal
        actionTitle="Sign Transaction"
        irreversible
        items={_buildMainnetReviewItems()}
        warnings={['You are about to sign a transaction on Stellar Mainnet. Real funds will be transferred.']}
        onConfirm={handleMainnetReviewConfirm}
        onCancel={handleMainnetReviewCancel}
      />
    )}

    {/* Biometric overlay — rendered as a portal-like fixed overlay */}
    {showBiometricOverlay && (
      <BiometricAuthOverlay
        status={bio.authStatus}
        profile={bio.profile}
        lastResult={bio.lastAnomalyResult}
        onProceedAnyway={handleBiometricProceed}
        onCancel={handleBiometricCancel}
        onDismiss={handleBiometricDismiss}
        strictMode={bio.strictMode}
      />
    )}
    </>
  )
}
