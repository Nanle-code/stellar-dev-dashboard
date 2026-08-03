import React, { useState } from 'react'
import SlippageWarning from './SlippageWarning'

interface Route {
  path?: string[]
  source_amount?: string
  destination_amount?: string
  source_asset_code?: string
  destination_asset_code?: string
  source_asset_type?: string
  destination_asset_type?: string
  destination_asset_issuer?: string
}

interface RankedRoute {
  route: Route
  overallScore: number
  rank: number
  scores: {
    cost: number
    speed: number
    reliability: number
    slippage: number
  }
}

interface SlippagePrediction {
  predictedSlippage: number
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  breakdown: {
    hopContribution: number
    liquidityContribution: number
    amountContribution: number
    volatilityContribution: number
    timeContribution: number
  }
  recommendedTolerance: number
}

interface RouteExplanation {
  summary: string
  factors: Array<{ type: string; label: string; detail: string }>
  recommendation: string
  warnings: string[]
}

interface AIRouteRecommendationsProps {
  rankedRoutes: RankedRoute[]
  slippagePredictions: SlippagePrediction[]
  routeExplanations: RouteExplanation[]
  onSelectRoute: (route: Route) => void
  selectedRoute?: Route | null
  isLoading?: boolean
  showExplanations?: boolean
}

export default function AIRouteRecommendations({
  rankedRoutes,
  slippagePredictions,
  routeExplanations,
  onSelectRoute,
  selectedRoute,
  isLoading = false,
  showExplanations = true,
}: AIRouteRecommendationsProps) {
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null)
  const [showSlippageDetails, setShowSlippageDetails] = useState<boolean>(false)

  if (isLoading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}>
        <div style={{ marginBottom: '8px' }}>🔄</div>
        <div style={{ fontSize: '13px' }}>Analyzing routes with AI...</div>
      </div>
    )
  }

  if (!rankedRoutes || rankedRoutes.length === 0) {
    return null
  }

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🤖</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}>
            AI Route Recommendations
          </span>
        </div>
        <div style={{
          fontSize: '11px',
          padding: '4px 8px',
          background: 'var(--cyan-glow-sm)',
          border: '1px solid var(--cyan)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--cyan)',
          fontWeight: 500,
        }}>
          {rankedRoutes.length} routes analyzed
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rankedRoutes.map((ranked, index) => {
          const prediction = slippagePredictions[index]
          const explanation = routeExplanations[index]
          const isExpanded = expandedRoute === index
          const isSelected = selectedRoute === ranked.route
          const isRecommended = ranked.rank === 1

          return (
            <div
              key={index}
              style={{
                border: `1px solid ${isRecommended ? 'var(--cyan)' : isSelected ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                background: isRecommended ? 'var(--cyan-glow-sm)' : isSelected ? 'var(--green-glow-sm)' : 'var(--bg-canvas)',
                transition: 'var(--transition)',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => setExpandedRoute(isExpanded ? null : index)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: isRecommended ? 'var(--cyan)' : 'var(--bg-elevated)',
                    color: isRecommended ? 'white' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    {ranked.rank}
                  </div>
                  <div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isRecommended ? 'var(--cyan)' : 'var(--text-primary)',
                    }}>
                      {isRecommended ? '⭐ Recommended' : `Route #${ranked.rank}`}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {(ranked.overallScore * 100).toFixed(1)}% score • {ranked.route.path?.length || 0} hops
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {prediction && (
                    <div style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: getRiskColor(prediction.riskLevel, true),
                      color: getRiskColor(prediction.riskLevel, false),
                      fontWeight: 500,
                    }}>
                      {(prediction.predictedSlippage * 100).toFixed(2)}%
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectRoute(ranked.route)
                    }}
                    style={{
                      padding: '6px 12px',
                      background: isSelected ? 'var(--green)' : 'var(--bg-elevated)',
                      color: isSelected ? 'white' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>

              {isExpanded && explanation && (
                <div style={{
                  padding: '0 12px 12px',
                  borderTop: '1px solid var(--border)',
                }}>
                  <div style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                  }}>
                    {explanation.summary}
                  </div>

                  {showExplanations && explanation.factors.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}>
                        KEY FACTORS
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {explanation.factors.map((factor, fi) => (
                          <div key={fi} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                          }}>
                            <span style={{
                              color: factor.type === 'positive' ? 'var(--green)' :
                                factor.type === 'warning' ? 'var(--amber)' : 'var(--red)',
                            }}>
                              {factor.type === 'positive' ? '✓' : factor.type === 'warning' ? '⚠' : '✗'}
                            </span>
                            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              {factor.label}:
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {factor.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {prediction && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowSlippageDetails(!showSlippageDetails)
                        }}
                        style={{
                          fontSize: '11px',
                          color: 'var(--cyan)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 500,
                        }}
                      >
                        {showSlippageDetails ? 'Hide' : 'Show'} slippage details
                      </button>
                      {showSlippageDetails && (
                        <SlippageWarning
                          predictedSlippage={prediction.predictedSlippage}
                          riskLevel={prediction.riskLevel}
                          recommendedTolerance={prediction.recommendedTolerance}
                          confidence={prediction.confidence}
                          breakdown={prediction.breakdown}
                          showDetails={true}
                        />
                      )}
                    </div>
                  )}

                  {explanation.warnings.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 10px',
                      background: 'var(--amber-glow-sm)',
                      border: '1px solid var(--amber)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      {explanation.warnings.map((warning, wi) => (
                        <div key={wi} style={{
                          fontSize: '11px',
                          color: 'var(--amber)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <span>⚠</span>
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{
                    marginTop: '12px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}>
                    {explanation.recommendation}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getRiskColor(riskLevel: string, isBackground: boolean): string {
  const colors: Record<string, { bg: string; text: string }> = {
    low: { bg: 'var(--green-glow-sm)', text: 'var(--green)' },
    medium: { bg: 'var(--amber-glow-sm)', text: 'var(--amber)' },
    high: { bg: 'var(--red-glow-sm)', text: 'var(--red)' },
    critical: { bg: 'var(--red-glow-sm)', text: 'var(--red)' },
  }
  const color = colors[riskLevel] || colors.medium
  return isBackground ? color.bg : color.text
}
