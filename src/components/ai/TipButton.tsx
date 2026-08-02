import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { loadLearnerModel } from '../../lib/learnerModel';
import { getAITips, getTipFrequency } from '../../lib/aiTipEngine';
import ContextualTip from './ContextualTip';
import TipFrequencySettings from './TipFrequencySettings';
import { useStore } from '../../lib/store';

export default function TipButton() {
  const { activeTab, network, connectedAddress } = useStore();
  const [tipOpen, setTipOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const frequency = getTipFrequency();

  if (!frequency.enabled) return null;

  const context = {
    activeTab,
    network,
    connectedAddress,
    userActions: [],
    currentRoute: window.location.pathname,
    timeOnPage: 0,
  };

  const model = loadLearnerModel();
  const tipCount = getAITips(context, model, frequency).length;

  return (
    <>
      <button
        onClick={() => setTipOpen(!tipOpen)}
        aria-label="Open AI contextual tips"
        title={tipCount > 0 ? `AI Tips (${tipCount} available)` : 'AI Tips'}
        style={{
          position: 'fixed', bottom: '24px', left: '24px', zIndex: 1050,
          width: '44px', height: '44px', borderRadius: '50%',
          background: tipCount > 0 ? 'var(--accent, #6366f1)' : 'var(--bg-card, #1e293b)',
          border: tipCount > 0 ? '2px solid var(--accent, #6366f1)' : '1px solid var(--border, #334155)',
          cursor: 'pointer', color: tipCount > 0 ? '#fff' : 'var(--text-muted, #94a3b8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: tipCount > 0 ? '0 4px 16px rgba(99,102,241,0.4)' : '0 4px 12px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
        }}
      >
        <Sparkles size={18} />
        {tipCount > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            background: 'var(--red)', color: '#fff', borderRadius: '50%',
            width: '20px', height: '20px', fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{tipCount}</span>
        )}
      </button>
      {tipOpen && (
        <>
          <div onClick={() => setTipOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1059 }} />
          <ContextualTip context={context} onClose={() => setTipOpen(false)} />
        </>
      )}
      {settingsOpen && (
        <>
          <div onClick={() => setSettingsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1059 }} />
          <TipFrequencySettings onClose={() => setSettingsOpen(false)} />
        </>
      )}
    </>
  );
}
