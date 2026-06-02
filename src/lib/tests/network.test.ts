import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Ensure a clean module cache so the store initializer reads localStorage afresh
  vi.resetModules()
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
    const { useStore } = await import('../store')
    expect(useStore.getState().network).toBe('local')
  })
})
