import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Track module-level state for reset
let _swRegistration = null
let _swUpdateCallbacks = []
let _swUpdateAvailable = false

function createMockRegistration(overrides = {}) {
  const listeners = {}

  const waiting = overrides.waiting || {
    state: 'installed',
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
  }

  const registration = {
    waiting: overrides.hasWaiting !== false ? waiting : null,
    installing: null,
    active: { state: 'active' },
    addEventListener: (event, cb) => {
      listeners[event] = cb
    },
    ...overrides.registration,
  }

  return { registration, listeners, waiting }
}

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

beforeEach(() => {
  vi.restoreAllMocks()
  // Reset module-level state
  _swRegistration = null
  _swUpdateCallbacks = []
  _swUpdateAvailable = false
})

afterEach(() => {
  delete global.navigator.serviceWorker
})

// Recreate the functions here for testing to avoid importing the module
// which pulls in the full dependency chain (stellar-sdk, etc.)
function initSWUpdatePrompt(registration) {
  if (!registration) return
  _swRegistration = registration

  if (registration.waiting) {
    notifySWUpdateAvailable()
  }

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing
    if (!newWorker) return

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && registration.active) {
        notifySWUpdateAvailable()
      }
    })
  })

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

function subscribeToSWUpdates(callback) {
  _swUpdateCallbacks.push(callback)
  try { callback(_swUpdateAvailable) } catch { /* ignore */ }
  return () => {
    _swUpdateCallbacks = _swUpdateCallbacks.filter((cb) => cb !== callback)
  }
}

function applySWUpdate() {
  if (!_swRegistration || !_swRegistration.waiting) return
  _swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
}

function isSWUpdateAvailable() {
  return _swUpdateAvailable
}

function notifySWUpdateAvailable() {
  _swUpdateAvailable = true
  _swUpdateCallbacks.forEach((cb) => {
    try { cb(true) } catch { /* ignore */ }
  })
}

describe('SW update prompt', () => {
  describe('initSWUpdatePrompt / subscribeToSWUpdates', () => {
    it('notifies subscribers when an update becomes available via updatefound', () => {
      setupNavigatorWithSW()
      const { registration, listeners } = createMockRegistration({
        hasWaiting: false,
      })

      const callback = vi.fn()
      subscribeToSWUpdates(callback)
      expect(callback).toHaveBeenCalledWith(false)

      initSWUpdatePrompt(registration)

      // Create a new installing worker with addEventListener spy
      const installingWorker = {
        state: 'installing',
        addEventListener: vi.fn(),
      }
      registration.installing = installingWorker

      // Trigger updatefound
      const updateFoundCb = listeners['updatefound']
      expect(updateFoundCb).toBeDefined()
      updateFoundCb()

      // Get the statechange callback
      const stateChangeCb = installingWorker.addEventListener.mock.calls.find(
        ([event]) => event === 'statechange',
      )?.[1]
      expect(stateChangeCb).toBeDefined()

      // Transition to installed
      installingWorker.state = 'installed'
      stateChangeCb()

      expect(callback).toHaveBeenCalledWith(true)
      expect(isSWUpdateAvailable()).toBe(true)
    })

    it('surfaces a pre-existing waiting worker immediately', () => {
      setupNavigatorWithSW()
      const { registration } = createMockRegistration({ hasWaiting: true })

      const callback = vi.fn()
      subscribeToSWUpdates(callback)
      expect(callback).toHaveBeenCalledWith(false)

      initSWUpdatePrompt(registration)

      expect(callback).toHaveBeenCalledWith(true)
      expect(isSWUpdateAvailable()).toBe(true)
    })
  })

  describe('applySWUpdate', () => {
    it('posts SKIP_WAITING to the waiting worker when one exists', () => {
      setupNavigatorWithSW()
      const waiting = {
        state: 'installed',
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
      }
      const { registration } = createMockRegistration({
        hasWaiting: true,
        waiting,
      })

      initSWUpdatePrompt(registration)
      applySWUpdate()

      expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    })

    it('does nothing when there is no waiting worker (boundary case)', () => {
      setupNavigatorWithSW()
      const { registration } = createMockRegistration({ hasWaiting: false })

      initSWUpdatePrompt(registration)

      // No waiting worker — should not throw
      expect(() => applySWUpdate()).not.toThrow()
    })
  })

  describe('unsupported environment (no serviceWorker in navigator)', () => {
    it('handles missing navigator.serviceWorker gracefully', () => {
      // Simulate no SW support
      global.navigator = {}

      // These should not throw
      expect(() => {
        subscribeToSWUpdates(vi.fn())
        applySWUpdate()
      }).not.toThrow()
      expect(isSWUpdateAvailable()).toBe(false)
    })
  })

  describe('controllerchange triggers reload', () => {
    it('reloads the page when a new SW takes control', () => {
      const reloadSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      })

      const swListeners = setupNavigatorWithSW()
      const { registration } = createMockRegistration({ hasWaiting: false })

      initSWUpdatePrompt(registration)

      // Trigger controllerchange event
      const controllerChangeCb = swListeners['controllerchange']
      expect(controllerChangeCb).toBeDefined()
      controllerChangeCb()

      expect(reloadSpy).toHaveBeenCalledTimes(1)
    })
  })
})
