import React, { ReactNode } from 'react';
import { useResponsive } from '../../../hooks/useResponsive';

export interface WidgetBaseProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  error?: { message?: string } | Error | null;
  onRefresh?: () => void;
  headerActions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  contentPadding?: boolean;
}

/**
 * Base widget component with common styling and functionality
 */
export default function WidgetBase({
  title,
  subtitle,
  icon,
  children,
  loading = false,
  error = null,
  onRefresh,
  headerActions,
  className = '',
  style = {},
  contentPadding = true
}: WidgetBaseProps) {
  const { isMobile } = useResponsive() as { isMobile: boolean };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    ...style
  };

  const headerStyles: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : '14px 18px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '48px'
  };

  const titleStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0
  };

  const contentStyles: React.CSSProperties = {
    flex: 1,
    padding: contentPadding ? (isMobile ? '16px' : '18px') : '0',
    overflow: 'auto',
    position: 'relative'
  };

  return (
    <div className={`widget-base ${className}`} style={containerStyles}>
      {/* Header */}
      {(title || headerActions) && (
        <div style={headerStyles}>
          <div style={titleStyles}>
            {icon && (
              <span style={{ fontSize: '16px', flexShrink: 0 }}>
                {icon}
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              {title && (
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: isMobile ? '14px' : '15px',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'var(--transition)',
                  fontSize: '14px'
                }}
                title="Refresh widget"
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!loading) {
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!loading) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'none';
                  }
                }}
              >
                {loading ? (
                  <div className="spinner" style={{ width: '12px', height: '12px' }} />
                ) : (
                  '🔄'
                )}
              </button>
            )}
            {headerActions}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={contentStyles}>
        {loading && !children ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div className="spinner" style={{ width: '24px', height: '24px' }} />
            <div style={{
              fontSize: '13px',
              color: 'var(--text-muted)'
            }}>
              Loading...
            </div>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: '12px',
            textAlign: 'center',
            padding: '20px'
          }}>
            <div style={{ fontSize: '32px' }}>⚠️</div>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--red)',
              marginBottom: '4px'
            }}>
              Error Loading Widget
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.4
            }}>
              {(error as Error).message || 'Something went wrong'}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                style={{
                  marginTop: '8px',
                  padding: '6px 12px',
                  background: 'var(--red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}