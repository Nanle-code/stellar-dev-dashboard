import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDefaultSettings,
  getSettings,
  updateSettings,
  resetSettings,
  determinePersona,
  getDashboardAdaptation,
  personalizeSearchResults,
  getPersonalizationSummary,
  refreshPersonalization,
  clearPersonalizationData,
} from '../../../src/lib/personalizationEngine'
import { logInteraction, clearLog } from '../../../src/lib/interactionLog'
import { buildOrUpdateProfile, resetProfile } from '../../../src/lib/behaviorPrediction'
import { resetState } from '../../../src/lib/proactiveSuggestions'

describe('PersonalizationEngine', () => {
  const userId = 'test-user-personalization'

  beforeEach(async () => {
    await clearLog()
    resetProfile(userId)
    resetSettings(userId)
    resetState()
  })

  describe('settings management', () => {
    it('should return default settings', () => {
      const defaults = getDefaultSettings()
      expect(defaults.enabled).toBe(true)
      expect(defaults.adaptDashboard).toBe(true)
      expect(defaults.suggestFeatures).toBe(true)
      expect(defaults.collectInteractionData).toBe(true)
      expect(defaults.dataRetentionDays).toBe(30)
    })

    it('should get settings for unknown user', () => {
      const settings = getSettings('new-user')
      expect(settings.enabled).toBe(true)
    })

    it('should update settings', () => {
      updateSettings(userId, { enabled: false, adaptDashboard: false })
      const settings = getSettings(userId)
      expect(settings.enabled).toBe(false)
      expect(settings.adaptDashboard).toBe(false)
      expect(settings.suggestFeatures).toBe(true)
    })

    it('should reset settings', () => {
      updateSettings(userId, { enabled: false })
      resetSettings(userId)
      const settings = getSettings(userId)
      expect(settings.enabled).toBe(true)
    })
  })

  describe('determinePersona', () => {
    it('should return explorer with low confidence for unknown users', async () => {
      const persona = await determinePersona(userId)
      expect(persona.type).toBe('explorer')
      expect(persona.confidence).toBeLessThanOrEqual(0.3)
    })

    it('should determine persona based on behavior', async () => {
      for (let i = 0; i < 10; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
        await logInteraction(userId, 'transaction_build', 'build-payment')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const persona = await determinePersona(userId)
      expect(['trader', 'developer', 'power_user', 'explorer', 'analyst']).toContain(persona.type)
      expect(persona.traits.length).toBeGreaterThan(0)
    })
  })

  describe('getDashboardAdaptation', () => {
    it('should return default adaptation when disabled', async () => {
      updateSettings(userId, { enabled: false })
      const adaptation = await getDashboardAdaptation(userId)
      expect(adaptation.density).toBe('comfortable')
      expect(adaptation.recommendedWidgets).toHaveLength(0)
    })

    it('should adapt based on behavior patterns', async () => {
      for (let i = 0; i < 10; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
        await logInteraction(userId, 'feature_use', 'portfolio')
        await logInteraction(userId, 'feature_use', 'analytics')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const adaptation = await getDashboardAdaptation(userId)
      expect(adaptation.layoutOrder.length).toBeGreaterThan(0)
    })
  })

  describe('personalizeSearchResults', () => {
    it('should return results unchanged when disabled', async () => {
      updateSettings(userId, { enabled: false, personalizeSearch: false })
      const results = [
        { id: '1', type: 'transaction', score: 0.5 },
        { id: '2', type: 'account', score: 0.3 },
      ]
      const personalized = await personalizeSearchResults(userId, 'test', results)
      expect(personalized).toEqual(results)
    })

    it('should boost results matching user preferences', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'feature_use', 'portfolio')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const results = [
        { id: '1', type: 'portfolio', score: 0.5 },
        { id: '2', type: 'transaction', score: 0.6 },
      ]
      const personalized = await personalizeSearchResults(userId, 'test', results)
      const portfolioResult = personalized.find(r => r.id === '1')
      expect(portfolioResult!.score).toBeGreaterThan(0.5)
    })
  })

  describe('getPersonalizationSummary', () => {
    it('should return summary for user', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction(userId, 'feature_use', 'portfolio')
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const summary = await getPersonalizationSummary(userId)
      expect(summary.userId).toBe(userId)
      expect(summary.topFeatures).toBeDefined()
      expect(summary.predictionAccuracy).toBeGreaterThanOrEqual(0)
      expect(summary.suggestionEffectiveness).toBeGreaterThanOrEqual(0)
      expect(summary.lastUpdated).toBeGreaterThan(0)
    })
  })

  describe('refreshPersonalization', () => {
    it('should refresh profile data', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await refreshPersonalization(userId)
      const summary = await getPersonalizationSummary(userId)
      expect(summary.lastUpdated).toBeGreaterThan(0)
    })
  })

  describe('clearPersonalizationData', () => {
    it('should clear all personalization data', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })
      updateSettings(userId, { enabled: false })

      await clearPersonalizationData(userId)
      const summary = await getPersonalizationSummary(userId)
      expect(summary.topFeatures).toHaveLength(0)
      const settings = getSettings(userId)
      expect(settings.enabled).toBe(true)
    })
  })
})
