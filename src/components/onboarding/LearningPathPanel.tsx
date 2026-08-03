import React, { useMemo, useState } from 'react';
import { CheckCircle, Circle, Lock, TrendingUp, Clock, Route } from 'lucide-react';
import { loadLearnerModel } from '../../lib/learnerModel';
import { generateLearningPath, getPaceLabel, adaptLearningPath } from '../../lib/learningPath';
import type { LearningPath } from '../../lib/learningPath';

interface LearningPathPanelProps {
  onStartTutorial?: (tourId: string) => void;
}

export default function LearningPathPanel({ onStartTutorial }: LearningPathPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const path = useMemo<LearningPath>(() => {
    const model = loadLearnerModel();
    const generated = generateLearningPath(model);
    return adaptLearningPath(generated, model);
  }, []);

  const completedCount = path.steps.filter((s) => s.completed).length;
  const progress = path.steps.length > 0
    ? Math.round((completedCount / path.steps.length) * 100)
    : 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'none',
          border: 'none',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Route size={20} style={{ color: 'var(--cyan)' }} />
          <span style={{ fontSize: '16px', fontWeight: 600 }}>{path.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {completedCount}/{path.steps.length}
          </span>
          <TrendingUp size={16} style={{ color: progress >= 80 ? 'var(--green)' : 'var(--cyan)' }} />
        </div>
      </button>

      <div style={{
        marginTop: '12px',
        height: '6px',
        background: 'var(--bg-elevated)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--cyan)',
          borderRadius: '3px',
          transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {path.estimatedTotalTime}
        </span>
        <span>{getPaceLabel(path.pace)}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {path.steps.map((step) => (
            <button
              key={step.tourId}
              onClick={() => !step.locked && onStartTutorial?.(step.tourId)}
              disabled={step.locked}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: step.completed ? '1px solid var(--border)' : step.locked ? '1px solid var(--border)' : '1px solid var(--cyan)',
                background: step.completed ? 'var(--bg-elevated)' : step.locked ? 'var(--bg-base)' : 'var(--bg-card)',
                color: step.locked ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: step.locked ? 'not-allowed' : 'pointer',
                opacity: step.locked ? 0.6 : 1,
                textAlign: 'left',
                width: '100%',
              }}
            >
              {step.completed ? (
                <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0 }} />
              ) : step.locked ? (
                <Lock size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              ) : (
                <Circle size={18} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {step.order}. {step.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {step.difficulty} &middot; {step.estimatedTime} &middot; {step.category}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
