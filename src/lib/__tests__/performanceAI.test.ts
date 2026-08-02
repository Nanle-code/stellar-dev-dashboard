import { describe, it, expect } from 'vitest'
import { identifyBottlenecks, analyzeTrends, generateReport } from '../performanceAI'

describe('performanceAI', () => {
  it('identifies obvious bottlenecks from synthetic summary', () => {
    const syntheticSummary = {
      customMetrics: {
        API_RESPONSE: { average: 1200, count: 50 },
        QUICK_TASK: { average: 5, count: 200 },
      },
      webVitals: {
        LCP: { value: 3200 },
      },
      resources: {
        javascript: { totalSize: 2 * 1024 * 1024, count: 10 },
      },
    }

    const bottlenecks = identifyBottlenecks(syntheticSummary, 0.5)
    // Expect at least API_RESPONSE and LCP to be flagged
    const names = bottlenecks.map((b) => b.name)
    expect(names).toEqual(expect.arrayContaining(['API_RESPONSE', 'LCP']))
  })

  it('analyzes trends correctly', () => {
    const series = {
      slowApi: [
        { timestamp: 1, value: 100 },
        { timestamp: 2, value: 200 },
        { timestamp: 3, value: 300 },
      ],
      fastApi: [
        { timestamp: 1, value: 300 },
        { timestamp: 2, value: 200 },
        { timestamp: 3, value: 100 },
      ],
    }

    const trends = analyzeTrends(series)
    const slow = trends.find((t) => t.name === 'slowApi')
    const fast = trends.find((t) => t.name === 'fastApi')
    expect(slow?.direction).toBe('increasing')
    expect(fast?.direction).toBe('decreasing')
  })

  it('generates a report object', () => {
    const syntheticSummary = {
      customMetrics: { API_RESPONSE: { average: 1200, count: 4 } },
      webVitals: { LCP: { value: 3200 } },
    }
    const report = generateReport(syntheticSummary, { api: [{ timestamp: 1, value: 100 }] })
    expect(report).toHaveProperty('bottlenecks')
    expect(report).toHaveProperty('recommendations')
    expect(Array.isArray(report.bottlenecks)).toBe(true)
  })
})
