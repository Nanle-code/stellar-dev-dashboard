import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { announceToScreenReader } from '../../utils/accessibility';
import { handleGlobalError } from '../../utils/errorHandler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RouteErrorBoundary');

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  routeName?: string;
  routePath?: string;
  onRetry?: () => Promise<void> | void;
  onNavigateHome?: () => void;
  maxRetries?: number;
}

export interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  diagnosticId: string | null;
  retryCount: number;
  copied: boolean;
}

/**
 * Generate a deterministic or randomized diagnostic tracking identifier.
 */
export function generateDiagnosticId(route = 'ROUTE', timestamp = Date.now()): string {
  const cleanRoute = (route || 'ROUTE').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
  const timeCode = timestamp.toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERR-${cleanRoute || 'ROUTE'}-${timeCode}-${randomSuffix}`;
}

export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      diagnosticId: null,
      retryCount: 0,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return {
      hasError: true,
      error,
      diagnosticId: generateDiagnosticId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const diagnosticId = this.state.diagnosticId || generateDiagnosticId(this.props.routeName);
    this.setState({ diagnosticId });

    handleGlobalError(error, `RouteErrorBoundary [${this.props.routeName || this.props.routePath || 'Unknown'}]`, {
      componentStack: errorInfo.componentStack,
      routePath: this.props.routePath,
      diagnosticId,
    });

    logger.error('Route-level error captured', {
      diagnosticId,
      routeName: this.props.routeName,
      routePath: this.props.routePath,
      message: error?.message,
    });

    announceToScreenReader(
      `An error occurred while loading the ${this.props.routeName || 'current'} view. Diagnostic reference: ${diagnosticId}`
    );
  }

  handleRetry = async (): Promise<void> => {
    const { maxRetries = 2, onRetry } = this.props;
    const nextRetry = this.state.retryCount + 1;

    if (nextRetry > maxRetries) {
      return;
    }

    this.setState({ retryCount: nextRetry, hasError: false, error: null });

    if (onRetry) {
      try {
        await onRetry();
      } catch (err) {
        this.setState({
          hasError: true,
          error: err as Error,
          diagnosticId: generateDiagnosticId(this.props.routeName),
        });
      }
    }
  };

  handleNavigateHome = (): void => {
    this.setState({ hasError: false, error: null, retryCount: 0 });
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.location.hash = '#/overview';
    }
  };

  handleCopyDiagnostic = async (): Promise<void> => {
    const report = {
      diagnosticId: this.state.diagnosticId,
      routeName: this.props.routeName || 'Unknown Route',
      routePath: this.props.routePath || (typeof window !== 'undefined' ? window.location.pathname : ''),
      errorMessage: this.state.error?.message || 'Unknown Error',
      errorStack: this.state.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }
    } catch {
      // Clipboard write failed
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { routeName, routePath, maxRetries = 2 } = this.props;
    const { error, diagnosticId, retryCount, copied } = this.state;
    const canRetry = retryCount < maxRetries;

    return (
      <div
        role="alert"
        aria-live="assertive"
        data-testid="route-error-boundary-fallback"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '360px',
          padding: '32px 24px',
          textAlign: 'center',
          background: 'var(--bg-card, #141721)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border, #2a2e3d)',
          maxWidth: '640px',
          margin: '24px auto',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary, #fff)',
            margin: '0 0 6px 0',
          }}
        >
          {routeName ? `Unable to Load ${routeName}` : 'View Rendering Failed'}
        </h2>

        {routePath && (
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted, #64748b)',
              marginBottom: '12px',
            }}
          >
            Route: {routePath}
          </div>
        )}

        {/* Diagnostic Identifier */}
        {diagnosticId && (
          <div
            data-testid="diagnostic-identifier-tag"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--bg-elevated, #1e2230)',
              border: '1px solid var(--border-bright, #3b4254)',
              color: 'var(--cyan, #00d4ff)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11px',
              marginBottom: '16px',
            }}
          >
            <span>Diagnostic ID:</span>
            <strong>{diagnosticId}</strong>
          </div>
        )}

        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #94a3b8)',
            maxWidth: '480px',
            lineHeight: 1.5,
            margin: '0 0 20px 0',
          }}
        >
          {error?.message ||
            'An unexpected error occurred while rendering this dashboard view. You can retry loading the view or return to the overview.'}
        </p>

        {/* Standardized Recovery Actions */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: '18px',
          }}
        >
          {canRetry && (
            <button
              type="button"
              data-testid="route-retry-button"
              onClick={this.handleRetry}
              style={{
                padding: '9px 18px',
                background: 'var(--cyan, #00d4ff)',
                color: '#000',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🔄</span>
              <span>Retry Route ({maxRetries - retryCount} left)</span>
            </button>
          )}

          <button
            type="button"
            data-testid="route-return-home-button"
            onClick={this.handleNavigateHome}
            style={{
              padding: '9px 18px',
              background: 'var(--bg-elevated, #1e2230)',
              color: 'var(--text-primary, #fff)',
              fontWeight: 600,
              fontSize: '13px',
              border: '1px solid var(--border-bright, #3b4254)',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📊</span>
            <span>Return to Overview</span>
          </button>

          <button
            type="button"
            data-testid="route-copy-diagnostic-button"
            onClick={this.handleCopyDiagnostic}
            style={{
              padding: '9px 14px',
              background: copied ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: copied ? 'var(--emerald, #10b981)' : 'var(--text-secondary, #94a3b8)',
              fontWeight: 500,
              fontSize: '12px',
              border: `1px solid ${copied ? 'var(--emerald, #10b981)' : 'var(--border, #2a2e3d)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied Diagnostic Report' : '📋 Copy Diagnostic ID'}
          </button>
        </div>
      </div>
    );
  }
}
