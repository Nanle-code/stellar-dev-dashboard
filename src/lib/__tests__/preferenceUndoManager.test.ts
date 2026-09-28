import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PreferenceUndoManager,
  preferenceUndoManager,
  type UndoActionInput,
} from '../preferenceUndoManager'
import {
  loadPreferences,
  savePreferences,
  updatePreferenceWithUndo,
  saveDashboardLayoutWithUndo,
  resetPreferencesWithUndo,
  DEFAULT_PREFERENCES,
} from '../userPreferences'
import {
  loadNotificationPreferences,
  saveNotificationPreferencesWithUndo,
  defaultNotificationPreferences,
} from '../notificationPreferences'
import { getStoredValue, setStoredValue } from '../storage'

describe('PreferenceUndoManager', () => {
  let undoManager: PreferenceUndoManager

  beforeEach(() => {
    undoManager = new PreferenceUndoManager({ undoWindowMs: 5000, maxHistory: 5 })
    preferenceUndoManager.clear()
    localStorage.clear()
  })

  describe('Primary Flow', () => {
    it('should record a preference mutation and successfully undo it', async () => {
      let currentTheme = 'dark'
      const recordResult = undoManager.recordAction({
        category: 'theme',
        key: 'theme',
        label: 'Changed Theme to light',
        previousValue: 'dark',
        nextValue: 'light',
        restore: () => {
          currentTheme = 'dark'
        },
      })

      expect(recordResult.success).toBe(true)
      expect(undoManager.canUndo()).toBe(true)
      expect(undoManager.getLatestUndoableAction()?.key).toBe('theme')

      const undoResult = await undoManager.undo()
      expect(undoResult.success).toBe(true)
      expect(currentTheme).toBe('dark')
      expect(undoManager.canUndo()).toBe(false)
    })

    it('should support theme mutation undo via userPreferences helpers', async () => {
      await savePreferences({ theme: 'dark' })

      const { next, undoResult } = await updatePreferenceWithUndo('theme', 'light')
      expect(next.theme).toBe('light')
      expect(undoResult.success).toBe(true)

      const restored = await preferenceUndoManager.undo()
      expect(restored.success).toBe(true)

      const reloaded = await loadPreferences()
      expect(reloaded.theme).toBe('dark')
    })

    it('should support dashboard layout mutation undo via userPreferences helpers', async () => {
      const initialLayout = [{ id: 'widget-1', type: 'chart', span: 2, order: 0 }]
      const updatedLayout = [
        { id: 'widget-1', type: 'chart', span: 2, order: 1 },
        { id: 'widget-2', type: 'stats', span: 1, order: 0 },
      ]

      await savePreferences({ dashboardLayout: initialLayout })

      const { undoResult } = await saveDashboardLayoutWithUndo(updatedLayout)
      expect(undoResult.success).toBe(true)

      const restored = await preferenceUndoManager.undo()
      expect(restored.success).toBe(true)

      const reloaded = await loadPreferences()
      expect(reloaded.dashboardLayout).toEqual(initialLayout)
    })

    it('should support notification preference mutation undo', async () => {
      const initial = defaultNotificationPreferences()
      const updated = { ...initial, minimumPriority: 'high' as const }

      await saveNotificationPreferencesWithUndo(updated)
      let stored = await loadNotificationPreferences()
      expect(stored.minimumPriority).toBe('high')

      const restored = await preferenceUndoManager.undo()
      expect(restored.success).toBe(true)

      stored = await loadNotificationPreferences()
      expect(stored.minimumPriority).toBe(initial.minimumPriority)
    })

    it('should support redoing an undone preference mutation', async () => {
      let val = 'initial'
      undoManager.recordAction({
        category: 'general',
        key: 'currency',
        label: 'Changed Currency to EUR',
        previousValue: 'USD',
        nextValue: 'EUR',
        restore: () => {
          val = 'USD'
        },
      })

      val = 'EUR'
      await undoManager.undo()
      expect(val).toBe('USD')

      expect(undoManager.canRedo()).toBe(true)
    })
  })

  describe('Boundary Cases', () => {
    it('should expire actions outside of short window', async () => {
      vi.useFakeTimers()

      undoManager.recordAction({
        category: 'display',
        key: 'compactMode',
        label: 'Enabled Compact Mode',
        previousValue: false,
        nextValue: true,
        restore: () => {},
      })

      expect(undoManager.canUndo()).toBe(true)

      // Fast forward time past 5000ms window
      vi.advanceTimersByTime(5001)

      expect(undoManager.canUndo()).toBe(false)
      expect(undoManager.getLatestUndoableAction()).toBeNull()

      const undoResult = await undoManager.undo()
      expect(undoResult.success).toBe(false)
      expect(undoResult.error).toContain('No preference changes available')

      vi.useRealTimers()
    })

    it('should enforce max history limit', () => {
      for (let i = 1; i <= 10; i++) {
        undoManager.recordAction({
          category: 'general',
          key: `key-${i}`,
          label: `Action ${i}`,
          previousValue: i - 1,
          nextValue: i,
          restore: () => {},
        })
      }

      // Max history set to 5
      const actions = undoManager.getUndoableActions()
      expect(actions.length).toBe(5)
      expect(actions[0].key).toBe('key-10')
      expect(actions[4].key).toBe('key-6')
    })

    it('should support undoing specific action by ID', async () => {
      let state = { a: 1, b: 2 }

      const res1 = undoManager.recordAction({
        category: 'general',
        key: 'a',
        label: 'Updated A',
        previousValue: 1,
        nextValue: 10,
        restore: () => {
          state.a = 1
        },
      })

      const res2 = undoManager.recordAction({
        category: 'general',
        key: 'b',
        label: 'Updated B',
        previousValue: 2,
        nextValue: 20,
        restore: () => {
          state.b = 2
        },
      })

      state = { a: 10, b: 20 }

      // Undo the first action by ID (key 'a')
      const undoRes = await undoManager.undoById(res1.actionId!)
      expect(undoRes.success).toBe(true)
      expect(state.a).toBe(1)
      expect(state.b).toBe(20)
    })

    it('should allow dynamically adjusting the short-window duration', () => {
      undoManager.setUndoWindowMs(15000)
      expect(undoManager.getUndoWindowMs()).toBe(15000)

      expect(() => undoManager.setUndoWindowMs(0)).toThrow()
      expect(() => undoManager.setUndoWindowMs(-100)).toThrow()
    })
  })

  describe('Failure & Edge Cases', () => {
    it('should handle invalid action inputs gracefully', () => {
      // @ts-expect-error null input test
      const resNull = undoManager.recordAction(null)
      expect(resNull.success).toBe(false)
      expect(resNull.error).toContain('Invalid input')

      // @ts-expect-error missing key test
      const resNoKey = undoManager.recordAction({ category: 'general', restore: () => {} })
      expect(resNoKey.success).toBe(false)

      // @ts-expect-error missing restore function test
      const resNoRestore = undoManager.recordAction({ category: 'general', key: 'test' })
      expect(resNoRestore.success).toBe(false)
    })

    it('should handle restoration callback failures gracefully', async () => {
      const recordRes = undoManager.recordAction({
        category: 'general',
        key: 'failingKey',
        label: 'Will fail on restore',
        previousValue: 'A',
        nextValue: 'B',
        restore: () => {
          throw new Error('Database write connection failed')
        },
      })

      const undoRes = await undoManager.undo()
      expect(undoRes.success).toBe(false)
      expect(undoRes.error).toContain('Restoration failed: Database write connection failed')
    })

    it('should handle storage failure when persisting or restoring preferences', async () => {
      const setStoredSpy = vi.spyOn(await import('../storage'), 'setStoredValue')
      setStoredSpy.mockRejectedValueOnce(new Error('Storage quota exceeded'))

      const recordRes = updatePreferenceWithUndo('theme', 'light')
      await expect(recordRes).resolves.toBeDefined()

      setStoredSpy.mockRestore()
    })
  })
})
