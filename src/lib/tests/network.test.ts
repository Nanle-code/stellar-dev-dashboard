import { describe, it, expect, beforeEach, vi } from 'vitest'

function setupMocks() {
  vi.doMock('../storage', () => ({
    getStoredValue: vi.fn().mockResolvedValue(null),
    setStoredValue: vi.fn(),
  }))
  vi.doMock('../../utils/stateSync', () => ({
    broadcastStateChange: vi.fn(),
    onStateChange: vi.fn(),
    syncState: vi.fn().mockResolvedValue(0),
    loadSyncedState: vi.fn().mockReturnValue(null),
    resolveStateConflict: vi.fn((local: unknown) => local),
    getTabId: vi.fn().mockReturnValue('test-tab'),
  }))
  vi.doMock('../cacheInit', () => ({
    handleNetworkSwitch: vi.fn(),
    initCache: vi.fn().mockResolvedValue(undefined),
    handleTransactionSuccess: vi.fn().mockResolvedValue(undefined),
    _resetCacheInit: vi.fn(),
  }))
  vi.doMock('../requestCancellation', () => ({
    accountRequests: { abortAll: vi.fn(), begin: vi.fn(() => ({ active: true, commit: vi.fn(() => true), abort: vi.fn() })) },
    AccountLanes: { Connect: 'account:connect', Offers: 'account:offers', CreationDate: 'account:creation-date' },
    isCancellation: vi.fn(() => false),
    isStaleRequestError: vi.fn(() => false),
    StaleRequestError: class StaleRequestError extends Error {},
  }))
}

beforeEach(() => {
  // Ensure a clean module cache so the store initializer reads localStorage afresh
  vi.resetModules()
  setupMocks()
  window.sessionStorage.clear()
  window.localStorage.clear()
})

describe('Network persistence', () => {
  it('persists selected network to localStorage when changed', async () => {
    const { useStore } = await import('../store')
    const api = useStore.getState()
    api.setNetwork('mainnet')
    expect(window.localStorage.getItem('stellar:selected-network')).toBe('mainnet')
    expect(useStore.getState().network).toBe('mainnet')
  })

  it('initialises store.network from localStorage on import', async () => {
    window.localStorage.setItem('stellar:selected-network', 'local')
    // re-import the module after setting localStorage
    vi.resetModules()
    setupMocks()
    const { useStore } = await import('../store')
    expect(useStore.getState().network).toBe('local')
  })
})
