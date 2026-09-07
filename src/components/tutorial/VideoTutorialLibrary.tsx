import React, { useState } from 'react';
import { PlayCircle, ExternalLink, Clock, Zap, BookOpen, Search, Filter } from 'lucide-react';
import tutorialSystem from '../../lib/tutorialSystem';

/**
 * VideoTutorialLibrary — Browse and watch video tutorials
 * Provides a gallery view with filtering and search
 */
export default function VideoTutorialLibrary({ onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const tours = tutorialSystem.getTours();
  const categories = ['all', ...tutorialSystem.getCategories()];
  const difficulties = ['all', 'beginner', 'intermediate', 'advanced'];

  // Filter tours
  const filteredTours = tours.filter(tour => {
    const matchesSearch = searchQuery === '' || 
      tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tour.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || tour.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || tour.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const difficultyColors = {
    beginner: '#22c55e',
    intermediate: '#f59e0b',
    advanced: '#ef4444',
  };

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
        maxWidth: '900px',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #f1f5f9)' }}>
                📹 Video Tutorial Library
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                Watch step-by-step guides for all dashboard features
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

          {/* Search and filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ 
              flex: 1, 
              minWidth: '200px',
              position: 'relative',
            }}>
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
                type="text"
                placeholder="Search tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  background: 'var(--bg-secondary, #0f172a)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '8px',
                  color: 'var(--text-primary, #f1f5f9)',
                  fontSize: '13px',
                }}
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-secondary, #0f172a)',
                border: '1px solid var(--border, #334155)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            {/* Difficulty filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-secondary, #0f172a)',
                border: '1px solid var(--border, #334155)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {difficulties.map(diff => (
                <option key={diff} value={diff}>
                  {diff === 'all' ? 'All Levels' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Video grid */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {filteredTours.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: 'var(--text-muted, #94a3b8)',
            }}>
              <BookOpen size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No tutorials found matching your filters</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '16px',
            }}>
              {filteredTours.map(tour => {
                const isCompleted = tutorialSystem.isCompleted(tour.id);
                
                return (
                  <div
                    key={tour.id}
                    style={{
                      background: 'var(--bg-secondary, #0f172a)',
                      border: '1px solid var(--border, #334155)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Thumbnail */}
                    <div style={{
                      position: 'relative',
                      aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, var(--accent, #6366f1), var(--accent-bright, #818cf8))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{ fontSize: '64px' }}>{tour.thumbnail}</div>
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.6)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#fff',
                        fontWeight: 600,
                      }}>
                        {tour.estimatedTime}
                      </div>
                      {isCompleted && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: '#22c55e',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#fff',
                          fontWeight: 600,
                        }}>
                          ✓ Completed
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseOut={(e) => e.currentTarget.style.opacity = '0'}
                      >
                        <PlayCircle size={48} style={{ color: '#fff' }} />
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '12px' }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-primary, #f1f5f9)',
                        marginBottom: '6px',
                      }}>
                        {tour.title}
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-muted, #94a3b8)',
                        margin: '0 0 10px',
                        lineHeight: 1.4,
                      }}>
                        {tour.description}
                      </p>

                      {/* Meta info */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-muted, #94a3b8)',
                        marginBottom: '10px',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={11} />
                          {tour.steps.length} steps
                        </span>
                        <span
                          style={{
                            color: difficultyColors[tour.difficulty],
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {tour.difficulty}
                        </span>
                      </div>

                      {/* Watch button */}
                      <a
                        href={tour.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px',
                          background: 'var(--accent, #6366f1)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 600,
                          width: '100%',
                        }}
                      >
                        <PlayCircle size={14} />
                        Watch Video
                        <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border, #334155)',
          background: 'var(--bg-secondary, #0f172a)',
          textAlign: 'center',
        }}>
          <p style={{
            margin: 0,
            fontSize: '12px',
            color: 'var(--text-muted, #94a3b8)',
          }}>
            Found {filteredTours.length} tutorial{filteredTours.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
