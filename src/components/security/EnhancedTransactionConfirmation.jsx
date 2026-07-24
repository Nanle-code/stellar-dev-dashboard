import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Mail, Copy } from 'lucide-react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORKS } from '../../lib/stellar';
import { RISK_LEVELS, verifyTransaction } from '../../lib/transactionVerification';

function AmountVerificationInput({ onVerify, correctAmount }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleVerify = () => {
    const inputNum = parseFloat(input);
    const correctNum = parseFloat(correctAmount);
    if (Math.abs(inputNum - correctNum) < 0.0000001) {
      onVerify(true);
    } else {
      setError('Amount does not match. Please try again.');
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Verify Amount (Type it exactly)
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="number"
          step="0.0000001"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError('');
          }}
          placeholder={`Enter ${correctAmount}`}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: 'var(--bg-base)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        <button
          onClick={handleVerify}
          style={{
            padding: '10px 20px',
            background: 'var(--cyan)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Verify
        </button>
      </div>
      {error && (
        <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '6px' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function CooldownTimer({ duration, onComplete }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [remaining, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '12px', background: 'var(--amber-glow)',
      border: '1px solid var(--amber)', borderRadius: 'var(--radius-md)',
      marginBottom: '16px'
    }}>
      <Clock size={20} style={{ color: 'var(--amber)' }} />
      <div style={{ fontSize: '13px', color: 'var(--amber)' }}>
        Cooldown period: {minutes}:{seconds.toString().padStart(2, '0')} remaining
      </div>
    </div>
  );
}

function EmailConfirmation({ email, onConfirm, onCancel }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = () => {
    // In a real app, this would send an email with a verification code
    // For demo purposes, we'll simulate it
    setSent(true);
  };

  const handleVerifyCode = () => {
    // Demo verification - accept any 6-digit code
    if (code.length === 6 && /^\d+$/.test(code)) {
      onConfirm();
    } else {
      setError('Please enter a valid 6-digit code');
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
        Email Confirmation
      </div>
      <div style={{
        padding: '12px', background: 'var(--cyan-glow)',
        border: '1px solid var(--cyan-dim)', borderRadius: 'var(--radius-md)',
        marginBottom: '12px', fontSize: '13px', color: 'var(--cyan)'
      }}>
        <Mail size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
        Verification code will be sent to: {email}
      </div>
      {!sent ? (
        <button
          onClick={handleSendCode}
          style={{
            width: '100%', padding: '10px 20px',
            background: 'var(--cyan)', color: 'var(--bg-base)',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Send Verification Code
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter 6-digit code"
            style={{
              width: '100%', padding: '10px 14px',
              background: 'var(--bg-base)',
              border: `1px solid ${error ? 'var(--red)' : 'var(--border-bright)'}`,
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '13px', fontFamily: 'var(--font-mono)',
              textAlign: 'center', letterSpacing: '4px', outline: 'none'
            }}
          />
          {error && <div style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '10px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px', cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyCode}
              style={{
                flex: 1, padding: '10px',
                background: 'var(--green)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EnhancedTransactionConfirmation({
  transactionXdr,
  network = 'testnet',
  preferences,
  onConfirm,
  onCancel,
  sourceAccount = null,
}) {
  const [step, setStep] = useState('review'); // review, verify_amount, cooldown, email_confirmation, ready
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [txDetails, setTxDetails] = useState(null);
  const [copied, setCopied] = useState(false);

  // Parse transaction and get details
  useEffect(() => {
    async function parseAndVerify() {
      setLoading(true);
      try {
        const tx = StellarSdk.TransactionBuilder.fromXDR(
          transactionXdr,
          NETWORKS[network]?.passphrase || NETWORKS.testnet.passphrase
        );
        setTxDetails(tx);

        const verResult = await verifyTransaction(transactionXdr, network, sourceAccount);
        setVerification(verResult);
      } catch (err) {
        console.error('Failed to parse transaction:', err);
      } finally {
        setLoading(false);
      }
    }

    if (transactionXdr) {
      parseAndVerify();
    }
  }, [transactionXdr, network, sourceAccount]);

  // Determine if transaction is large
  const isLargeTransaction = useCallback(() => {
    if (!txDetails || !txDetails.operations) return false;
    let totalAmount = 0;
    for (const op of txDetails.operations) {
      if (op.type === 'payment' && (!op.asset || op.asset.isNative())) {
        totalAmount += parseFloat(op.amount);
      } else if (op.type === 'createAccount') {
        totalAmount += parseFloat(op.startingBalance);
      }
      // Add other operation types as needed
    }
    return totalAmount >= preferences.transactionConfirmation.largeTransactionThreshold;
  }, [txDetails, preferences]);

  const getTotalAmount = useCallback(() => {
    if (!txDetails || !txDetails.operations) return '0';
    let totalAmount = 0;
    for (const op of txDetails.operations) {
      if (op.type === 'payment' && (!op.asset || op.asset.isNative())) {
        totalAmount += parseFloat(op.amount);
      } else if (op.type === 'createAccount') {
        totalAmount += parseFloat(op.startingBalance);
      }
    }
    return totalAmount.toFixed(7);
  }, [txDetails]);

  const handleContinue = () => {
    const large = isLargeTransaction();
    if (large) {
      setStep('verify_amount');
    } else if (preferences.transactionConfirmation.cooldownPeriod > 0) {
      setStep('cooldown');
    } else if (preferences.transactionConfirmation.requireEmailConfirmation) {
      setStep('email_confirmation');
    } else {
      setStep('ready');
    }
  };

  const handleAmountVerified = () => {
    if (preferences.transactionConfirmation.cooldownPeriod > 0) {
      setStep('cooldown');
    } else if (preferences.transactionConfirmation.requireEmailConfirmation) {
      setStep('email_confirmation');
    } else {
      setStep('ready');
    }
  };

  const handleCooldownComplete = () => {
    if (preferences.transactionConfirmation.requireEmailConfirmation) {
      setStep('email_confirmation');
    } else {
      setStep('ready');
    }
  };

  const handleEmailConfirmed = () => {
    setStep('ready');
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        textAlign: 'center'
      }}>
        <Shield size={32} style={{ color: 'var(--cyan)', marginBottom: '12px' }} />
        <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Preparing transaction confirmation...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={24} style={{ color: 'var(--cyan)' }} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              Confirm Transaction
            </div>
            {isLargeTransaction() && (
              <div style={{ fontSize: '12px', color: 'var(--amber)', marginTop: '4px' }}>
                <AlertTriangle size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                High-Value Transaction
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* Risk Badge */}
        {verification && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: verification.riskLevel === RISK_LEVELS.CRITICAL 
              ? 'var(--red-glow)' 
              : verification.riskLevel === RISK_LEVELS.HIGH 
                ? 'var(--amber-glow)' 
                : verification.riskLevel === RISK_LEVELS.MEDIUM 
                  ? 'rgba(234, 179, 8, 0.1)' 
                  : 'var(--green-glow)',
            border: `1px solid ${
              verification.riskLevel === RISK_LEVELS.CRITICAL 
                ? 'var(--red)' 
                : verification.riskLevel === RISK_LEVELS.HIGH 
                  ? 'var(--amber)' 
                  : verification.riskLevel === RISK_LEVELS.MEDIUM 
                    ? 'var(--amber)' 
                    : 'var(--green)'
            }`,
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px'
          }}>
            {verification.riskLevel === RISK_LEVELS.CRITICAL ? (
              <XCircle size={16} style={{ color: 'var(--red)' }} />
            ) : verification.riskLevel === RISK_LEVELS.HIGH ? (
              <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
            ) : verification.riskLevel === RISK_LEVELS.MEDIUM ? (
              <AlertTriangle size={16} style={{ color: 'var(--amber)' }} />
            ) : (
              <CheckCircle size={16} style={{ color: 'var(--green)' }} />
            )}
            <span style={{ 
              fontSize: '13px', fontWeight: 600,
              color: verification.riskLevel === RISK_LEVELS.CRITICAL 
                ? 'var(--red)' 
                : verification.riskLevel === RISK_LEVELS.HIGH 
                  ? 'var(--amber)' 
                  : verification.riskLevel === RISK_LEVELS.MEDIUM 
                    ? 'var(--amber)' 
                    : 'var(--green)'
            }}>
              {verification.riskLevel.charAt(0).toUpperCase() + verification.riskLevel.slice(1)} Risk
            </span>
          </div>
        )}

        {/* Transaction Details */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Transaction Details
          </div>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Source Account</span>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {txDetails?.source?.substring(0, 8)}…{txDetails?.source?.substring(txDetails.source.length - 8)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fee</span>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {txDetails?.fee} stroops
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Operations</span>
              <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                {txDetails?.operations?.length || 0}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Amount</span>
              <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
                {getTotalAmount()} XLM
              </span>
            </div>
          </div>
        </div>

        {/* XDR Preview */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Transaction XDR
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(transactionXdr);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: copied ? 'var(--green)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            maxHeight: '100px',
            overflowY: 'auto',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            wordBreak: 'break-all'
          }}>
            {transactionXdr}
          </div>
        </div>

        {/* Steps */}
        {step === 'review' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              style={{
                flex: 2,
                padding: '12px 20px',
                background: 'var(--cyan)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'verify_amount' && (
          <AmountVerificationInput 
            correctAmount={getTotalAmount()}
            onVerify={handleAmountVerified}
          />
        )}

        {step === 'cooldown' && (
          <CooldownTimer
            duration={preferences.transactionConfirmation.cooldownPeriod}
            onComplete={handleCooldownComplete}
          />
        )}

        {step === 'email_confirmation' && (
          <EmailConfirmation
            email={preferences.transactionConfirmation.confirmationEmail}
            onConfirm={handleEmailConfirmed}
            onCancel={onCancel}
          />
        )}

        {step === 'ready' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                flex: 2,
                padding: '12px 20px',
                background: 'var(--green)',
                color: 'var(--bg-base)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Confirm & Sign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
