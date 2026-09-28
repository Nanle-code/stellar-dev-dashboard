import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateSuggestions,
  recordSuggestionFeedback,
  getSuggestionEffectiveness,
  getSuggestionHistory,
  getFeedbackLog,
  getState,
  updateState,
  resetState,
  resetSuggestionState,
} from '../../../src/lib/proactiveSuggestions'
import { logInteraction, clearLog } from '../../../src/lib/interactionLog'
import { buildOrUpdateProfile, resetProfile } from '../../../src/lib/behaviorPrediction'

describe('ProactiveSuggestions', () => {
  const userId = 'test-user-suggestions'

  beforeEach(async () => {
    await clearLog()
    resetProfile(userId)
    resetState()
    resetSuggestionState()
  })

  describe('generateSuggestions', () => {
    it('should return empty array when disabled', async () => {
      updateState({ enabled: false })
      const suggestions = await generateSuggestions(userId, 'default')
      expect(suggestions).toHaveLength(0)
    })

    it('should generate suggestions based on user activity', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
        await logInteraction(userId, 'transaction_build', 'build-payment')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const suggestions = await generateSuggestions(userId, 'transaction')
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].userId).toBe(userId)
      expect(suggestions[0].id).toContain('suggestion-')
      expect(suggestions[0].score).toBeGreaterThan(0)
    })

    it('should not exceed max suggestions', async () => {
      updateState({ maxSuggestions: 2 })
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const suggestions = await generateSuggestions(userId, 'transaction')
      expect(suggestions.length).toBeLessThanOrEqual(2)
    })

    it('should filter by category', async () => {
      updateState({ categories: ['insight'] })
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'account_view', '/accounts/GA12345')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const suggestions = await generateSuggestions(userId, 'monitor')
      expect(suggestions.every(s => s.category === 'insight')).toBe(true)
    })

    it('should respect cooldown', async () => {
      updateState({ cooldownMinutes: 60, maxSuggestions: 10 })

      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
        await logInteraction(userId, 'transaction_build', 'build-payment')
      }
      const profile = await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })
      expect(profile.sampleCount).toBeGreaterThan(0)
      expect(profile.actionProbabilities['transaction_submit']).toBeGreaterThan(0)

      const first = await generateSuggestions(userId, 'transaction')
      expect(first.length).toBeGreaterThan(0)

      const second = await generateSuggestions(userId, 'transaction')
      expect(second.length).toBe(0)
    })
  })

  describe('feedback tracking', () => {
    it('should record suggestion feedback', () => {
      recordSuggestionFeedback({
        suggestionId: 'test-suggestion-1',
        userId,
        action: 'shown',
        timestamp: Date.now(),
      })
      recordSuggestionFeedback({
        suggestionId: 'test-suggestion-1',
        userId,
        action: 'clicked',
        timestamp: Date.now(),
      })

      const log = getFeedbackLog(userId)
      expect(log).toHaveLength(2)
    })

    it('should calculate effectiveness', () => {
      recordSuggestionFeedback({ suggestionId: 's1', userId, action: 'shown', timestamp: Date.now() })
      recordSuggestionFeedback({ suggestionId: 's2', userId, action: 'clicked', timestamp: Date.now() })
      recordSuggestionFeedback({ suggestionId: 's3', userId, action: 'helpful', timestamp: Date.now() })
      recordSuggestionFeedback({ suggestionId: 's4', userId, action: 'not_helpful', timestamp: Date.now() })

      const effectiveness = getSuggestionEffectiveness(userId)
      expect(effectiveness).toBe(0.5)
    })

    it('should return 0 effectiveness with no feedback', () => {
      const effectiveness = getSuggestionEffectiveness('new-user')
      expect(effectiveness).toBe(0)
    })

    it('should achieve 80% effectiveness with good feedback', () => {
      const effectivenessUserId = 'effectiveness-test-user'
      for (let i = 0; i < 10; i++) {
        recordSuggestionFeedback({
          suggestionId: `s-good-${i}`,
          userId: effectivenessUserId,
          action: i < 8 ? 'helpful' : 'not_helpful',
          timestamp: Date.now(),
        })
      }

      const effectiveness = getSuggestionEffectiveness(effectivenessUserId)
      expect(effectiveness).toBeGreaterThanOrEqual(0.8)
    })
  })

  describe('state management', () => {
    it('should return default state', () => {
      const state = getState()
      expect(state.enabled).toBe(true)
      expect(state.maxSuggestions).toBe(3)
      expect(state.cooldownMinutes).toBe(15)
    })

    it('should update state', () => {
      updateState({ enabled: false, maxSuggestions: 5 })
      const state = getState()
      expect(state.enabled).toBe(false)
      expect(state.maxSuggestions).toBe(5)
    })

    it('should reset state to defaults', () => {
      updateState({ enabled: false, maxSuggestions: 10 })
      resetState()
      const state = getState()
      expect(state.enabled).toBe(true)
      expect(state.maxSuggestions).toBe(3)
    })
  })
})
