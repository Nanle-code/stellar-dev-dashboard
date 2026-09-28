import React, { useState, useCallback } from 'react';
import { Gauge, Zap, Turtle, Timer } from 'lucide-react';
import type { LearningPace } from '../../lib/learnerModel';
import { loadLearnerModel, saveLearnerModel, analyzePace } from '../../lib/learnerModel';
import { getPaceLabel } from '../../lib/learningPath';

interface PaceAdjusterProps {
  onPaceChange?: (pace: LearningPace) => void;
}

const paceIcons: Record<LearningPace, React.ReactNode> = {
  slow: <Turtle size={20} />,
  moderate: <Timer size={20} />,
  fast: <Zap size={20} />,
};

const paceColors: Record<LearningPace, string> = {
  slow: 'var(--green)',
  moderate: 'var(--cyan)',
  fast: 'var(--orange)',
};

export default function PaceAdjuster({ onPaceChange }: PaceAdjusterProps) {
  const model = loadLearnerModel();
  const [selectedPace, setSelectedPace] = useState<LearningPace>(
    analyzePace(model),
  );

  const handlePaceChange = useCallback((pace: LearningPace) => {
    setSelectedPace(pace);
    const updated = loadLearnerModel();
    updated.currentPace = pace;
    saveLearnerModel(updated);
    onPaceChange?.(pace);
  }, [onPaceChange]);

  const paces: { id: LearningPace; label: string; description: string }[] = [
    {
      id: 'slow',
      label: 'Relaxed',
      description: 'Thorough explanations, more practice exercises',
    },
    {
      id: 'moderate',
      label: 'Balanced',
      description: 'Steady pace with regular checkpoints',
    },
    {
      id: 'fast',
      label: 'Accelerated',
      description: 'Skip basics, focus on advanced topics',
    },
  ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Gauge size={20} style={{ color: 'var(--cyan)' }} />
        <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Learning Pace
        </span>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        {getPaceLabel(selectedPace)}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {paces.map((pace) => (
          <button
            key={pace.id}
            onClick={() => handlePaceChange(pace.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px',
              borderRadius: '10px',
              border: selectedPace === pace.id
                ? `2px solid ${paceColors[pace.id]}`
                : '1px solid var(--border)',
              background: selectedPace === pace.id ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: selectedPace === pace.id ? `${paceColors[pace.id]}20` : 'var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: paceColors[pace.id],
              flexShrink: 0,
            }}>
              {paceIcons[pace.id]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{pace.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{pace.description}</div>
            </div>
            {selectedPace === pace.id && (
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: paceColors[pace.id],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
              }}>
                ✓
              </div>
            )}
          </button>
        ))}
      </div>

      <p style={{
        marginTop: '12px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        marginBottom: 0,
      }}>
        The system will adapt tutorial recommendations to match your selected pace.
      </p>
    </div>
  );
}
