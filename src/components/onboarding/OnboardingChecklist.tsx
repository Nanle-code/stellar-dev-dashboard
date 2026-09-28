import React, { useState } from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

export interface ChecklistState {
  walletConnected: boolean;
  faucetFunded: boolean;
  firstTxSent: boolean;
}

export default function OnboardingChecklist({ 
  state, 
  onAction 
}: { 
  state: ChecklistState, 
  onAction: (step: keyof ChecklistState) => Promise<void> | void 
}) {
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (step: keyof ChecklistState) => {
    try {
      setError(null);
      await onAction(step);
    } catch (e: any) {
      setError(e.message || 'Action failed');
    }
  };

  return (
    <div className="onboarding-checklist" style={{ padding: '1.5rem', background: 'var(--surface-color, #1e1e1e)', borderRadius: '8px' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        Developer Quickstart
      </h3>
      {error && (
        <div data-testid="checklist-error" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {state.walletConnected ? <CheckCircle color="#22c55e" data-testid="icon-wallet-done" /> : <Circle color="#9ca3af" />}
          <div style={{ flex: 1 }}>
            <strong style={{ color: state.walletConnected ? '#22c55e' : 'inherit' }}>Connect Wallet</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>Link Freighter to sign transactions.</p>
          </div>
          {!state.walletConnected && <button onClick={() => handleAction('walletConnected')} data-testid="btn-wallet">Connect</button>}
        </li>
        <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {state.faucetFunded ? <CheckCircle color="#22c55e" data-testid="icon-faucet-done" /> : <Circle color="#9ca3af" />}
          <div style={{ flex: 1 }}>
            <strong style={{ color: state.faucetFunded ? '#22c55e' : 'inherit' }}>Fund via Testnet Faucet</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>Get free XLM to test your apps.</p>
          </div>
          {!state.faucetFunded && <button onClick={() => handleAction('faucetFunded')} disabled={!state.walletConnected} data-testid="btn-faucet">Fund</button>}
        </li>
        <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {state.firstTxSent ? <CheckCircle color="#22c55e" data-testid="icon-tx-done" /> : <Circle color="#9ca3af" />}
          <div style={{ flex: 1 }}>
            <strong style={{ color: state.firstTxSent ? '#22c55e' : 'inherit' }}>Send First Transaction</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>Build and submit a payment.</p>
          </div>
          {!state.firstTxSent && <button onClick={() => handleAction('firstTxSent')} disabled={!state.faucetFunded} data-testid="btn-tx">Send</button>}
        </li>
      </ul>
    </div>
  );
}
