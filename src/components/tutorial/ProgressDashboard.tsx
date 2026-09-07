import React from 'react';
import { Trophy, Target, Clock, TrendingUp, Award, CheckCircle } from 'lucide-react';
import tutorialSystem from '../../lib/tutorialSystem';

/**
 * ProgressDashboard — Displays user's learning progress and achievements
 */
export default function ProgressDashboard({ onClose }) {
  const tours = tutorialSystem.getTours();
  const overallProgress = tutorialSystem.getOverallProgress();
  const achievements = tutorialSystem.getAchievements();
  const categories = tutorialSystem.getCategories();

  // Calculate category progress
  const categoryProgress = categories.map(category => {
    const categoryTours = tutorialSystem.getToursByCategory(category);
    const completed = categoryTours.filter(t => tutorialSystem.isCompleted(t.id)).length;
    return {
      category,
      completed,
      total: categoryTours.length,
      percentage: Math.round((completed / categoryTours.length) * 100),
    };
  });

  // Calculate total time spent
  const totalTime = tours.reduce((acc, tour) => {
    return acc + tutorialSystem.getDuration(tour.id);
  }, 0);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const completedTours = tours.filter(t => tutorialSystem.isCompleted(t.id));

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border, #334155)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border, #334155)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                🎯 Learning Progress
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                Track your tutorial completion and achievements
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: 'var(--text-muted, #94a3b8)',
                padding: '4px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '24px',
          }}>
            {/* Overall completion */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f120, #6366f110)',
              border: '1px solid var(--accent, #6366f1)30',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Target size={18} style={{ color: 'var(--accent, #6366f1)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
                  Completion
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                {overallProgress.percentage}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                {overallProgress.completed} of {overallProgress.total} tutorials
              </div>
            </div>

            {/* Achievements */}
            <div style={{
              background: 'linear-gradient(135deg, #22c55e20, #22c55e10)',
              border: '1px solid #22c55e30',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Trophy size={18} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
                  Achievements
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                {achievements.length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                {Object.keys(tutorialSystem.checkAchievements()).length} total available
              </div>
            </div>

            {/* Time spent */}
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b20, #f59e0b10)',
              border: '1px solid #f59e0b30',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Clock size={18} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>
                  Time Spent
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                {formatDuration(totalTime)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                learning time
              </div>
            </div>
          </div>

          {/* Achievements section */}
          {achievements.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Award size={18} />
                Earned Achievements
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {achievements.map(ach => (
                  <div
                    key={ach.id}
                    style={{
                      background: 'var(--bg-secondary, #0f172a)',
                      border: '1px solid var(--border, #334155)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '32px' }}>{ach.icon}</div>
                    <div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-primary, #f1f5f9)',
                        marginBottom: '2px',
                      }}>
                        {ach.title}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted, #94a3b8)',
                        lineHeight: 1.4,
                      }}>
                        {ach.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category progress */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <TrendingUp size={18} />
              Progress by Category
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {categoryProgress.map(cat => (
                <div
                  key={cat.category}
                  style={{
                    background: 'var(--bg-secondary, #0f172a)',
                    border: '1px solid var(--border, #334155)',
                    borderRadius: '12px',
                    padding: '14px',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #f1f5f9)',
                    }}>
                      {cat.category}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted, #94a3b8)',
                    }}>
                      {cat.completed}/{cat.total}
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    background: 'var(--bg-card, #1e293b)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${cat.percentage}%`,
                        background: cat.percentage === 100 
                          ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                          : 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-bright, #818cf8))',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed tutorials */}
          {completedTours.length > 0 && (
            <div>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <CheckCircle size={18} />
                Completed Tutorials
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {completedTours.map(tour => {
                  const duration = tutorialSystem.getDuration(tour.id);
                  return (
                    <div
                      key={tour.id}
                      style={{
                        background: 'var(--bg-secondary, #0f172a)',
                        border: '1px solid var(--border, #334155)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontSize: '24px' }}>{tour.thumbnail}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary, #f1f5f9)',
                        }}>
                          {tour.title}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-muted, #94a3b8)',
                        }}>
                          {tour.category} · {tour.steps.length} steps
                        </div>
                      </div>
                      {duration > 0 && (
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-muted, #94a3b8)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <Clock size={11} />
                          {formatDuration(duration)}
                        </div>
                      )}
                      <CheckCircle size={16} style={{ color: '#22c55e' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
