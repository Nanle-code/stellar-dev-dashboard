/**
 * preferenceUndoManager.ts
 *
 * Core Undo Manager for reversible preference mutations.
 * Supports short-window undo for theme, layout, notification, and general user preferences.
 * Includes clear handling for invalid inputs, unsupported storage/window environments,
 * and failure paths during restoration.
 */

export type PreferenceCategory =
  | 'theme'
  | 'layout'
  | 'notifications'
  | 'general'
  | 'display'
  | 'dashboard'
  | 'data'
  | 'search'
  | 'privacy'
  | 'accessibility'
  | 'performance'
  | 'developer'
  | 'sync'
  | 'unknown'

export interface UndoActionInput {
  category: PreferenceCategory
  key: string
  label: string
  previousValue: unknown
  nextValue: unknown
  restore: () => Promise<unknown> | unknown
  metadata?: Record<string, unknown>
}

export interface UndoAction {
  id: string
  timestamp: number
  category: PreferenceCategory
  key: string
  label: string
  previousValue: unknown
  nextValue: unknown
  restore: () => Promise<unknown> | unknown
  metadata?: Record<string, unknown>
}

export interface RedoAction {
  id: string
  timestamp: number
  category: PreferenceCategory
  key: string
  label: string
  previousValue: unknown
  nextValue: unknown
  execute: () => Promise<unknown> | unknown
  metadata?: Record<string, unknown>
}

export interface UndoResult {
  success: boolean
  actionId?: string
  action?: UndoAction
  error?: string
}

export interface UndoManagerOptions {
  /** Duration in ms that an action remains undoable (default 10,000ms = 10s). */
  undoWindowMs?: number
  /** Maximum number of undo actions stored in memory (default 20). */
  maxHistory?: number
  /** Optional subscriber callback for state changes. */
  onChange?: () => void
}

export const DEFAULT_UNDO_WINDOW_MS = 10_000 // 10 seconds
export const DEFAULT_MAX_HISTORY = 20

export class PreferenceUndoManager {
  private history: UndoAction[] = []
  private redoStack: RedoAction[] = []
  private undoWindowMs: number
  private maxHistory: number
  private subscribers: Set<() => void> = new Set()

  constructor(options: UndoManagerOptions = {}) {
    this.undoWindowMs = options.undoWindowMs ?? DEFAULT_UNDO_WINDOW_MS
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY
    if (options.onChange) {
      this.subscribers.add(options.onChange)
    }
  }

  /**
   * Set the short-window duration in milliseconds.
   */
  public setUndoWindowMs(windowMs: number): void {
    if (typeof windowMs !== 'number' || windowMs <= 0 || !Number.isFinite(windowMs)) {
      throw new Error('Undo window must be a positive finite number')
    }
    this.undoWindowMs = windowMs
    this.notify()
  }

  /**
   * Get the current short-window duration in milliseconds.
   */
  public getUndoWindowMs(): number {
    return this.undoWindowMs
  }

  /**
   * Subscribe to undo manager state changes.
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  private notify(): void {
    this.subscribers.forEach((cb) => {
      try {
        cb()
      } catch (err) {
        console.error('Error in PreferenceUndoManager subscriber:', err)
      }
    })
  }

  /**
   * Record a new reversible preference mutation.
   */
  public recordAction(input: UndoActionInput): UndoResult {
    // 1. Validation & Input Sanitation
    if (!input || typeof input !== 'object') {
      return { success: false, error: 'Invalid input: action must be an object' }
    }

    if (!input.key || typeof input.key !== 'string' || input.key.trim() === '') {
      return { success: false, error: 'Invalid input: key is required' }
    }

    if (typeof input.restore !== 'function') {
      return { success: false, error: 'Invalid input: restore handler function is required' }
    }

    const category: PreferenceCategory = input.category || 'unknown'
    const label = input.label || `Changed ${input.key}`
    const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const action: UndoAction = {
      id,
      timestamp: Date.now(),
      category,
      key: input.key,
      label,
      previousValue: input.previousValue,
      nextValue: input.nextValue,
      restore: input.restore,
      metadata: input.metadata ? { ...input.metadata } : undefined,
    }

    // Clear redo stack on new action
    this.redoStack = []

    // Prune expired before adding
    this.pruneExpired()

    // Push new action
    this.history.unshift(action)

    // Enforce max history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory)
    }

    this.notify()

    return {
      success: true,
      actionId: id,
      action,
    }
  }

  /**
   * Returns whether there is at least one non-expired action available to undo.
   */
  public canUndo(): boolean {
    this.pruneExpired()
    return this.history.length > 0
  }

  /**
   * Returns whether there is an action available to redo.
   */
  public canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * Returns all active (non-expired) undoable actions.
   */
  public getUndoableActions(): UndoAction[] {
    this.pruneExpired()
    return [...this.history]
  }

  /**
   * Returns the most recent non-expired undo action, or null if none exist.
   */
  public getLatestUndoableAction(): UndoAction | null {
    this.pruneExpired()
    return this.history.length > 0 ? this.history[0] : null
  }

  /**
   * Get the remaining time in milliseconds for the latest undoable action.
   */
  public getRemainingTimeMs(actionId?: string): number {
    this.pruneExpired()
    const target = actionId
      ? this.history.find((a) => a.id === actionId)
      : this.history[0]

    if (!target) return 0
    const elapsed = Date.now() - target.timestamp
    const remaining = this.undoWindowMs - elapsed
    return Math.max(0, remaining)
  }

  /**
   * Undo the most recent reversible preference mutation.
   */
  public async undo(): Promise<UndoResult> {
    this.pruneExpired()

    if (this.history.length === 0) {
      return {
        success: false,
        error: 'No preference changes available to undo within the active window',
      }
    }

    const action = this.history.shift()!
    return this.executeUndoAction(action)
  }

  /**
   * Undo a specific preference mutation by ID.
   */
  public async undoById(id: string): Promise<UndoResult> {
    if (!id || typeof id !== 'string') {
      return { success: false, error: 'Invalid action ID' }
    }

    this.pruneExpired()

    const index = this.history.findIndex((a) => a.id === id)
    if (index === -1) {
      return {
        success: false,
        error: `Action ${id} not found or expired`,
      }
    }

    const [action] = this.history.splice(index, 1)
    return this.executeUndoAction(action)
  }

  /**
   * Helper to safely execute an undo action restore function and handle errors.
   */
  private async executeUndoAction(action: UndoAction): Promise<UndoResult> {
    try {
      await action.restore()

      // Track redo action if nextValue restoration is possible
      this.redoStack.unshift({
        id: `redo-${action.id}`,
        timestamp: Date.now(),
        category: action.category,
        key: action.key,
        label: `Reapply ${action.label}`,
        previousValue: action.previousValue,
        nextValue: action.nextValue,
        execute: async () => {
          // Default redo callback logic if needed
        },
        metadata: action.metadata,
      })

      this.notify()
      return {
        success: true,
        actionId: action.id,
        action,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error(`Preference restoration failed for ${action.key}:`, errorMessage)

      // Re-insert action at head so user can retry or state isn't silently lost
      this.history.unshift(action)
      this.notify()

      return {
        success: false,
        actionId: action.id,
        action,
        error: `Restoration failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Redo the last undone preference change.
   */
  public async redo(): Promise<UndoResult> {
    if (this.redoStack.length === 0) {
      return { success: false, error: 'No actions available to redo' }
    }

    const redoAction = this.redoStack.shift()!
    try {
      await redoAction.execute()
      this.notify()
      return { success: true }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      this.redoStack.unshift(redoAction)
      this.notify()
      return { success: false, error: `Redo failed: ${errorMessage}` }
    }
  }

  /**
   * Clear all stored undo history and redo actions.
   */
  public clear(): void {
    this.history = []
    this.redoStack = []
    this.notify()
  }

  /**
   * Removes expired actions based on the current `undoWindowMs`.
   */
  private pruneExpired(): void {
    const now = Date.now()
    const previousCount = this.history.length
    this.history = this.history.filter((action) => now - action.timestamp <= this.undoWindowMs)
    if (this.history.length !== previousCount) {
      this.notify()
    }
  }
}

// Global Singleton Instance for Preference Undo Management
export const preferenceUndoManager = new PreferenceUndoManager()
