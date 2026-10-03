import React, { Component, useState, useMemo, ErrorInfo, ReactNode } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { LayoutGrid, Columns, RefreshCw, AlertTriangle, Monitor } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  onError?: (_error: Error, _info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class LandscapeAnalyticsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, info);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-lg)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid var(--red)',
            color: 'var(--text-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--red)',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={18} />
            <span>{this.props.fallbackMessage || 'Landscape Chart Composition Error'}</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {this.state.error?.message ||
              'An error occurred while rendering the landscape analytics layout.'}
          </p>
          <button
            onClick={this.resetError}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Retry Landscape View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export interface LandscapeAnalyticsLayoutProps {
  /** Primary chart element or container */
  children?: ReactNode;
  /** Optional side panel (metrics, stat cards, or controls) shown side-by-side in landscape */
  sidePanel?: ReactNode;
  /** Optional array of chart elements to display side-by-side in landscape mode */
  charts?: ReactNode[];
  /** Mode: 'auto' adapts based on viewport, 'side-by-side' forces split, 'stacked' forces stacked */
  layoutMode?: 'auto' | 'side-by-side' | 'stacked';
  /** Title for the analytics section */
  title?: string;
  /** Subtitle or description */
  subtitle?: string;
  /** Max height for chart area in landscape mode */
  maxHeight?: string | number;
  /** Data object/array for automatic validity check */
  data?: any;
  /** Fallback message for invalid data or error state */
  fallbackMessage?: string;
  /** Callback on rendering error */
  onError?: (_error: Error, _info: ErrorInfo) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function LandscapeAnalyticsLayout({
  children,
  sidePanel,
  charts = [],
  layoutMode = 'auto',
  title,
  subtitle,
  maxHeight = 'min(360px, 55vh)',
  data,
  fallbackMessage = 'Unable to render analytics layout',
  onError,
  className = '',
  style = {},
}: LandscapeAnalyticsLayoutProps) {
  const { isLandscape, isTablet, isMobile, orientation, windowWidth } = useResponsive();
  const [viewOverride, setViewOverride] = useState<'auto' | 'side-by-side' | 'stacked'>('auto');

  // Input Validation
  const inputValidation = useMemo(() => {
    if (data === undefined) return { isValid: true };
    if (data === null) return { isValid: false, reason: 'Data is null' };
    if (typeof data === 'number' && (isNaN(data) || !isFinite(data))) {
      return { isValid: false, reason: 'Data is NaN or infinite' };
    }
    if (Array.isArray(data) && data.length === 0) {
      return { isValid: true, isDegenerate: true, reason: 'Dataset is empty' };
    }
    return { isValid: true };
  }, [data]);

  // Determine effective landscape active status
  const effectiveLayoutMode = viewOverride !== 'auto' ? viewOverride : layoutMode;
  const isLandscapeActive =
    effectiveLayoutMode === 'side-by-side' ||
    (effectiveLayoutMode === 'auto' && isLandscape && (isTablet || isMobile || windowWidth >= 600));

  const chartHeightStyle = isLandscapeActive
    ? typeof maxHeight === 'number'
      ? `${maxHeight}px`
      : maxHeight
    : undefined;

  return (
    <LandscapeAnalyticsErrorBoundary fallbackMessage={fallbackMessage} onError={onError}>
      <div
        className={`landscape-analytics-layout ${isLandscapeActive ? 'landscape-active' : 'portrait-active'} ${className}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          ...style,
        }}
        data-orientation={orientation}
        data-landscape-active={isLandscapeActive}
      >
        {/* Header & Controls */}
        {(title || isLandscapeActive || (isTablet && isLandscape)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              {title && (
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-primary)',
                  }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {subtitle}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLandscapeActive && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'var(--cyan-glow-sm)',
                    color: 'var(--cyan)',
                    border: '1px solid var(--cyan)',
                  }}
                >
                  <Monitor size={12} />
                  Tablet Landscape Composition
                </span>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  aria-label="Side-by-side view"
                  title="Side-by-side Landscape Composition"
                  onClick={() => setViewOverride('side-by-side')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background:
                      viewOverride === 'side-by-side' ||
                      (viewOverride === 'auto' && isLandscapeActive)
                        ? 'var(--bg-card)'
                        : 'transparent',
                    color:
                      viewOverride === 'side-by-side' ||
                      (viewOverride === 'auto' && isLandscapeActive)
                        ? 'var(--cyan)'
                        : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Columns size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Stacked view"
                  title="Stacked Portrait Composition"
                  onClick={() => setViewOverride('stacked')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background:
                      viewOverride === 'stacked' || (viewOverride === 'auto' && !isLandscapeActive)
                        ? 'var(--bg-card)'
                        : 'transparent',
                    color:
                      viewOverride === 'stacked' || (viewOverride === 'auto' && !isLandscapeActive)
                        ? 'var(--cyan)'
                        : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Validation Error */}
        {!inputValidation.isValid && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--amber)',
              color: 'var(--amber)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={16} />
            <span>
              {fallbackMessage}: {inputValidation.reason}
            </span>
          </div>
        )}

        {/* Main Content Layout */}
        {inputValidation.isValid && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isLandscapeActive
                ? sidePanel
                  ? 'minmax(0, 1.4fr) minmax(0, 1fr)'
                  : charts.length > 0
                    ? `repeat(${Math.min(charts.length + (children ? 1 : 0), 3)}, minmax(0, 1fr))`
                    : 'repeat(auto-fit, minmax(300px, 1fr))'
                : '1fr',
              gap: '16px',
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            {/* Primary Chart Container */}
            {children && (
              <div
                style={{
                  maxHeight: chartHeightStyle,
                  overflow: isLandscapeActive ? 'hidden' : 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                {children}
              </div>
            )}

            {/* Multiple Charts Side-by-Side */}
            {charts.map((chartItem, idx) => (
              <div
                key={idx}
                style={{
                  maxHeight: chartHeightStyle,
                  overflow: isLandscapeActive ? 'hidden' : 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                }}
              >
                {chartItem}
              </div>
            ))}

            {/* Side Panel (Metrics/Controls) */}
            {sidePanel && (
              <div
                style={{
                  maxHeight: isLandscapeActive ? chartHeightStyle : undefined,
                  overflowY: isLandscapeActive ? 'auto' : 'visible',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  width: '100%',
                }}
              >
                {sidePanel}
              </div>
            )}
          </div>
        )}
      </div>
    </LandscapeAnalyticsErrorBoundary>
  );
}

export default LandscapeAnalyticsLayout;
