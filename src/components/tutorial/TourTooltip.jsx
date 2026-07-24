import React from 'react';
import { ChevronRight, ChevronLeft, X, PlayCircle, ExternalLink, CheckCircle } from 'lucide-react';

/**
 * TourTooltip — enhanced tooltip with progress, actions, and video support
 *
 * Props:
 *   step         object   — current step data
 *   stepIndex    number   — 0-based index
 *   totalSteps   number
 *   position     object   — { top, left } position
 *   onNext       fn
 *   onPrev       fn
 *   onSkip       fn
 *   tour         object   — tour metadata for video link
 */
export default function TourTooltip({ 
  step, 
  stepIndex, 
  totalSteps, 
  position, 
  onNext, 
  onPrev, 
  onSkip,
  tour 
}) {
  const progress = Math.round(((stepIndex + 1) / totalSteps) * 100);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <div
      role="dialog"
      aria-label={`Tour step: ${step.title}`}
      style={{
        position: 'fixed',
        zIndex: 10001,
        ...position,
        width: '320px',
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border, #334155)',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        padding: '0',
        pointerEvents: 'all',
        animation: 'tooltipSlideIn 0.3s ease-out',
      }}
    >
      {/* Progress bar */}
      <div style={{ 
        height: '3px', 
        background: 'var(--bg-secondary, #0f172a)', 
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden',
      }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${progress}%`, 
            background: 'linear-gradient(90deg, var(--accent, #6366f1), var(--accent-bright, #818cf8))',
            transition: 'width 0.3s ease',
          }} 
        />
      </div>

      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '10px', 
              color: 'var(--text-muted, #94a3b8)', 
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}>
              Step {stepIndex + 1} of {totalSteps}
            </div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '15px', 
              fontWeight: 700,
              color: 'var(--text-primary, #f1f5f9)',
            }}>
              {step.title}
            </h3>
          </div>
          <button
            onClick={onSkip}
            aria-label="Close tour"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <p style={{ 
          margin: '0 0 12px', 
          fontSize: '13px', 
          lineHeight: 1.6,
          color: 'var(--text-secondary, #cbd5e1)',
        }}>
          {step.content}
        </p>

        {/* Interactive hint */}
        {step.interactiveHint && (
          <div style={{
            background: 'var(--accent, #6366f1)15',
            border: '1px solid var(--accent, #6366f1)30',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '12px',
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 600,
              color: 'var(--accent-bright, #818cf8)',
              marginBottom: '4px',
            }}>
              💡 Pro Tip
            </div>
            <div style={{ 
              fontSize: '12px',
              color: 'var(--text-secondary, #cbd5e1)',
              lineHeight: 1.5,
            }}>
              {step.interactiveHint}
            </div>
          </div>
        )}

        {/* Action hint */}
        {step.action && (
          <div style={{
            background: 'var(--bg-secondary, #0f172a)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '12px',
            borderLeft: '3px solid var(--accent, #6366f1)',
          }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 600,
              color: 'var(--text-muted, #94a3b8)',
              marginBottom: '4px',
            }}>
              Try it now:
            </div>
            <div style={{ 
              fontSize: '12px',
              color: 'var(--text-primary, #f1f5f9)',
              fontWeight: 500,
            }}>
              {step.action}
            </div>
          </div>
        )}

        {/* Video link (show on first step) */}
        {isFirstStep && tour?.videoUrl && (
          <a
            href={tour.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'var(--bg-secondary, #0f172a)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '8px',
              color: 'var(--text-primary, #f1f5f9)',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
              marginBottom: '12px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent, #6366f1)';
              e.currentTarget.style.background = 'var(--accent, #6366f1)15';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border, #334155)';
              e.currentTarget.style.background = 'var(--bg-secondary, #0f172a)';
            }}
          >
            <PlayCircle size={14} />
            Watch Video Tutorial
            <ExternalLink size={12} style={{ marginLeft: 'auto' }} />
          </a>
        )}

        {/* Navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={onPrev}
            disabled={isFirstStep}
            style={{
              background: 'var(--bg-secondary, #0f172a)',
              border: '1px solid var(--border, #334155)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: isFirstStep ? 'not-allowed' : 'pointer',
              opacity: isFirstStep ? 0.5 : 1,
              color: 'var(--text-secondary, #cbd5e1)',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flex: 1,
            }}
          >
            <ChevronLeft size={14} />
            Back
          </button>

          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Skip tour
          </button>

          <button
            onClick={onNext}
            style={{
              background: 'var(--accent, #6366f1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            {isLastStep ? (
              <>
                <CheckCircle size={14} />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes tooltipSlideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
