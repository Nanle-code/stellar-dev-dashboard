import React from 'react';
import { X } from 'lucide-react';
import { getTipFrequency, updateTipFrequency, resetTipFrequency } from '../../lib/aiTipEngine';

interface Props { onClose: () => void; }

export default function TipFrequencySettings({ onClose }: Props) {
  const [freq, setFreq] = React.useState(getTipFrequency());
  const handleChange = (updates: Partial<typeof freq>) => { const updated = updateTipFrequency(updates); setFreq(updated); };

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1100, background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: '12px', padding: '20px', width: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Tip Frequency Settings</h3>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={14} /></button>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
          <input type="checkbox" checked={freq.enabled} onChange={() => handleChange({ enabled: !freq.enabled })} style={{ accentColor: 'var(--accent)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Enable AI Contextual Tips</span>
        </label>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Tip Frequency</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(["low", "medium", "high"] as const).map(level => (
              <button key={level} onClick={() => handleChange({ frequency: level })} style={{ flex: 1, background: freq.frequency === level ? "var(--accent)" : "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: freq.frequency === level ? "#fff" : "var(--text-secondary)", fontSize: "12px", fontWeight: 600, textTransform: "capitalize" }}>{level}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Tips shown every {freq.minInterval / 1000 / 60} mins at {freq.frequency} frequency.</div>
        <button onClick={() => { resetTipFrequency(); onClose(); }} style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Reset to Default</button>
      </div>
    </div>
  );
}
