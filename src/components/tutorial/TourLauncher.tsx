import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  HelpCircle,
  Play,
  RotateCcw,
  Search,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import GuidedTour from './GuidedTour';
import tutorialSystem from '../../lib/tutorialSystem';

/**
 * TourLauncher — enhanced panel with categories, progress tracking, and achievements
 * Auto-starts the welcome tour for first-time visitors
 */
export default function TourLauncher() {
  const [activeTour, setActiveTour] = useState(null);
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAchievements, setShowAchievements] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [, forceUpdate] = useState(0);

  // Auto-start welcome tour for first-time visitors
  useEffect(() => {
    if (tutorialSystem.isFirstVisit()) {
      const timer = setTimeout(() => setActiveTour('welcome'), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const tours = tutorialSystem.getTours();
  const categories = ['all', ...tutorialSystem.getCategories()];
  const overallProgress = tutorialSystem.getOverallProgress();
  const achievements = tutorialSystem.getAchievements();
  const recommended = tutorialSystem.getRecommendedTour();
  const onboarding = tutorialSystem.getOnboardingStatus();
  const analytics = tutorialSystem.getAnalyticsSummary();
  const helpResults = helpQuery
    ? tutorialSystem.searchHelp(helpQuery)
    : tutorialSystem.getAllHelp().map((entry) => ({
        id: entry.title,
        type: 'help',
        title: entry.title,
        description: entry.content,
        learnMore: entry.learnMore,
      }));

  const filteredTours = selectedCategory === 'all' 
    ? tours 
    : tours.filter(t => t.category === selectedCategory);

  function handleReset(tourId, e) {
    e.stopPropagation();
    tutorialSystem.reset(tourId);
    forceUpdate(n => n + 1);
  }

  function handleStartTour(tourId) {
    tutorialSystem.dismissWelcome();
    setActiveTour(tourId);
    setOpen(false);
    setShowHelpCenter(false);
    setShowAnalytics(false);
  }

  function handleHelpQueryChange(query) {
    setHelpQuery(query);
    if (query.trim()) {
      const resultCount = tutorialSystem.searchHelp(query).length;
      tutorialSystem.recordHelpSearch(query, resultCount);
    }
  }

  const difficultyColors = {
    beginner: '#22c55e',
    intermediate: '#f59e0b',
    advanced: '#ef4444',
  };

  return (
    <>
      {/* Floating help button with progress ring */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Open tutorials"
        data-tour="tour-launcher"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 900,
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--accent, #6366f1)', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          color: '#fff',
        }}
      >
        <svg 
          style={{ position: 'absolute', top: '-4px', left: '-4px', transform: 'rotate(-90deg)' }}
          width="64" 
          height="64"
        >
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="rgba(99,102,241,0.2)"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            stroke="#22c55e"
            strokeWidth="3"
            fill="none"
            strokeDasharray={`${(overallProgress.percentage / 100) * 176} 176`}
            strokeLinecap="round"
          />
        </svg>
        <BookOpen size={20} />
      </button>

      {/* Tour panel */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 901 }} />
          <div
            style={{
              position: 'fixed', bottom: '90px', right: '24px', zIndex: 902,
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '16px', padding: '20px', width: '360px',
              maxHeight: '600px', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                  Advanced Onboarding
                </h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <IconButton label="Search help" onClick={() => setShowHelpCenter(true)} icon={HelpCircle} />
                  <IconButton label="View analytics" onClick={() => setShowAnalytics(true)} icon={BarChart3} />
                  <IconButton label="View achievements" onClick={() => setShowAchievements(!showAchievements)} icon={Trophy} />
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                    Overall Progress
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                    {overallProgress.completed}/{overallProgress.total} completed
                  </span>
                </div>
                <div style={{ 
                  height: '6px', 
                  background: 'var(--bg-secondary, #0f172a)', 
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${overallProgress.percentage}%`, 
                      background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                      transition: 'width 0.3s ease',
                    }} 
                  />
                </div>
              </div>

              {/* Progressive onboarding checklist */}
              <div style={{
                background: 'var(--bg-secondary, #0f172a)',
                border: '1px solid var(--border, #334155)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                      Onboarding checklist
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                      {onboarding.completed}/{onboarding.total} milestones complete
                    </div>
                  </div>
                  {onboarding.next && (
                    <button
                      onClick={() => handleStartTour(onboarding.next.tourId)}
                      style={{
                        background: 'var(--accent, #6366f1)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '6px 10px',
                      }}
                    >
                      Continue
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {onboarding.milestones.map((milestone) => (
                    <button
                      key={milestone.id}
                      onClick={() => handleStartTour(milestone.tourId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '8px',
                        padding: 0,
                        textAlign: 'left',
                      }}
                    >
                      <CheckCircle
                        size={15}
                        style={{
                          color: milestone.completed ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      />
                      <span>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                          {milestone.title}
                        </span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                          {milestone.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Achievements section */}
              {showAchievements && (
                <div style={{
                  background: 'var(--bg-secondary, #0f172a)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', marginBottom: '8px' }}>
                    🏆 Achievements
                  </div>
                  {achievements.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' }}>
                      Complete tutorials to earn achievements!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {achievements.map(ach => (
                        <div key={ach.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px',
                          background: 'var(--accent, #6366f1)15',
                          borderRadius: '6px',
                        }}>
                          <span style={{ fontSize: '18px' }}>{ach.icon}</span>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                              {ach.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                              {ach.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recommended tour */}
              {recommended && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--accent, #6366f1)20, var(--accent, #6366f1)10)',
                  border: '1px solid var(--accent, #6366f1)40',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-bright, #818cf8)', marginBottom: '4px' }}>
                    ⭐ Recommended Next
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' }}>
                        {recommended.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>
                        {recommended.estimatedTime} · {recommended.difficulty}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartTour(recommended.id)}
                      style={{
                        background: 'var(--accent, #6366f1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Play size={12} /> Start
                    </button>
                  </div>
                </div>
              )}

              {/* Category filter */}
              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                flexWrap: 'wrap',
              }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      background: selectedCategory === cat ? 'var(--accent, #6366f1)' : 'var(--bg-secondary, #0f172a)',
                      border: selectedCategory === cat ? 'none' : '1px solid var(--border, #334155)',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      color: selectedCategory === cat ? '#fff' : 'var(--text-secondary, #cbd5e1)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tour list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTours.map(tour => {
                const done = tutorialSystem.isCompleted(tour.id);
                const progress = tutorialSystem.getProgress(tour.id);
                const isLocked = tour.prerequisites && tour.prerequisites.length > 0 && 
                  !tour.prerequisites.every(prereq => tutorialSystem.isCompleted(prereq));

                return (
                  <div
                    key={tour.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'var(--bg-secondary, #0f172a)',
                      border: '1px solid var(--border, #334155)',
                      opacity: isLocked ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ fontSize: '24px', lineHeight: 1 }}>{tour.thumbnail}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          marginBottom: '4px',
                        }}>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 700, 
                            color: 'var(--text-primary, #f1f5f9)',
                          }}>
                            {tour.title}
                          </span>
                          {done && (
                            <span style={{ 
                              fontSize: '10px', 
                              background: '#22c55e22', 
                              color: '#22c55e', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}>
                              ✓ Done
                            </span>
                          )}
                          {isLocked && (
                            <span style={{ 
                              fontSize: '10px', 
                              background: '#94a3b822', 
                              color: '#94a3b8', 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}>
                              🔒 Locked
                            </span>
                          )}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: 'var(--text-muted, #94a3b8)',
                          marginBottom: '6px',
                        }}>
                          {tour.description}
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          fontSize: '11px',
                          color: 'var(--text-muted, #94a3b8)',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            {tour.estimatedTime}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={11} />
                            {tour.steps.length} steps
                          </span>
                          <span 
                            style={{ 
                              fontSize: '10px',
                              fontWeight: 600,
                              color: difficultyColors[tour.difficulty],
                              textTransform: 'capitalize',
                            }}
                          >
                            {tour.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar for incomplete tours */}
                    {!done && progress.percentage > 0 && (
                      <div>
                        <div style={{ 
                          height: '4px', 
                          background: 'var(--bg-card, #1e293b)', 
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}>
                          <div 
                            style={{ 
                              height: '100%', 
                              width: `${progress.percentage}%`, 
                              background: 'var(--accent, #6366f1)',
                              transition: 'width 0.3s ease',
                            }} 
                          />
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                          {progress.percentage}% complete
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {done && (
                        <button
                          onClick={(e) => handleReset(tour.id, e)}
                          title="Replay tour"
                          style={{ 
                            background: 'var(--bg-card, #1e293b)',
                            border: '1px solid var(--border, #334155)',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            cursor: 'pointer', 
                            color: 'var(--text-muted, #94a3b8)',
                            fontSize: '11px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RotateCcw size={11} /> Replay
                        </button>
                      )}

                      <button
                        onClick={() => handleStartTour(tour.id)}
                        disabled={isLocked}
                        style={{
                          background: isLocked ? 'var(--bg-card, #1e293b)' : 'var(--accent, #6366f1)', 
                          border: isLocked ? '1px solid var(--border, #334155)' : 'none',
                          borderRadius: '6px', 
                          padding: '5px 12px',
                          cursor: isLocked ? 'not-allowed' : 'pointer', 
                          color: isLocked ? 'var(--text-muted, #94a3b8)' : '#fff', 
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          flex: 1,
                          justifyContent: 'center',
                        }}
                      >
                        <Play size={11} /> {done ? 'Start Again' : 'Start Tutorial'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer actions */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border, #334155)' }}>
              <button
                onClick={() => { tutorialSystem.resetAll(); forceUpdate(n => n + 1); }}
                style={{
                  width: '100%', 
                  background: 'none',
                  border: '1px solid var(--border, #334155)', 
                  borderRadius: '8px',
                  padding: '8px', 
                  cursor: 'pointer', 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                Reset All Progress
              </button>
            </div>
          </div>
        </>
      )}

      {/* Active tour */}
      {activeTour && (
        <GuidedTour
          tourId={activeTour}
          onClose={() => {
            setActiveTour(null);
            forceUpdate(n => n + 1);
          }}
        />
      )}

      {showHelpCenter && (
        <HelpCenterModal
          query={helpQuery}
          results={helpResults}
          onQueryChange={handleHelpQueryChange}
          onClose={() => setShowHelpCenter(false)}
          onStartTour={handleStartTour}
        />
      )}

      {showAnalytics && (
        <AnalyticsModal
          analytics={analytics}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </>
  );
}

function IconButton({ label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted, #94a3b8)',
        padding: '4px',
        display: 'flex',
      }}
    >
      <Icon size={18} />
    </button>
  );
}

function HelpCenterModal({ query, results, onQueryChange, onClose, onStartTour }) {
  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalStyle, maxWidth: '720px' }}>
        <ModalHeader title="Search Help" subtitle="Find contextual help, feature tours, and tutorial topics." onClose={onClose} />
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #334155)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #94a3b8)',
              }}
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search public keys, fees, contracts, alerts..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                background: 'var(--bg-secondary, #0f172a)',
                border: '1px solid var(--border, #334155)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map((result) => (
              <div
                key={`${result.type}-${result.id}`}
                style={{
                  background: 'var(--bg-secondary, #0f172a)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-bright, #818cf8)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {result.type === 'tour' ? 'Guided tour' : 'Help article'}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary, #f1f5f9)', fontWeight: 700, marginTop: '4px' }}>
                      {result.title}
                    </div>
                  </div>
                  {result.type === 'tour' && (
                    <button onClick={() => onStartTour(result.tourId)} style={smallPrimaryButtonStyle}>
                      <Play size={12} /> Start
                    </button>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '12px', lineHeight: 1.5, margin: '8px 0 0' }}>
                  {result.description}
                </p>
                {result.learnMore && (
                  <a
                    href={result.learnMore}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-bright, #818cf8)', display: 'inline-flex', gap: '4px', alignItems: 'center', fontSize: '12px', marginTop: '8px' }}
                  >
                    Learn more <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ))}
            {results.length === 0 && (
              <div style={{ color: 'var(--text-muted, #94a3b8)', textAlign: 'center', padding: '32px' }}>
                No help topics matched your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsModal({ analytics, onClose }) {
  const dropOffEntries = Object.entries(analytics.dropOffPoints);

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalStyle, maxWidth: '620px' }}>
        <ModalHeader title="Onboarding Analytics" subtitle="Local completion, drop-off, and engagement metrics." onClose={onClose} />
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            <MetricCard label="Completion" value={`${analytics.onboarding.percentage}%`} />
            <MetricCard label="Tour starts" value={analytics.starts} />
            <MetricCard label="Completion rate" value={`${analytics.completionRate}%`} />
            <MetricCard label="Help searches" value={analytics.helpSearches} />
          </div>
          <div style={{ ...panelStyle, marginBottom: '12px' }}>
            <div style={panelTitleStyle}>Engagement</div>
            <p style={panelCopyStyle}>
              Average tutorial session: {formatDuration(analytics.averageEngagementMs)}. Skipped tours: {analytics.skips}.
            </p>
          </div>
          <div style={panelStyle}>
            <div style={panelTitleStyle}>Drop-off points</div>
            {dropOffEntries.length === 0 ? (
              <p style={panelCopyStyle}>No drop-off points recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dropOffEntries.map(([key, count]) => {
                  const [tourId, stepIndex] = key.split(':');
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary, #cbd5e1)', fontSize: '12px' }}>
                      <span>{tourId} step {Number(stepIndex) + 1}</span>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <div style={{ padding: '20px', borderBottom: '1px solid var(--border, #334155)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary, #f1f5f9)' }}>{title}</h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>{subtitle}</p>
      </div>
      <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94a3b8)', height: '28px' }}>
        <X size={20} />
      </button>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={panelStyle}>
      <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: 'var(--text-primary, #f1f5f9)', fontSize: '24px', fontWeight: 800, marginTop: '6px' }}>{value}</div>
    </div>
  );
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 10020,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const modalStyle = {
  background: 'var(--bg-card, #1e293b)',
  border: '1px solid var(--border, #334155)',
  borderRadius: '12px',
  width: '100%',
  maxHeight: '88vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
};

const panelStyle = {
  background: 'var(--bg-secondary, #0f172a)',
  border: '1px solid var(--border, #334155)',
  borderRadius: '10px',
  padding: '14px',
};

const panelTitleStyle = {
  color: 'var(--text-primary, #f1f5f9)',
  fontSize: '13px',
  fontWeight: 800,
};

const panelCopyStyle = {
  margin: '6px 0 0',
  color: 'var(--text-secondary, #cbd5e1)',
  fontSize: '12px',
  lineHeight: 1.5,
};

const smallPrimaryButtonStyle = {
  background: 'var(--accent, #6366f1)',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '6px 10px',
  height: '30px',
};
