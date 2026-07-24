import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildOrUpdateProfile,
  predictIntent,
  predictNextAction,
  recordPredictionFeedback,
  getProfile,
  getAccuracy,
  resetProfile,
} from '../../../src/lib/behaviorPrediction'
import { logInteraction, clearLog, startSession } from '../../../src/lib/interactionLog'

describe('BehaviorPrediction', () => {
  const userId = 'test-user-bp'

  beforeEach(async () => {
    await clearLog()
    resetProfile(userId)
  })

  describe('buildOrUpdateProfile', () => {
    it('should build a profile with minimal data', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction(userId, 'feature_use', 'portfolio')
      await logInteraction(userId, 'search', '/search')

      const profile = await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })
      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(profile.sampleCount).toBeGreaterThanOrEqual(3)
      expect(profile.topFeatures).toBeDefined()
      expect(Array.isArray(profile.topFeatures)).toBe(true)
    })

    it('should update existing profile with new data', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      const profile1 = await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      await logInteraction(userId, 'feature_use', 'portfolio')
      const profile2 = await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      expect(profile2.sampleCount).toBeGreaterThanOrEqual(profile1.sampleCount)
    })
  })

  describe('predictIntent', () => {
    it('should return a default prediction for users with insufficient data', async () => {
      const prediction = await predictIntent(userId, 'onboarding')
      expect(prediction).toBeDefined()
      expect(prediction.intent).toBeTruthy()
      expect(prediction.probability).toBeGreaterThan(0)
      expect(prediction.alternativeIntents.length).toBeGreaterThan(0)
    })

    it('should predict intent based on usage patterns', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'transaction_submit', 'send-payment')
        await logInteraction(userId, 'transaction_build', 'build-payment')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const prediction = await predictIntent(userId, 'transaction')
      expect(prediction.intent).toBe('transact')
      expect(prediction.probability).toBeGreaterThan(0.3)
    })
  })

  describe('predictNextAction', () => {
    it('should return a default for new users', async () => {
      const prediction = await predictNextAction(userId)
      expect(prediction).toBeDefined()
      expect(prediction.predictedAction).toBeTruthy()
      expect(prediction.alternativeActions.length).toBeGreaterThan(0)
    })

    it('should predict based on user history', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'account_view', '/accounts/GA12345')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const prediction = await predictNextAction(userId)
      expect(prediction).toBeDefined()
      expect(prediction.timestamp).toBeGreaterThan(0)
    })
  })

  describe('prediction feedback', () => {
    it('should record feedback and update accuracy', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'page_view', '/dashboard')
      }
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      for (let i = 0; i < 8; i++) {
        recordPredictionFeedback({
          predictionId: `pred-${i}`,
          userId,
          actualAction: 'page_view',
          correct: i < 7,
          timestamp: Date.now(),
        })
      }

      const accuracy = getAccuracy(userId)
      expect(accuracy).toBeGreaterThanOrEqual(0.7)
    })

    it('should adjust accuracy downward with incorrect predictions', async () => {
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      recordPredictionFeedback({
        predictionId: 'pred-wrong-1',
        userId,
        actualAction: 'wrong',
        correct: false,
        timestamp: Date.now(),
      })
      recordPredictionFeedback({
        predictionId: 'pred-wrong-2',
        userId,
        actualAction: 'wrong',
        correct: false,
        timestamp: Date.now(),
      })

      const accuracy = getAccuracy(userId)
      expect(accuracy).toBeLessThan(0.5)
    })
  })

  describe('getProfile', () => {
    it('should return null for unknown users', () => {
      const profile = getProfile('nonexistent-user')
      expect(profile).toBeNull()
    })

    it('should return profile after building', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })

      const profile = getProfile(userId)
      expect(profile).not.toBeNull()
      expect(profile!.userId).toBe(userId)
    })
  })

  describe('resetProfile', () => {
    it('should clear profile and feedback', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await buildOrUpdateProfile(userId, { minSamplesForProfile: 1 })
      recordPredictionFeedback({
        predictionId: 'pred-reset',
        userId,
        actualAction: 'page_view',
        correct: true,
        timestamp: Date.now(),
      })

      resetProfile(userId)
      expect(getProfile(userId)).toBeNull()
      expect(getAccuracy(userId)).toBe(0)
    })
  })
})
