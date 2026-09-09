import { describe, it, expect, beforeEach } from 'vitest'
import {
  logInteraction,
  startSession,
  endSession,
  queryLog,
  getFeatureUsage,
  detectPatterns,
  clearLog,
  clearUserData,
  getLogStats,
  getCurrentSessionId,
} from '../../../src/lib/interactionLog'

describe('InteractionLog', () => {
  const userId = 'test-user-1'

  beforeEach(async () => {
    await clearLog()
  })

  describe('logging', () => {
    it('should log an interaction event', async () => {
      const event = await logInteraction(userId, 'page_view', '/dashboard', { page: 'dashboard' })
      expect(event).toBeDefined()
      expect(event.userId).toBe(userId)
      expect(event.type).toBe('page_view')
      expect(event.target).toBe('/dashboard')
      expect(event.metadata.page).toBe('dashboard')
      expect(event.timestamp).toBeGreaterThan(0)
      expect(event.id).toContain('interaction-')
    })

    it('should assign a session ID', async () => {
      await logInteraction(userId, 'feature_use', 'portfolio')
      const sessionId = getCurrentSessionId()
      expect(sessionId).toContain('session-')
    })
  })

  describe('queryLog', () => {
    it('should filter by userId', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction('other-user', 'page_view', '/settings')
      const results = await queryLog({ userId })
      expect(results).toHaveLength(1)
      expect(results[0].userId).toBe(userId)
    })

    it('should filter by type', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction(userId, 'search', '/search?q=test')
      const results = await queryLog({ userId, type: 'search' })
      expect(results).toHaveLength(1)
      expect(results[0].type).toBe('search')
    })

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await logInteraction(userId, 'page_view', `/page-${i}`)
      }
      const results = await queryLog({ userId, limit: 3, offset: 0 })
      expect(results).toHaveLength(3)
    })
  })

  describe('session management', () => {
    it('should start and end a session', async () => {
      startSession(userId)
      const sessionId = getCurrentSessionId()
      expect(sessionId).toBeTruthy()

      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction(userId, 'feature_use', 'portfolio')

      const summary = await endSession()
      expect(summary).toBeDefined()
      expect(summary!.eventCount).toBeGreaterThanOrEqual(2)
      expect(summary!.featuresUsed).toContain('portfolio')
      expect(summary!.pagesViewed).toContain('/dashboard')
    })
  })

  describe('getFeatureUsage', () => {
    it('should return feature usage summary sorted by count', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'feature_use', 'portfolio', {}, 1000)
      }
      for (let i = 0; i < 3; i++) {
        await logInteraction(userId, 'feature_use', 'contracts', {}, 500)
      }

      const usage = await getFeatureUsage(userId)
      expect(usage).toHaveLength(2)
      expect(usage[0].feature).toBe('portfolio')
      expect(usage[0].useCount).toBe(5)
      expect(usage[0].totalDuration).toBe(5000)
      expect(usage[1].feature).toBe('contracts')
      expect(usage[1].useCount).toBe(3)
    })
  })

  describe('detectPatterns', () => {
    it('should detect sequential patterns', async () => {
      for (let i = 0; i < 5; i++) {
        await logInteraction(userId, 'search', '/search', {})
        await logInteraction(userId, 'account_view', '/accounts/GA12345', {})
      }

      const patterns = await detectPatterns(userId)
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns.some(p => p.pattern.includes('search') && p.pattern.includes('account_view'))).toBe(true)
    })
  })

  describe('getLogStats', () => {
    it('should return correct statistics', async () => {
      expect(getLogStats().totalEvents).toBe(0)

      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction(userId, 'feature_use', 'portfolio')

      const stats = getLogStats()
      expect(stats.totalEvents).toBe(2)
      expect(stats.totalSessions).toBeGreaterThanOrEqual(1)
      expect(stats.oldestEvent).toBeGreaterThan(0)
      expect(stats.newestEvent).toBeGreaterThan(0)
    })
  })

  describe('clearUserData', () => {
    it('should remove all data for a user', async () => {
      await logInteraction(userId, 'page_view', '/dashboard')
      await logInteraction('other-user', 'page_view', '/settings')

      await clearUserData(userId)
      const results = await queryLog({})
      expect(results.every(r => r.userId !== userId)).toBe(true)
    })
  })
})
