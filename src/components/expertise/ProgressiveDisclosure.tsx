/**
 * ProgressiveDisclosure — Conditional rendering wrapper based on user expertise level.
 *
 * Use this component to progressively disclose features:
 *  - novices see a simplified/guided version
 *  - intermediates see the standard version
 *  - experts see the full version with all options
 *
 * Usage:
 * ```tsx
 * <ProgressiveDisclosure
 *   featureId="contracts"
 *   simplified={<SimplifiedContractsPanel />}
 *   standard={<ContractsPanel />}
 *   detailed={<AdvancedContractsPanel />}
 *   lockedMessage="Connect a wallet to explore contracts"
 * >
 *   <DefaultContractsPanel />
 * </ProgressiveDisclosure>
 * ```
 */

import React, { type ReactNode } from 'react';
import { useAdaptiveComponents } from '../../hooks/useAdaptiveComponents';
import { Lock } from 'lucide-react';

export interface ProgressiveDisclosureProps {
  /** The feature identifier used for visibility lookup */
  featureId: string;
  /** Simplified content shown to novice users */
  simplified?: ReactNode;
  /** Standard content shown to intermediate users */
  standard?: ReactNode;
  /** Detailed content shown to expert users */
  detailed?: ReactNode;
  /** Fallback children (used if no specific mode children provided) */
  children?: ReactNode;
  /** Message to show when feature is locked (below min level) */
  lockedMessage?: string;
  /** Title for locked state */
  lockedTitle?: string;
  /** Icon for locked state */
  lockedIcon?: ReactNode;
  /** Optional CSS class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

export default function ProgressiveDisclosure({
  featureId,
  simplified,
  standard,
  detailed,
  children,
  lockedMessage = 'This feature is available as you gain more experience with the dashboard.',
  lockedTitle = 'Feature Locked',
  lockedIcon,
  className = '',
  style = {},
}: ProgressiveDisclosureProps) {
  const { getAdaptation, dashboardViewMode } = useAdaptiveComponents();

  const adaptation = getAdaptation(featureId);

  // If feature is not visible at this level, show locked state
  if (!adaptation.visible) {
    return (
      <div
        className={`progressive-disclosure-locked ${className}`}
        style={{
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          minHeight: '200px',
          background: 'var(--bg-card)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          gap: '12px',
          ...style,
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            color: 'var(--text-muted)',
          }}
        >
          {lockedIcon || <Lock size={20} />}
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          {lockedTitle}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-muted)',
            maxWidth: '360px',
            lineHeight: 1.5,
          }}
        >
          {lockedMessage}
        </p>
        {adaptation.showGuidance && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              background: 'var(--cyan-glow-sm)',
              border: '1px solid var(--cyan-dim)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              color: 'var(--cyan)',
            }}
          >
            💡 Tip: Explore more dashboard features to unlock this section
          </div>
        )}
      </div>
    );
  }

  // Determine which content to render based on view mode
  let content: ReactNode = children;

  if (dashboardViewMode === 'simplified' && simplified) {
    content = simplified;
  } else if (dashboardViewMode === 'standard' && standard) {
    content = standard;
  } else if (dashboardViewMode === 'detailed' && detailed) {
    content = detailed;
  }

  // Wrap with guidance if needed
  return (
    <div
      className={`progressive-disclosure-content ${className}`}
      style={style}
    >
      {adaptation.showGuidance && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px 14px',
            background: 'var(--cyan-glow-sm)',
            border: '1px solid var(--cyan-dim)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            color: 'var(--cyan)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>💡</span>
          <span>Guidance available for this feature</span>
        </div>
      )}
      {content}
    </div>
  );
}

/**
 * Simplified helper that renders children only if the user has access to a feature.
 * Like ProgressiveDisclosure but without locked states — just show/hide.
 */
export function FeatureGuard({
  featureId,
  children,
  fallback = null,
}: {
  featureId: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { getAdaptation } = useAdaptiveComponents();
  const adaptation = getAdaptation(featureId);

  if (!adaptation.visible) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

