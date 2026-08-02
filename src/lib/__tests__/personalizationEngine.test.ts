import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDefaultProfile,
  computeWidgetRecommendations,
  computePersonalizationStats,
  recordInteraction,
  computeLayoutCompactnessScore,
  identifyPeakUsageHours,
  detectPowerUser,
  detectCasualUser,
  getWidgetEfficiencyScore,
  type PersonalizationProfile,
} from '../personalizationEngine'

function createTestProfile(): PersonalizationProfile {
  return createDefaultProfile('test-user')
}

describe('personalizationEngine', () => {
  let profile: PersonalizationProfile

  beforeEach(() => {
    profile = createTestProfile()
  })

  describe('createDefaultProfile', () => {
    it('should create a profile with default values', () => {
      expect(profile.userId).toBe('test-user')
      expect(profile.learningEnabled).toBe(true)
      expect(profile.transparencyLevel).toBe('full')
      expect(profile.interactionHistory).toEqual([])
      expect(profile.version).toBe(1)
    })

    it('should generate a userId if not provided', () => {
      const p = createDefaultProfile()
      expect(p.userId).toContain('user-')
    })
  })

  describe('recordInteraction', () => {
    it('should record a tab visit interaction', async () => {
      const updated = await recordInteraction(profile, { type: 'tab_visit', target: 'overview' })
      expect(updated.tabFrequency.overview).toBe(1)
      expect(updated.interactionHistory.length).toBe(1)
    })

    it('should record multiple tab visits', async () => {
      let p = await recordInteraction(profile, { type: 'tab_visit', target: 'overview' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'overview' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'account' })
      expect(p.tabFrequency.overview).toBe(2)
      expect(p.tabFrequency.account).toBe(1)
      expect(p.interactionHistory.length).toBe(3)
    })

    it('should record widget interactions', async () => {
      let p = await recordInteraction(profile, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'transactions' })
      p = await recordInteraction(p, { type: 'widget_remove', target: 'balance' })
      expect(p.widgetFrequency.balance).toBe(0)
      expect(p.widgetFrequency.transactions).toBe(1)
    })

    it('should record feature usage', async () => {
      const p = await recordInteraction(profile, { type: 'feature_use', target: 'search' })
      expect(p.featureFrequency.search).toBe(1)
    })

    it('should record corrections', async () => {
      const p = await recordInteraction(profile, { type: 'correction', target: 'widget_balance' })
      expect(p.corrections.widget_balance).toBe(1)
    })

    it('should record explicit feedback', async () => {
      const p = await recordInteraction(profile, {
        type: 'explicit_feedback',
        target: 'widget_transactions',
        metadata: { value: 5 },
      })
      expect(p.explicitPreferences.widget_transactions).toBe(5)
    })

    it('should not record interactions when learning is disabled', async () => {
      profile.learningEnabled = false
      const p = await recordInteraction(profile, { type: 'tab_visit', target: 'overview' })
      expect(p.interactionHistory.length).toBe(0)
      expect(p.tabFrequency.overview).toBeUndefined()
    })
  })

  describe('computeWidgetRecommendations', () => {
    const available = ['balance', 'assets', 'transactions', 'networkStats', 'accountStats', 'quickActions', 'priceTicker', 'ledgerStats']

    it('should return recommendations sorted by score', async () => {
      let p = await recordInteraction(profile, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })

      const recs = computeWidgetRecommendations(p, available, [], 3)
      expect(recs.length).toBeLessThanOrEqual(3)
      expect(recs.length).toBeGreaterThan(0)
      expect(recs[0].score).toBeGreaterThanOrEqual(recs[1]?.score || 0)
    })

    it('should exclude existing widgets', () => {
      const recs = computeWidgetRecommendations(profile, available, ['balance', 'transactions'])
      expect(recs.find(r => r.widgetType === 'balance')).toBeUndefined()
      expect(recs.find(r => r.widgetType === 'transactions')).toBeUndefined()
    })

    it('should penalize dismissed suggestions', async () => {
      profile.dismissedSuggestions = ['balance']
      const recs = computeWidgetRecommendations(profile, available, [])
      const balance = recs.find(r => r.widgetType === 'balance')
      expect(balance?.score).toBeLessThan(20)
    })

    it('should boost accepted suggestions', async () => {
      profile.acceptedSuggestions = ['balance']
      const recs = computeWidgetRecommendations(profile, available, [])
      const balance = recs.find(r => r.widgetType === 'balance')
      expect(balance?.score).toBeGreaterThan(5)
    })

    it('should apply correction penalties', async () => {
      profile.corrections['widget_balance'] = 3
      const recs = computeWidgetRecommendations(profile, available, [])
      const balance = recs.find(r => r.widgetType === 'balance')
      expect(balance).toBeDefined()
    })

    it('should return empty array when all widgets are used', () => {
      const recs = computeWidgetRecommendations(profile, ['balance'], ['balance'])
      expect(recs.length).toBe(0)
    })
  })

  describe('computePersonalizationStats', () => {
    it('should return stats for a fresh profile', () => {
      const stats = computePersonalizationStats(profile)
      expect(stats.totalInteractions).toBe(0)
      expect(stats.uniqueTabsVisited).toBe(0)
      expect(stats.uniqueWidgetsUsed).toBe(0)
      expect(stats.learningActive).toBe(true)
      expect(stats.estimatedEfficiencyGain).toBe(0)
    })

    it('should compute stats from interaction data', async () => {
      let p = await recordInteraction(profile, { type: 'tab_visit', target: 'overview' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'account' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })

      const stats = computePersonalizationStats(p)
      expect(stats.totalInteractions).toBe(3)
      expect(stats.uniqueTabsVisited).toBe(2)
      expect(stats.uniqueWidgetsUsed).toBe(1)
    })

    it('should calculate efficiency gain', async () => {
      let p = await recordInteraction(profile, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'overview' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'account' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'transactions' })
      p = await recordSuggestionAccepted(p, 'networkStats')
      p = await recordSuggestionAccepted(p, 'transactions')

      const stats = computePersonalizationStats(p)
      expect(stats.suggestionsAccepted).toBe(2)
      expect(stats.estimatedEfficiencyGain).toBeGreaterThan(0)
    })
  })

  describe('getWidgetEfficiencyScore', () => {
    it('should return base score for unused widget', () => {
      const score = getWidgetEfficiencyScore(profile, 'balance')
      expect(score).toBe(50)
    })

    it('should increase score with usage', async () => {
      let p = await recordInteraction(profile, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })
      const score = getWidgetEfficiencyScore(p, 'balance')
      expect(score).toBeGreaterThan(50)
    })

    it('should decrease score with corrections', async () => {
      let p = await recordInteraction(profile, { type: 'correction', target: 'widget_balance' })
      p = await recordInteraction(p, { type: 'correction', target: 'widget_balance' })
      const score = getWidgetEfficiencyScore(p, 'balance')
      expect(score).toBeLessThan(50)
    })
  })

  describe('identifyPeakUsageHours', () => {
    it('should return empty for no interactions', () => {
      const hours = identifyPeakUsageHours(profile)
      expect(hours).toEqual([])
    })

    it('should identify peak hours from interactions', async () => {
      const now = Date.now()
      const p = {
        ...profile,
        interactionHistory: [
          { type: 'tab_visit' as const, target: 'overview', timestamp: now },
          { type: 'tab_visit' as const, target: 'account', timestamp: now + 3600000 },
          { type: 'tab_visit' as const, target: 'transactions', timestamp: now + 7200000 },
        ],
      }
      const hours = identifyPeakUsageHours(p)
      expect(hours.length).toBeGreaterThan(0)
      hours.forEach((h) => {
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThanOrEqual(23)
      })
    })
  })

  describe('detectPowerUser', () => {
    it('should return false for fresh profile', () => {
      expect(detectPowerUser(profile)).toBe(false)
    })

    it('should return true for heavy usage', async () => {
      let p = profile
      const tabs = ['overview', 'account', 'transactions', 'network', 'builder', 'faucet', 'wallet', 'portfolio', 'charts', 'analytics', 'settings', 'security']
      for (let i = 0; i < 25; i++) {
        for (const tab of tabs) {
          p = await recordInteraction(p, { type: 'tab_visit', target: tab })
        }
      }
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'transactions' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'networkStats' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'assets' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'accountStats' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'priceTicker' })

      expect(detectPowerUser(p)).toBe(true)
    })
  })

  describe('detectCasualUser', () => {
    it('should return true for limited usage', () => {
      expect(detectCasualUser(profile)).toBe(true)
    })

    it('should return false after some interactions', async () => {
      let p = await recordInteraction(profile, { type: 'tab_visit', target: 'overview' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'account' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'transactions' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'network' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'builder' })
      p = await recordInteraction(p, { type: 'tab_visit', target: 'faucet' })

      expect(detectCasualUser(p)).toBe(false)
    })
  })

  describe('computeLayoutCompactnessScore', () => {
    it('should return 0.3 for fresh profile (detected as casual)', () => {
      const score = computeLayoutCompactnessScore(profile)
      expect(score).toBe(0.3)
    })

    it('should return 0.7 for power users', async () => {
      let p = profile
      const tabs = ['overview', 'account', 'transactions', 'network', 'builder', 'faucet', 'wallet', 'portfolio', 'charts', 'analytics', 'settings', 'security']
      for (let i = 0; i < 25; i++) {
        for (const tab of tabs) {
          p = await recordInteraction(p, { type: 'tab_visit', target: tab })
        }
      }
      p = await recordInteraction(p, { type: 'widget_add', target: 'balance' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'transactions' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'networkStats' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'assets' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'accountStats' })
      p = await recordInteraction(p, { type: 'widget_add', target: 'priceTicker' })

      const score = computeLayoutCompactnessScore(p)
      expect(score).toBe(0.7)
    })
  })
})

async function recordSuggestionAccepted(profile: PersonalizationProfile, widgetType: string): Promise<PersonalizationProfile> {
  if (!profile.acceptedSuggestions.includes(widgetType)) {
    profile.acceptedSuggestions.push(widgetType)
  }
  return profile
}

async function recordSuggestionDismissed(profile: PersonalizationProfile, widgetType: string): Promise<PersonalizationProfile> {
  if (!profile.dismissedSuggestions.includes(widgetType)) {
    profile.dismissedSuggestions.push(widgetType)
  }
  return profile
}
