import React, { useState } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { ERROR_CATEGORIES } from '../utils/errorHandler';
import { ErrorDetails } from '../types/error';

export interface ErrorFallbackProps {
  error: Error | null;
  errorDetails: ErrorDetails | null;
  resetErrorBoundary: () => void;
  retryWithBackoff: () => Promise<void>;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export const ErrorFallback = ({
  error,
  errorDetails,
  resetErrorBoundary,
  retryWithBackoff,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3
}: ErrorFallbackProps): JSX.Element => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const { isMobile } = useResponsive() as { isMobile: boolean };

  const handleCopyError = async (): Promise<void> => {
    const errorInfo = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      timestamp: errorDetails?.timestamp,
      url: errorDetails?.url,
      userAgent: errorDetails?.userAgent,
      category: errorDetails?.category,
      severity: errorDetails?.severity
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const getErrorIcon = (category?: string): string => {
    if (!category) return '❌';
    const icons: Record<string, string> = {
      [ERROR_CATEGORIES.NETWORK]: '🌐',
      [ERROR_CATEGORIES.VALIDATION]: '⚠️',
      [ERROR_CATEGORIES.STELLAR]: '⭐',
      [ERROR_CATEGORIES.AUTHENTICATION]: '🔐',
      [ERROR_CATEGORIES.PERMISSION]: '🚫',
      [ERROR_CATEGORIES.RATE_LIMIT]: '⏱️',
      [ERROR_CATEGORIES.UNKNOWN]: '❌'
    };
    return icons[category] || '❌';
  };

  const getSeverityColor = (severity?: string): string => {
    if (!severity) return 'var(--red)';
    const colors: Record<string, string> = {
      low: 'var(--amber)',
      medium: 'var(--cyan)',
      high: 'var(--red)',
      critical: 'var(--red)'
    };
    return colors[severity] || 'var(--red)';
  };

  const userFriendlyMessage = errorDetails?.userFriendlyMessage || {
    title: 'Something went wrong',
    message: 'We encountered an unexpected error. Our team has been notified.',
    action: 'Try Again'
  };

  const helpLinks = errorDetails?.helpLinks || [];
  const isRetryable = errorDetails?.isRetryable && retryCount < maxRetries;

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    padding: isMobile ? '20px' : '32px',
    textAlign: 'center',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    maxWidth: isMobile ? '100%' : '600px',
    margin: '0 auto'
  };

  const iconStyles: React.CSSProperties = {
    fontSize: '48px',
    marginBottom: '16px',
    padding: '16px',
    borderRadius: '50%',
    background: 'var(--red-glow)',
    border: `2px solid ${getSeverityColor(errorDetails?.severity)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '80px',
    height: '80px'
  };

  const buttonStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'var(--transition)',
    minHeight: isMobile ? 'var(--touch-target)' : 'auto',
    minWidth: isMobile ? 'var(--touch-target)' : 'auto'
  };

  const primaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    background: 'var(--cyan)',
    color: 'var(--bg-base)',
  };

  const secondaryButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-bright)',
  };

  return (
    <div style={containerStyles}>
      {/* Error Icon */}
      <div style={iconStyles}>
        {getErrorIcon(errorDetails?.category)}
      </div>

      {/* Error Title */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: isMobile ? '20px' : '24px',
        fontWeight: 700,
        marginBottom: '8px',
        color: 'var(--text-primary)'
      }}>
        {userFriendlyMessage.title}
      </h2>

      {/* Error Category Badge */}
      {errorDetails?.category && (
        <div style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-elevated)',
          border: `1px solid ${getSeverityColor(errorDetails.severity)}`,
          color: getSeverityColor(errorDetails.severity),
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '16px'
        }}>
          {errorDetails.category} • {errorDetails.severity}
        </div>
      )}

      {/* User-friendly message */}
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: '24px',
        maxWidth: '400px',
        lineHeight: 1.5,
        fontSize: isMobile ? '14px' : '16px'
      }}>
        {userFriendlyMessage.message}
      </p>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '12px',
        marginBottom: '24px',
        width: isMobile ? '100%' : 'auto'
      }}>
        {isRetryable && (
          <button
            onClick={() => { retryWithBackoff().catch(err => console.error(err)); }}
            disabled={isRetrying}
            style={{
              ...primaryButtonStyles,
              opacity: isRetrying ? 0.7 : 1,
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            {isRetrying ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px' }} />
                Retrying...
              </>
            ) : (
              <>
                🔄 {userFriendlyMessage.action} ({maxRetries - retryCount} left)
              </>
            )}
          </button>
        )}
        
        <button
          onClick={resetErrorBoundary}
          style={{
            ...secondaryButtonStyles,
            width: isMobile ? '100%' : 'auto'
          }}
        >
          🏠 Go Back
        </button>
      </div>

      {/* Help Links */}
      {helpLinks.length > 0 && (
        <div style={{
          marginBottom: '24px',
          width: '100%',
          maxWidth: '400px'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '12px'
          }}>
            Need Help?
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {helpLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 16px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--cyan)',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 500,
                  transition: 'var(--transition)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  width: isMobile ? '100%' : 'auto',
                  justifyContent: isMobile ? 'center' : 'flex-start'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--cyan-glow)';
                  e.currentTarget.style.borderColor = 'var(--cyan)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                📖 {link.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Error Details Toggle */}
      <div style={{ width: '100%', maxWidth: '500px' }}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            ...secondaryButtonStyles,
            width: '100%',
            marginBottom: showDetails ? '16px' : '0'
          }}
        >
          {showDetails ? '🔼 Hide' : '🔽 Show'} Technical Details
        </button>

        {showDetails && (
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0
              }}>
                Error Details
              </h4>
              <button
                onClick={() => { handleCopyError().catch(err => console.error(err)); }}
                style={{
                  ...secondaryButtonStyles,
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: copied ? 'var(--green-glow)' : 'var(--bg-hover)',
                  color: copied ? 'var(--green)' : 'var(--text-secondary)'
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            
            <div style={{
              background: 'var(--bg-base)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              overflowX: 'auto'
            }}>
              <code style={{
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--red)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {error?.message || 'Unknown Error'}
                {errorDetails?.timestamp && (
                  <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
                    Time: {new Date(errorDetails.timestamp).toLocaleString()}
                  </div>
                )}
                {errorDetails?.context && (
                  <div style={{ color: 'var(--text-muted)' }}>
                    Context: {errorDetails.context}
                  </div>
                )}
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Retry Count Display */}
      {retryCount > 0 && (
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginTop: '8px'
        }}>
          Retry attempts: {retryCount}/{maxRetries}
        </div>
      )}
    </div>
  );
};

export default ErrorFallback;
