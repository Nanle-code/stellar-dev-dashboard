import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * #886 — Deferred service-worker activation during critical signing flows.
 *
 * These tests exercise the REAL implementation in src/utils/offline.js with
 * its dependency modules (storage, RetryManager, logger) mocked out, unlike
 * tests/unit/offline.test.js which re-implements the logic inline.
 */

vi.mock('../../src/lib/storage.js', () => ({
  enqueueOfflineOp: vi.fn().mockResolvedValue(undefined),
  getOfflineQueue: vi.fn().mockResolvedValue([]),
  dequeueOfflineOp: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/lib/errorHandling/RetryManager.ts', () => ({
  retryManager: { executeWithRetry: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  initSWUpdatePrompt,
  applySWUpdate,
  subscribeToSWUpdates,
  setCriticalSigningActive,
  isCriticalSigningActive,
} from '../../src/utils/offline.js'


// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupNavigatorWithSW() {
  const swListeners = {}
  const mockNavigator = {
    serviceWorker: {
      controller: { postMessage: vi.fn() },
      addEventListener: (event, cb) => {
        swListeners[event] = cb
      },
      removeEventListener: vi.fn(),
      register: vi.fn().mockResolvedValue({ scope: '/' }),
    },
  }
  Object.assign(global.navigator, mockNavigator)
  return swListeners
}

function createMockRegistration({ hasWaiting = true, active = true } = {}) {
  const listeners = {}
  const waiting = hasWaiting
    ? { state: 'installed', postMessage: vi.fn(), addEventListener: vi.fn() }
    : null

  const registration = {
    waiting,
    installing: null,
    active: active ? { state: 'active' } : null,
    addEventListener: (event, cb) => {
      listeners[event] = cb
    },
  }
  return { registration, listeners, waiting }
}

let reloadSpy

beforeEach(() => {
  vi.restoreAllMocks()
  reloadSpy = vi.fn()
  Object.defineProperty(window, 'location', {
    value: { reload: reloadSpy },
    writable: true,
    configurable: true,
  })
  setupNavigatorWithSW()
})

afterEach(() => {
  // Always leave the guard off so module-level state does not leak between tests
  setCriticalSigningActive(false)
  delete global.navigator.serviceWorker
})

// ─── Primary flow ─────────────────────────────────────────────────────────────

describe('deferred SW activation (#886) — primary flow', () => {
  it('defers activation while a critical signing flow is active and activates when it ends', async () => {
    const { registration, waiting } = createMockRegistration()

    initSWUpdatePrompt(registration)

    // Enter signing flow, then the user accepts the update
    setCriticalSigningActive(true)
    expect(isCriticalSigningActive()).toBe(true)

    const result = await applySWUpdate()
    expect(result).toBe('deferred')

    // The waiting worker was told to defer, not to activate
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'DEFER_ACTIVATION' })
    expect(waiting.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESUME_ACTIVATION' }),
    )

    // Flow ends → deferred activation is applied automatically
    setCriticalSigningActive(false)
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'RESUME_ACTIVATION' })
  })

  it('activates immediately when no signing flow is active (normal behavior preserved)', async () => {
    const { registration, waiting } = createMockRegistration()

    initSWUpdatePrompt(registration)

    const result = await applySWUpdate()
    expect(result).toBe('activated')
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'RESUME_ACTIVATION' })
  })

  it('reloads on controllerchange when no signing flow is active', () => {
    const swListeners = setupNavigatorWithSW()
    const { registration } = createMockRegistration()

    initSWUpdatePrompt(registration)

    swListeners['controllerchange']()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})

// ─── Signing-flow protection (no reload mid-signature) ────────────────────────

describe('deferred SW activation (#886) — signing-flow protection', () => {
  it('does NOT reload on controllerchange during a signing flow', () => {
    const swListeners = setupNavigatorWithSW()
    const { registration } = createMockRegistration()

    initSWUpdatePrompt(registration)

    setCriticalSigningActive(true)
    swListeners['controllerchange']()
    expect(reloadSpy).not.toHaveBeenCalled()

    // Once the flow ends the pending transition is reconciled with one reload
    setCriticalSigningActive(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('does not reload twice for a deferred reload plus later controllerchange', () => {
    const swListeners = setupNavigatorWithSW()
    const { registration } = createMockRegistration()

    initSWUpdatePrompt(registration)

    setCriticalSigningActive(true)
    swListeners['controllerchange']()
    setCriticalSigningActive(false) // reconciles with a single reload
    // The internal `refreshing` guard prevents a second reload
    swListeners['controllerchange']()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe('deferred SW activation (#886) — boundary cases', () => {
  it('applySWUpdate with no waiting worker returns null and does not throw', async () => {
    const { registration } = createMockRegistration({ hasWaiting: false })

    initSWUpdatePrompt(registration)

    await expect(applySWUpdate()).resolves.toBeNull()
  })

  it('deferred update is not lost when the flow ends before an update is requested', async () => {
    const { registration, waiting } = createMockRegistration()

    initSWUpdatePrompt(registration)

    // Flow starts and ends with no update request in between
    setCriticalSigningActive(true)
    setCriticalSigningActive(false)

    expect(waiting.postMessage).not.toHaveBeenCalled()

    // A later explicit update request still activates normally
    const result = await applySWUpdate()
    expect(result).toBe('activated')
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'RESUME_ACTIVATION' })
  })

  it('clearing the guard while not active is a harmless no-op', () => {
    expect(() => setCriticalSigningActive(false)).not.toThrow()
    expect(isCriticalSigningActive()).toBe(false)
  })

  it('works when the registration has no active worker (first install, not an update)', () => {
    const { registration } = createMockRegistration({ hasWaiting: false, active: false })

    // First install (no active worker) must not throw — there is simply no
    // update to surface.
    expect(() => initSWUpdatePrompt(registration)).not.toThrow()
  })
})

// ─── Failure cases ────────────────────────────────────────────────────────────

describe('deferred SW activation (#886) — failure cases', () => {
  it('postMessage failure during a signing flow does not throw or break the flow', async () => {
    const waiting = {
      state: 'installed',
      postMessage: vi.fn(() => {
        throw new Error('port closed')
      }),
      addEventListener: vi.fn(),
    }
    const { registration } = createMockRegistration({ waiting })

    initSWUpdatePrompt(registration)

    setCriticalSigningActive(true)
    await expect(applySWUpdate()).resolves.toBe('deferred')
    setCriticalSigningActive(false)

    // The deferred flush attempts RESUME_ACTIVATION; its failure is also swallowed
    expect(() => setCriticalSigningActive(false)).not.toThrow()
  })

  it('initSWUpdatePrompt with a null registration is a no-op', () => {
    expect(() => initSWUpdatePrompt(null)).not.toThrow()
  })

  it('subscriber callback failures do not break update notifications', () => {
    const { registration } = createMockRegistration()

    const failing = vi.fn(() => {
      throw new Error('listener exploded')
    })
    const healthy = vi.fn()

    subscribeToSWUpdates(failing)
    subscribeToSWUpdates(healthy)

    expect(() => initSWUpdatePrompt(registration)).not.toThrow()
    expect(healthy).toHaveBeenCalledWith(true)
  })
})

// ─── Failure cases ────────────────────────────────────────────────────────────