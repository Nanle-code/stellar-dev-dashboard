import React, { useMemo, useState } from 'react';
import { BookOpen, Clock, TrendingUp, Star } from 'lucide-react';
import { loadLearnerModel, getCompetencyScore } from '../../lib/learnerModel';
import { getRecommendedTutorials, type ScoredTutorial } from '../../lib/tutorialRecommender';

interface TutorialRecommendationsProps {
  onStartTutorial?: (tourId: string) => void;
  maxRecommendations?: number;
}

export default function TutorialRecommendations({
  onStartTutorial,
  maxRecommendations = 3,
}: TutorialRecommendationsProps) {
  const [showAll, setShowAll] = useState(false);

  const recommendations = useMemo<ScoredTutorial[]>(() => {
    const model = loadLearnerModel();
    return getRecommendedTutorials(model, maxRecommendations + 3);
  }, [maxRecommendations]);

  const model = loadLearnerModel();
  const competencyScore = getCompetencyScore(model);
  const displayed = showAll ? recommendations : recommendations.slice(0, maxRecommendations);

  if (recommendations.length === 0 && model.completedTutorials.length > 0) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center',
      }}>
        <Star size={32} style={{ color: 'var(--green)', marginBottom: '8px' }} />
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          You've completed all available tutorials! Check back for new content.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={20} style={{ color: 'var(--cyan)' }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Recommended for You
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Competency: {competencyScore}%
        </div>
      </div>

      {displayed.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>
          Complete your onboarding to get personalized recommendations.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayed.map((rec) => (
            <button
              key={rec.tourId}
              onClick={() => onStartTutorial?.(rec.tourId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--cyan)';
                e.currentTarget.style.background = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}>
                {rec.category === 'Getting Started' ? '🚀' :
                 rec.category === 'Core Features' ? '💸' :
                 rec.category === 'Advanced' ? '📜' :
                 rec.category === 'Trading' ? '📊' :
                 rec.category === 'Analytics' ? '💰' :
                 rec.category === 'Monitoring' ? '🔔' :
                 rec.category === 'Security' ? '🔐' : '📚'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                  {rec.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={11} /> {rec.estimatedTime}
                  </span>
                  <span>{rec.difficulty}</span>
                  <span>{rec.category}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cyan)', marginTop: '4px' }}>
                  {rec.reason}
                </div>
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                color: rec.score > 50 ? 'var(--green)' : 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {rec.score}%
              </div>
            </button>
          ))}
        </div>
      )}

      {recommendations.length > maxRecommendations && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            marginTop: '12px',
            padding: '8px',
            width: '100%',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          {showAll ? 'Show fewer' : `Show all ${recommendations.length} recommendations`}
        </button>
      )}
    </div>
  );
}
