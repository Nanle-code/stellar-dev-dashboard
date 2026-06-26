import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import TourTooltip from './TourTooltip';
import tutorialSystem from '../../lib/tutorialSystem';

/**
 * GuidedTour — renders a spotlight overlay + tooltip for each step.
 *
 * Props:
 *   tourId   string   — key from TOURS in tutorialSystem
 *   onClose  fn       — called when tour ends or is skipped
 */
export default function GuidedTour({ tourId, onClose }) {
  const tour = tutorialSystem.getTour(tourId);
  const [stepIndex, setStepIndex] = useState(() => tutorialSystem.getSavedStep(tourId));
  const [targetRect, setTargetRect] = useState(null);

  const step = tour?.steps[stepIndex];

  // Start timer when tour begins
  useEffect(() => {
    if (tour) {
      tutorialSystem.startTimer(tourId);
      return () => tutorialSystem.stopTimer(tourId);
    }
  }, [tour, tourId]);

  // Find and highlight the target element
  useEffect(() => {
    if (!step?.target) return;

    const el = document.querySelector(step.target);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [step]);

  const handleNext = useCallback(() => {
    if (stepIndex < tour.steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      tutorialSystem.saveStep(tourId, next);
    } else {
      tutorialSystem.complete(tourId);
      tutorialSystem.saveStep(tourId, 0);
      onClose?.();
    }
  }, [stepIndex, tour, tourId, onClose]);

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) {
      const prev = stepIndex - 1;
      setStepIndex(prev);
      tutorialSystem.saveStep(tourId, prev);
    }
  }, [stepIndex, tourId]);

  const handleSkip = useCallback(() => {
    tutorialSystem.skip(tourId, stepIndex);
    onClose?.();
  }, [tourId, stepIndex, onClose]);

  if (!tour || !step) return null;

  const tooltipPosition = computeTooltipPosition(targetRect, step.placement);

  return createPortal(
    <>
      {/* Backdrop with spotlight cutout */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      />
      {/* Spotlight highlight */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            zIndex: 10000,
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            border: '2px solid var(--accent, #6366f1)',
            pointerEvents: 'none',
            animation: 'spotlightPulse 2s ease-in-out infinite',
          }}
        />
      )}
      {/* Tooltip */}
      <TourTooltip
        step={step}
        stepIndex={stepIndex}
        totalSteps={tour.steps.length}
        position={tooltipPosition}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        tour={tour}
      />
      <style>{`
        @keyframes spotlightPulse {
          0%, 100% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.4);
          }
          50% {
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(99,102,241,0.6);
          }
        }
      `}</style>
    </>,
    document.body
  );
}

function computeTooltipPosition(rect, placement = 'bottom') {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const gap = 16;
  const tooltipW = 320;

  switch (placement) {
    case 'right':
      return { top: rect.top, left: rect.right + gap };
    case 'left':
      return { top: rect.top, left: rect.left - tooltipW - gap };
    case 'top':
      return { top: rect.top - gap - 200, left: Math.max(8, rect.left) };
    case 'bottom':
    default:
      return { top: rect.bottom + gap, left: Math.max(8, rect.left) };
  }
}
