import React from 'react'

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

interface RouteComparisonProps {
  routes: RankedRoute[]
  onSelectRoute: (route: Route) => void
  selectedRoute?: Route | null
}

export default function RouteComparison({
  routes,
  onSelectRoute,
  selectedRoute,
}: RouteComparisonProps) {
  if (!routes || routes.length < 2) {
    return null
  }

  const topRoutes = routes.slice(0, 3)
  const criteria = ['cost', 'speed', 'reliability', 'slippage'] as const

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
          <span style={{ fontSize: '16px' }}>📊</span>
          <span style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
          }}>
            Route Comparison
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 12px',
                textAlign: 'left',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}>
                Route
              </th>
              {criteria.map(criterion => (
                <th key={criterion} style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                }}>
                  {criterion}
                </th>
              ))}
              <th style={{
                padding: '8px 12px',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}>
                Overall
              </th>
              <th style={{
                padding: '8px 12px',
                textAlign: 'center',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {topRoutes.map((ranked) => {
              const isSelected = selectedRoute === ranked.route
              const sourceAmount = parseFloat(ranked.route.source_amount || '0')
              const destAmount = parseFloat(ranked.route.destination_amount || '0')
              const efficiency = sourceAmount > 0 ? (destAmount / sourceAmount * 100).toFixed(1) : '0'

              return (
                <tr
                  key={ranked.rank}
                  style={{
                    background: isSelected ? 'var(--green-glow-sm)' : 'transparent',
                    transition: 'var(--transition)',
                  }}
                >
                  <td style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: ranked.rank === 1 ? 'var(--cyan)' : 'var(--bg-canvas)',
                        color: ranked.rank === 1 ? 'white' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 600,
                      }}>
                        {ranked.rank}
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: 500,
                          color: ranked.rank === 1 ? 'var(--cyan)' : 'var(--text-primary)',
                        }}>
                          {ranked.route.path?.length || 0} hops
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {efficiency}% efficiency
                        </div>
                      </div>
                    </div>
                  </td>
                  {criteria.map(criterion => (
                    <td key={criterion} style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'center',
                    }}>
                      <ScoreBar
                        score={ranked.scores[criterion]}
                        isHighest={isHighestScore(topRoutes, criterion, ranked.scores[criterion])}
                      />
                    </td>
                  ))}
                  <td style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: ranked.rank === 1 ? 'var(--cyan)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {(ranked.overallScore * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                  }}>
                    <button
                      onClick={() => onSelectRoute(ranked.route)}
                      style={{
                        padding: '4px 10px',
                        background: isSelected ? 'var(--green)' : 'var(--bg-canvas)',
                        color: isSelected ? 'white' : 'var(--text-primary)',
                        border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Select'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px',
        background: 'var(--bg-canvas)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>💡 Higher scores are better</span>
          <span>•</span>
          <span>Best route highlighted in cyan</span>
          <span>•</span>
          <span>Click &quot;Select&quot; to choose a route</span>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({ score, isHighest }: { score: number; isHighest: boolean }) {
  const percentage = Math.round(score * 100)
  const color = isHighest ? 'var(--cyan)' : score > 0.7 ? 'var(--green)' : score > 0.4 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        width: '40px',
        height: '4px',
        background: 'var(--bg-canvas)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: '2px',
          transition: 'var(--transition)',
        }} />
      </div>
      <span style={{
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: isHighest ? color : 'var(--text-muted)',
        fontWeight: isHighest ? 600 : 400,
      }}>
        {percentage}%
      </span>
    </div>
  )
}

function isHighestScore(routes: RankedRoute[], criterion: string, score: number): boolean {
  const maxScore = Math.max(...routes.map(r => r.scores[criterion as keyof typeof r.scores]))
  return score === maxScore
}
