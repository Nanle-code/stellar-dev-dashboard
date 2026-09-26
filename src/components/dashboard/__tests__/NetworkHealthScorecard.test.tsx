import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import NetworkHealthScorecard from '../../../components/dashboard/NetworkHealthScorecard'
import type { ComparativeHealthReport } from '../../../lib/networkHealthScorecard'

function makeReport(overrides: Partial<ComparativeHealthReport> = {}): ComparativeHealthReport {
  return {
    mainnet: {
      network: 'mainnet',
      ok: true,
      score: {
        score: 92,
        grade: 'healthy',
        indicators: [
          { key: 'freshness', label: 'Ledger Freshness', value: '4s ago', subScore: 100 },
          { key: 'successRate', label: 'Tx Success Rate', value: '98.9%', subScore: 99 },
          { key: 'feePressure', label: 'Fee Pressure', value: '100 stroops', subScore: 100 },
          { key: 'throughput', label: 'Ledger Throughput', value: '120 ops', subScore: 95 },
        ],
        warnings: [],
      },
    },
    testnet: {
      network: 'testnet',
      ok: true,
      score: {
        score: 71,
        grade: 'degraded',
        indicators: [
          { key: 'freshness', label: 'Ledger Freshness', value: '9s ago', subScore: 100 },
          { key: 'successRate', label: 'Tx Success Rate', value: '91.2%', subScore: 91 },
          { key: 'feePressure', label: 'Fee Pressure', value: '2200 stroops', subScore: 22 },
          { key: 'throughput', label: 'Ledger Throughput', value: '40 ops', subScore: 98 },
        ],
        warnings: ['Elevated base fee (2200 stroops) suggests network congestion'],
      },
    },
    delta: 21,
    leader: 'mainnet',
    insights: ['Mainnet scores 92/100 (healthy) vs Testnet 71/100 (degraded).', 'Mainnet is currently healthier by 21 points.'],
    caveats: [
      'Mainnet and Testnet have different validator sets, load profiles, and stakes — scores are not directly comparable SLAs.',
      'Testnet XLM has no monetary value and can be reset; testnet health does not predict mainnet health.',
      'Testnet: Elevated base fee (2200 stroops) suggests network congestion',
    ],
    ...overrides,
  }
}

describe('NetworkHealthScorecard', () => {
  it('renders side-by-side mainnet and testnet grades, insights and caveats', async () => {
    const buildReport = vi.fn(async () => makeReport())
    render(<NetworkHealthScorecard buildReport={buildReport} fetchHealth={async () => ({})} />)

    await waitFor(() => expect(buildReport).toHaveBeenCalled())
    expect(screen.getByTestId('scorecard-mainnet')).toHaveTextContent('92')
    expect(screen.getByTestId('scorecard-mainnet')).toHaveTextContent('healthy')
    expect(screen.getByTestId('scorecard-testnet')).toHaveTextContent('71')
    expect(screen.getByTestId('scorecard-testnet')).toHaveTextContent('degraded')
    expect(screen.getByTestId('scorecard-caveats')).toHaveTextContent('Testnet XLM has no monetary value')
  })

  it('shows a per-network error without hiding the other scorecard', async () => {
    const report = makeReport({
      mainnet: { network: 'mainnet', ok: false, error: 'Horizon unreachable' },
      delta: undefined,
      leader: null,
      insights: ['Comparative scorecard is partial — Mainnet could not be scored.'],
    })
    render(<NetworkHealthScorecard buildReport={async () => report} fetchHealth={async () => ({})} />)

    await waitFor(() => expect(screen.getByTestId('scorecard-mainnet-error')).toHaveTextContent('Horizon unreachable'))
    expect(screen.getByTestId('scorecard-testnet')).toHaveTextContent('71')
  })

  it('shows a load error when report construction itself fails', async () => {
    render(
      <NetworkHealthScorecard
        buildReport={async () => {
          throw new Error('boom')
        }}
        fetchHealth={async () => ({})}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('scorecard-error')).toHaveTextContent('boom'))
  })
})
