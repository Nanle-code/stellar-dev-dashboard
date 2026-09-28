/**
 * usePreferenceUndo.ts
 * React hook providing reactive state and helper functions for preference undo operations.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  preferenceUndoManager,
  type UndoAction,
  type UndoResult,
} from '../lib/preferenceUndoManager'

export interface UsePreferenceUndoReturn {
  canUndo: boolean
  canRedo: boolean
  latestAction: UndoAction | null
  actions: UndoAction[]
  timeRemainingMs: number
  undo: () => Promise<UndoResult>
  undoById: (id: string) => Promise<UndoResult>
  redo: () => Promise<UndoResult>
  clear: () => void
  setWindowMs: (ms: number) => void
}

export function usePreferenceUndo(options?: { pollIntervalMs?: number }): UsePreferenceUndoReturn {
  const pollIntervalMs = options?.pollIntervalMs ?? 500
  const [canUndo, setCanUndo] = useState<boolean>(() => preferenceUndoManager.canUndo())
  const [canRedo, setCanRedo] = useState<boolean>(() => preferenceUndoManager.canRedo())
  const [latestAction, setLatestAction] = useState<UndoAction | null>(() => preferenceUndoManager.getLatestUndoableAction())
  const [actions, setActions] = useState<UndoAction[]>(() => preferenceUndoManager.getUndoableActions())
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(() => preferenceUndoManager.getRemainingTimeMs())

  const syncState = useCallback(() => {
    setCanUndo(preferenceUndoManager.canUndo())
    setCanRedo(preferenceUndoManager.canRedo())
    setLatestAction(preferenceUndoManager.getLatestUndoableAction())
    setActions(preferenceUndoManager.getUndoableActions())
    setTimeRemainingMs(preferenceUndoManager.getRemainingTimeMs())
  }, [])

  useEffect(() => {
    syncState()
    const unsubscribe = preferenceUndoManager.subscribe(syncState)

    const timer = setInterval(() => {
      syncState()
    }, pollIntervalMs)

    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [syncState, pollIntervalMs])

  const undo = useCallback(async () => {
    const res = await preferenceUndoManager.undo()
    syncState()
    return res
  }, [syncState])

  const undoById = useCallback(async (id: string) => {
    const res = await preferenceUndoManager.undoById(id)
    syncState()
    return res
  }, [syncState])

  const redo = useCallback(async () => {
    const res = await preferenceUndoManager.redo()
    syncState()
    return res
  }, [syncState])

  const clear = useCallback(() => {
    preferenceUndoManager.clear()
    syncState()
  }, [syncState])

  const setWindowMs = useCallback((ms: number) => {
    preferenceUndoManager.setUndoWindowMs(ms)
    syncState()
  }, [syncState])

  return {
    canUndo,
    canRedo,
    latestAction,
    actions,
    timeRemainingMs,
    undo,
    undoById,
    redo,
    clear,
    setWindowMs,
  }
}
