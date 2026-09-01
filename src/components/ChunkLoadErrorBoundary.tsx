import React, { Component, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChunkLoadErrorBoundary');

const CHUNK_LOAD_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Loading chunk',
  'Loading CSS chunk',
  'ChunkLoadError',
  'NetworkError when attempting to fetch dynamic import',
  'Failed to load module script',
  'dynamically imported module',
];

interface ChunkLoadErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
  fallback?: ReactNode;
}

interface ChunkLoadErrorBoundaryState {
  hasChunkLoadError: boolean;
  error: Error | null;
  retryCount: number;
  isReloading: boolean;
}

interface ChunkLoadErrorBannerProps {
  error: Error;
  onReload: () => void;
  onDismiss: () => void;
  retryCount: number;
  isReloading: boolean;
}

function ChunkLoadErrorBanner({
  error: _error,
  onReload,
  onDismiss,
  retryCount,
  isReloading,
}: ChunkLoadErrorBannerProps) {
  const { isMobile } = useResponsive() as { isMobile: boolean };

  const containerStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    left: isMobile ? '16px' : '24px',
    right: isMobile ? '16px' : 'auto',
    maxWidth: isMobile ? 'none' : '480px',
    zIndex: 2100,
    pointerEvents: 'auto',
  };

  const bannerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    animation: 'slideInFromBottom 0.3s ease-out',
  };

  const iconStyles: React.CSSProperties = {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    background: 'var(--amber-glow)',
    color: 'var(--amber)',
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const titleStyles: React.CSSProperties = {
    margin: '0 0 4px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  };

  const messageStyles: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  };

  const buttonContainerStyles: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  };

  const primaryButtonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: isReloading ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    fontSize: '12px',
    transition: 'var(--transition)',
    background: 'var(--cyan)',
    color: 'var(--bg-base)',
    opacity: isReloading ? 0.7 : 1,
    minHeight: isMobile ? '40px' : 'auto',
  };

  const secondaryButtonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'var(--transition)',
  };

  const isStaleChunk = retryCount === 0;

  return (
    <div style={containerStyles} role="alert" aria-live="assertive">
      <div style={bannerStyles}>
        <div style={iconStyles} aria-hidden="true">
          <AlertTriangle size={18} />
        </div>

        <div style={contentStyles}>
          <h4 style={titleStyles}>
            {isStaleChunk ? 'New Version Available' : 'Update Required'}
          </h4>
          <p style={messageStyles}>
            {isStaleChunk
              ? 'A new version of the dashboard has been deployed. The page needs to be refreshed to load the latest changes.'
              : 'Unable to load the latest version. Please refresh the page to try again.'}
          </p>

          <div style={buttonContainerStyles}>
            <button
              onClick={onReload}
              disabled={isReloading}
              style={primaryButtonStyles}
              aria-label={isReloading ? 'Reloading...' : 'Reload page to get latest version'}
            >
              {isReloading ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Reloading...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Reload Now
                </>
              )}
            </button>

            <button
              onClick={onDismiss}
              style={secondaryButtonStyles}
              aria-label="Dismiss this notification"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>

          {retryCount > 0 && (
            <p style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Reload attempted {retryCount} time{retryCount !== 1 ? 's' : ''}. If this persists, check your network connection.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInFromBottom {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default class ChunkLoadErrorBoundary extends Component<
  ChunkLoadErrorBoundaryProps,
  ChunkLoadErrorBoundaryState
> {
  constructor(props: ChunkLoadErrorBoundaryProps) {
    super(props);
    this.state = {
      hasChunkLoadError: false,
      error: null,
      retryCount: 0,
      isReloading: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ChunkLoadErrorBoundaryState> {
    const isChunkLoadError = CHUNK_LOAD_ERROR_PATTERNS.some((pattern) =>
      error.message.includes(pattern)
    );

    if (isChunkLoadError) {
      logger.warn('Detected chunk load error', {
        message: error.message,
        stack: error.stack,
      });
      return { hasChunkLoadError: true, error };
    }

    return { hasChunkLoadError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isChunkLoadError = CHUNK_LOAD_ERROR_PATTERNS.some((pattern) =>
      error.message.includes(pattern)
    );

    if (isChunkLoadError) {
      logger.error('Caught chunk load error in ChunkLoadErrorBoundary', {
        errorMessage: error.message,
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
      });
    }
  }

  private handleReload = () => {
    if (typeof window === 'undefined' || typeof window.location === 'undefined') {
      logger.warn('window.location.reload not available (SSR/test environment)');
      return;
    }

    this.setState({ isReloading: true });

    try {
      if (this.props.onReload) {
        this.props.onReload();
      } else {
        window.location.reload();
      }
    } catch (err) {
      logger.error('Failed to reload page', err as Record<string, unknown>);
      this.setState({ isReloading: false });
    }
  };

  private handleDismiss = () => {
    this.setState({
      hasChunkLoadError: false,
      error: null,
      retryCount: 0,
    });
  };

  render() {
    const { hasChunkLoadError, error, retryCount, isReloading } = this.state;
    const { children, fallback } = this.props;

    if (hasChunkLoadError && error) {
      if (fallback) {
        return React.cloneElement(fallback as React.ReactElement, {
          error,
          onReload: this.handleReload,
          onDismiss: this.handleDismiss,
          retryCount,
          isReloading,
        });
      }

      return (
        <>
          {children}
          <ChunkLoadErrorBanner
            error={error}
            onReload={this.handleReload}
            onDismiss={this.handleDismiss}
            retryCount={retryCount}
            isReloading={isReloading}
          />
        </>
      );
    }

    return <>{children}</>;
  }
}