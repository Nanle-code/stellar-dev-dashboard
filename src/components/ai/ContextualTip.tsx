import React, { useState, useEffect, useCallback } from 'react';
import { X, ThumbsUp, ThumbsDown, Settings, Sparkles } from 'lucide-react';
import { getAITips, dismissTip, recordTipFeedback, recordTipImpression, recordTipClick, type TipEntry, type TipContext } from '../../lib/aiTipEngine';
import { loadLearnerModel } from '../../lib/learnerModel';
import { getTipFrequency } from '../../lib/aiTipEngine';

interface ContextualTipProps {
  context: TipContext;
  onClose: () => void;
}

export default function ContextualTip({ context, onClose }: ContextualTipProps) {
  const [tips, setTips] = useState<TipEntry[]>([]);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(getTipFrequency());

  useEffect(() => {
    const model = loadLearnerModel();
    const relevantTips = getAITips(context, model, frequency);
    setTips(relevantTips);
    relevantTips.forEach(t => recordTipImpression(t.id));
  }, [context, frequency]);

  const handleDismiss = useCallback((tipId: string) => {
    dismissTip(tipId);
    setTips(prev => prev.filter(t => t.id !== tipId));
  }, []);

  const handleFeedback = useCallback((tipId: string, helpful: boolean) => {
    recordTipFeedback(tipId, helpful);
    const model = loadLearnerModel();
    const relevantTips = getAITips(context, model, frequency);
    setTips(relevantTips);
  }, [context, frequency]);

  const handleTipClick = useCallback((tipId: string) => {
    recordTipClick(tipId);
  }, []);

  if (!frequency.enabled || tips.length === 0) return null;

  const typeColors: Record<string, string> = {
    info: 'var(--cyan)', action: 'var(--amber)', warning: 'var(--red)', tip: 'var(--green)',
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 1060, maxWidth: '360px', width: '100%' }}>
      <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border, #334155)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="var(--accent, #6366f1)" />
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary, #f1f5f9)' }}>AI Contextual Tips</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Tip settings" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><Settings size={14} /></button>
            <button onClick={onClose} title="Close" aria-label="Close tips" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={14} /></button>
          </div>
        </div>
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {tips.map(tip => (
            <div key={tip.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #334155)', cursor: 'pointer' }} onClick={() => { handleTipClick(tip.id); setExpandedTip(expandedTip === tip.id ? null : tip.id); }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ marginTop: '2px', flexShrink: 0, color: typeColors[tip.type] || 'var(--text-muted)' }}><Sparkles size={14} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>{tip.title}</span>
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: `${typeColors[tip.type]}20`, color: typeColors[tip.type], fontWeight: 600, textTransform: 'uppercase' }}>{tip.type}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.5 }}>{tip.description}</p>
                  {tip.action && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--accent, #6366f1)', fontWeight: 600 }}>{"> "}{tip.action}</div>}
                  {expandedTip === tip.id && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button onClick={e => { e.stopPropagation(); handleFeedback(tip.id, true); }} title="Helpful" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--green)', fontSize: '11px' }}><ThumbsUp size={12} /> Helpful</button>
                      <button onClick={e => { e.stopPropagation(); handleFeedback(tip.id, false); }} title="Not helpful" style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'var(--red)', fontSize: '11px' }}><ThumbsDown size={12} /> Not helpful</button>
                    </div>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); handleDismiss(tip.id); }} title="Dismiss" aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}><X size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
