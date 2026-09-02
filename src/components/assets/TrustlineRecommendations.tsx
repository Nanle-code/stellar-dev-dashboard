import React, { useState, useEffect } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { getTrustlineRecommendations } from '../../lib/stellar';
import { addBreadcrumb } from '../../lib/errorReporting';
import AssetCard from './AssetCard';
import { ResponsiveGrid } from '../layout/ResponsiveContainer';

export default function TrustlineRecommendations({ accountId, network }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isMobile } = useResponsive();
  const { error, handleError, clearError } = useErrorHandler('TrustlineRecommendations');

  useEffect(() => {
    if (accountId) {
      loadRecommendations();
    }
  }, [accountId, network]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      clearError();
      
      const recs = await getTrustlineRecommendations(accountId, network, 12);
      setRecommendations(recs);
      
      addBreadcrumb('Trustline recommendations loaded', 'api_call', {
        accountId,
        network,
        count: recs.length
      });
    } catch (err) {
      handleError(err, { accountId, network });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--green)';
    if (score >= 60) return 'var(--cyan)';
    if (score >= 40) return 'var(--amber)';
    return 'var(--red)';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}>
          Analyzing your account for trustline recommendations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        background: 'var(--red-glow)',
        border: '1px solid var(--red)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: 700,
          color: 'var(--red)',
          marginBottom: '8px'
        }}>
          Failed to Load Recommendations
        </h3>
        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: '16px'
        }}>
          {error.userFriendlyMessage?.message || 'Unable to analyze your account for recommendations.'}
        </p>
        <button
          onClick={loadRecommendations}
          style={{
            padding: '10px 20px',
            background: 'var(--red)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          🔄 Try Again
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '300px',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '40px 20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🎯</div>
        <div style={{
          fontSize: isMobile ? '18px' : '20px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          No New Recommendations
        </div>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          maxWidth: '400px',
          lineHeight: 1.5
        }}>
          You already have trustlines to most recommended assets, or there are no suitable 
          assets to recommend based on your current holdings and network activity.
        </div>
        <button
          onClick={loadRecommendations}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: 'var(--cyan)',
            color: 'var(--bg-base)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          🔄 Refresh Recommendations
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          fontFamily: 'var(--font-display)'
        }}>
          💡 Trustline Recommendations
        </h2>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          lineHeight: 1.5,
          marginBottom: '16px'
        }}>
          Based on your account activity and popular assets in the network, here are some 
          assets you might want to consider adding trustlines for.
        </p>
        
        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          padding: '12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'var(--green)'
            }} />
            <span>Excellent (80+)</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'var(--cyan)'
            }} />
            <span>Good (60-79)</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'var(--amber)'
            }} />
            <span>Fair (40-59)</span>
          </div>
        </div>
      </div>

      {/* Recommendations Grid */}
      <ResponsiveGrid
        columns={{ mobile: 1, tablet: 2, desktop: 3 }}
        gap={{ mobile: '16px', tablet: '20px', desktop: '24px' }}
      >
        {recommendations.map((rec, index) => (
          <div key={`${rec.asset.code}-${rec.asset.issuer}`} className={`animate-in-delay-${Math.min(index + 1, 5)}`}>
            <RecommendationCard recommendation={rec} network={network} />
          </div>
        ))}
      </ResponsiveGrid>

      {/* Disclaimer */}
      <div style={{
        marginTop: '32px',
        padding: '16px',
        background: 'var(--amber-glow)',
        border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-lg)',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.5
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <strong style={{ color: 'var(--amber)' }}>Important Disclaimer</strong>
        </div>
        These recommendations are based on algorithmic analysis and should not be considered 
        financial advice. Always do your own research before creating trustlines. Consider 
        the issuer's reputation, asset utility, and associated risks. Never trust assets 
        from unknown or unverified issuers.
      </div>
    </div>
  );
}

// Individual recommendation card component
function RecommendationCard({ recommendation, network }) {
  const { isMobile } = useResponsive();
  const { asset, issuer_info, recommendation_score, reasons, risk_factors } = recommendation;

  const scoreColor = getScoreColor(recommendation_score);
  const scoreLabel = getScoreLabel(recommendation_score);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: isMobile ? '16px' : '20px',
      position: 'relative',
      height: 'fit-content'
    }}>
      {/* Score Badge */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        background: `${scoreColor}20`,
        border: `1px solid ${scoreColor}`,
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 700,
        color: scoreColor
      }}>
        {recommendation_score}/100 • {scoreLabel}
      </div>

      {/* Asset Card */}
      <div style={{ marginBottom: '16px' }}>
        <AssetCard asset={asset} network={network} />
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--green)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            ✅ Why Recommended
          </h4>
          <ul style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            paddingLeft: '16px',
            margin: 0
          }}>
            {reasons.map((reason, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Factors */}
      {risk_factors.length > 0 && (
        <div>
          <h4 style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--amber)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            ⚠️ Risk Factors
          </h4>
          <ul style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
            paddingLeft: '16px',
            margin: 0
          }}>
            {risk_factors.map((risk, index) => (
              <li key={index} style={{ marginBottom: '4px' }}>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper functions (duplicated from AssetCard for consistency)
function getScoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--cyan)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}