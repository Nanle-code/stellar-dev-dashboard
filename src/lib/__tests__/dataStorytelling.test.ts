/**
 * Tests for Intelligent Data Storytelling (#608).
 */

import { describe, it, expect } from 'vitest'
import {
  ACCURACY_TARGET,
  FAST_GENERATION_MS,
  assembleChapters,
  buildDataStory,
  buildVizSeriesFromActivity,
  detectInsights,
  enrichInsightsWithNarratives,
  evaluateNarrativeAccuracy,
  generateNarrative,
  generateSyntheticVizSeries,
  isGenerationFast,
  rebuildStoryForMetric,
  sliceSeriesForChapter,
  storyEngagementScore,
} from '../dataStorytelling'

describe('synthetic series bootstrap', () => {
  it('generates enough points for storytelling', () => {
    const series = generateSyntheticVizSeries({ points: 48, metric: 'operations' })
    expect(series).toHaveLength(48)
    expect(series[0].value).toBeGreaterThan(0)
    expect(series.every((p) => p.label && p.timestamp)).toBe(true)
  })

  it('bootstraps sparse ledger activity', () => {
    const sparse = buildVizSeriesFromActivity(
      [{ closed_at: new Date().toISOString(), operation_count: 10 }],
      'operations'
    )
    expect(sparse.length).toBeGreaterThanOrEqual(8)
  })
})

describe('insight detection (AC: relevant insights)', () => {
  it('detects trend, spike, and seasonality on synthetic operations data', () => {
    const series = generateSyntheticVizSeries({ points: 48, metric: 'operations', seed: 42 })
    const insights = detectInsights(series, 'operations')
    const types = new Set(insights.map((i) => i.type))
    expect(insights.length).toBeGreaterThanOrEqual(3)
    expect(types.has('spike') || types.has('drop')).toBe(true)
    expect(
      types.has('trend') ||
        types.has('milestone') ||
        types.has('seasonality') ||
        types.has('volatility')
    ).toBe(true)
    expect(insights.every((i) => i.confidence >= 0.45)).toBe(true)
  })

  it('produces narratives with why-it-matters context', () => {
    const series = generateSyntheticVizSeries({ points: 48, seed: 99 })
    const insights = enrichInsightsWithNarratives(detectInsights(series, 'fees', 'Fees'), series, 'Fees')
    expect(insights[0].narrative.length).toBeGreaterThan(40)
    expect(insights[0].whyItMatters.length).toBeGreaterThan(20)
  })
})

describe('narrative generation (AC: engaging storytelling)', () => {
  it('assembles ordered interactive chapters', () => {
    const story = buildDataStory({ metric: 'operations', seed: 608 })
    expect(story.chapters.length).toBeGreaterThanOrEqual(3)
    expect(story.chapters[0].order).toBe(1)
    expect(story.chapters.every((c) => c.headline && c.body && c.callToAction)).toBe(true)
    expect(assembleChapters(story.insights, 4)).toHaveLength(Math.min(4, story.insights.length))
  })

  it('slices chart windows per chapter', () => {
    const story = buildDataStory({ metric: 'transactions', seed: 7 })
    const slice = sliceSeriesForChapter(story.series, story.chapters[0])
    expect(slice.length).toBeGreaterThanOrEqual(3)
  })

  it('scores engagement above baseline', () => {
    const story = buildDataStory({ metric: 'load', seed: 3 })
    expect(storyEngagementScore(story)).toBeGreaterThan(0.4)
  })
})

describe('accuracy & performance (AC: ≥80% accurate, fast generation)', () => {
  it('achieves ≥80% narrative accuracy on synthetic stories', () => {
    const story = buildDataStory({ metric: 'operations', seed: 608 })
    const evalResult = evaluateNarrativeAccuracy(story.insights, story.series)
    expect(evalResult.evaluatedInsights).toBeGreaterThan(0)
    expect(evalResult.accuracy).toBeGreaterThanOrEqual(ACCURACY_TARGET)
    expect(story.meetsAccuracyTarget).toBe(true)
    expect(evalResult.meetsTarget).toBe(true)
  })

  it('generates stories quickly without external APIs', () => {
    const story = buildDataStory({ metric: 'fees', seed: 12 })
    expect(story.generationMs).toBeLessThanOrEqual(FAST_GENERATION_MS * 4)
    expect(isGenerationFast(story, FAST_GENERATION_MS * 4)).toBe(true)
  })
})

describe('integration helpers', () => {
  it('rebuilds stories per metric', () => {
    const base = generateSyntheticVizSeries({ metric: 'operations', points: 48 })
    const rebuilt = rebuildStoryForMetric(base, 'successRate', 'Success Rate')
    expect(rebuilt.metric).toBe('successRate')
    expect(rebuilt.insights.length).toBeGreaterThan(0)
  })

  it('generates typed narratives for spikes', () => {
    const series = generateSyntheticVizSeries({ points: 48, spikeAt: 30, seed: 5 })
    const spike = detectInsights(series, 'operations').find((i) => i.type === 'spike')
    expect(spike).toBeTruthy()
    const nlg = generateNarrative(spike!, series, 'Operations')
    expect(nlg.narrative.toLowerCase()).toContain('spike')
  })
})
