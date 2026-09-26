import React, { useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  createSep10Challenge,
  validateSep10Challenge,
  signSep10Challenge,
  verifyChallengeAndIssueToken,
  type ChallengeResult,
  type Sep10TokenPayload,
} from '../../lib/sep10Auth';
import { isValidPublicKey } from '../../lib/stellar';
import { announceToScreenReader } from '../../utils/accessibility';

interface Sep10AuthCardProps {
  initialClientAddress?: string;
}

export default function Sep10AuthCard({ initialClientAddress = '' }: Sep10AuthCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [homeDomain, setHomeDomain] = useState('testnet.stellar.org');
  const [clientAddress, setClientAddress] = useState(initialClientAddress);
  const [clientSecret, setClientSecret] = useState('');
  const [serverKeypair] = useState(() => StellarSdk.Keypair.random());
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);
  const [signedXDR, setSignedXDR] = useState<string | null>(null);
  const [tokenPayload, setTokenPayload] = useState<Sep10TokenPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  function handleGenerateClientKeypair() {
    const randomKp = StellarSdk.Keypair.random();
    setClientAddress(randomKp.publicKey());
    setClientSecret(randomKp.secret());
    setChallengeResult(null);
    setSignedXDR(null);
    setTokenPayload(null);
    setStatusMessage('Generated sandbox client keypair for testing.');
    setErrorMessage('');
    announceToScreenReader('Generated test client keypair.');
  }

  function handleCreateChallenge() {
    setErrorMessage('');
    setStatusMessage('');
    const targetAddress = clientAddress.trim();

    if (!isValidPublicKey(targetAddress)) {
      setErrorMessage('Please provide a valid client Stellar public key (G...).');
      return;
    }

    if (!homeDomain.trim()) {
      setErrorMessage('Please enter an anchor or service home domain.');
      return;
    }

    try {
      const result = createSep10Challenge({
        serverKeypair,
        clientAccountId: targetAddress,
        homeDomain: homeDomain.trim(),
        timeoutSeconds: 300,
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      setChallengeResult(result);
      setSignedXDR(null);
      setTokenPayload(null);
      setStatusMessage('SEP-0010 challenge transaction generated with 300s validity.');
      announceToScreenReader('SEP-0010 challenge created successfully.');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to generate challenge transaction.');
    }
  }

  function handleSignChallenge() {
    if (!challengeResult) return;
    setErrorMessage('');
    setStatusMessage('');

    try {
      let clientKp: StellarSdk.Keypair;
      if (clientSecret.trim()) {
        clientKp = StellarSdk.Keypair.fromSecret(clientSecret.trim());
      } else {
        // If developer has not supplied secret, prompt or error
        setErrorMessage('Client secret key (S...) is required to sign the challenge.');
        return;
      }

      if (clientKp.publicKey() !== challengeResult.clientAccountId) {
        setErrorMessage('Provided secret key does not match the challenge client public key.');
        return;
      }

      const signed = signSep10Challenge(
        challengeResult.transactionXDR,
        clientKp,
        StellarSdk.Networks.TESTNET
      );

      setSignedXDR(signed);
      setStatusMessage('Challenge transaction signed by client account.');
      announceToScreenReader('Challenge signed successfully.');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to sign challenge.');
    }
  }

  function handleVerifyAndIssueToken() {
    if (!signedXDR || !challengeResult) return;
    setErrorMessage('');
    setStatusMessage('');

    try {
      const token = verifyChallengeAndIssueToken(
        signedXDR,
        challengeResult.serverPublicKey,
        challengeResult.homeDomain,
        StellarSdk.Networks.TESTNET
      );

      setTokenPayload(token);
      setStatusMessage('Signatures verified! SEP-0010 JWT bearer token issued.');
      announceToScreenReader('SEP-0010 bearer token issued successfully.');
    } catch (err) {
      setErrorMessage((err as Error).message || 'Token verification failed.');
    }
  }

  return (
    <div
      style={{
        marginTop: '20px',
        width: '100%',
        maxWidth: '540px',
        background: 'var(--bg-card, #141721)',
        border: '1px solid var(--border, #2a2e3d)',
        borderRadius: 'var(--radius-lg, 8px)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary, #ffffff)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔐</span>
          <span>SEP-0010 Web Authentication Helper</span>
        </span>
        <span style={{ fontSize: '12px', color: 'var(--cyan, #00d4ff)' }}>
          {isOpen ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid var(--border, #2a2e3d)' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', margin: '12px 0' }}>
            Interactive developer helper for testing SEP-0010 challenge creation, client signing, and
            token verification for authenticated Stellar/Anchor APIs.
          </p>

          {/* Configuration Inputs */}
          <div style={{ display: 'grid', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)', marginBottom: '4px' }}>
                Anchor / Home Domain
              </label>
              <input
                type="text"
                value={homeDomain}
                onChange={(e) => setHomeDomain(e.target.value)}
                placeholder="e.g. testnet.stellar.org"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated, #1e2230)',
                  border: '1px solid var(--border, #2a2e3d)',
                  borderRadius: '4px',
                  color: 'var(--text-primary, #fff)',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                  Client Stellar Public Key (G...)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateClientKeypair}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--cyan, #00d4ff)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Generate Test Keypair
                </button>
              </div>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="G..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated, #1e2230)',
                  border: '1px solid var(--border, #2a2e3d)',
                  borderRadius: '4px',
                  color: 'var(--text-primary, #fff)',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                }}
              />
            </div>

            {clientSecret && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--amber, #f59e0b)', marginBottom: '4px' }}>
                  Client Secret Key (S... sandbox test key)
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated, #1e2230)',
                    border: '1px solid var(--border, #2a2e3d)',
                    borderRadius: '4px',
                    color: 'var(--text-primary, #fff)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={handleCreateChallenge}
              style={{
                padding: '7px 14px',
                background: 'var(--cyan, #00d4ff)',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              1. Generate Challenge
            </button>

            <button
              type="button"
              disabled={!challengeResult}
              onClick={handleSignChallenge}
              style={{
                padding: '7px 14px',
                background: challengeResult ? 'var(--bg-elevated, #1e2230)' : 'transparent',
                color: challengeResult ? 'var(--text-primary, #fff)' : 'var(--text-muted, #64748b)',
                border: '1px solid var(--border, #2a2e3d)',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: challengeResult ? 'pointer' : 'not-allowed',
              }}
            >
              2. Sign Challenge
            </button>

            <button
              type="button"
              disabled={!signedXDR}
              onClick={handleVerifyAndIssueToken}
              style={{
                padding: '7px 14px',
                background: signedXDR ? 'var(--emerald, #10b981)' : 'transparent',
                color: signedXDR ? '#000' : 'var(--text-muted, #64748b)',
                border: '1px solid var(--border, #2a2e3d)',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: signedXDR ? 'pointer' : 'not-allowed',
              }}
            >
              3. Verify & Issue Token
            </button>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '4px',
                color: '#ef4444',
                fontSize: '12px',
                marginBottom: '10px',
              }}
            >
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div
              aria-live="polite"
              style={{
                padding: '8px 12px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid #10b981',
                borderRadius: '4px',
                color: '#10b981',
                fontSize: '12px',
                marginBottom: '10px',
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Challenge details */}
          {challengeResult && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-secondary, #94a3b8)' }}>
              <div><strong>Server Signer:</strong> <span style={{ fontFamily: 'monospace' }}>{challengeResult.serverPublicKey.slice(0, 16)}...</span></div>
              <div><strong>Expires At:</strong> {challengeResult.expiresAt}</div>
              <div><strong>Nonce:</strong> <span style={{ fontFamily: 'monospace' }}>{challengeResult.nonce.slice(0, 24)}...</span></div>
            </div>
          )}

          {/* Issued Token details */}
          {tokenPayload && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--bg-elevated, #1e2230)',
                borderRadius: '4px',
                border: '1px solid var(--cyan, #00d4ff)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--cyan, #00d4ff)', marginBottom: '6px' }}>
                Issued SEP-0010 Bearer Token
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'var(--text-primary, #fff)',
                  wordBreak: 'break-all',
                  marginBottom: '8px',
                  maxHeight: '60px',
                  overflowY: 'auto',
                }}
              >
                {tokenPayload.token}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                <strong>HTTP Header:</strong>
                <pre
                  style={{
                    background: '#0d1117',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginTop: '4px',
                    color: '#58a6ff',
                    overflowX: 'auto',
                  }}
                >
                  {`Authorization: Bearer ${tokenPayload.token.slice(0, 32)}...`}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
