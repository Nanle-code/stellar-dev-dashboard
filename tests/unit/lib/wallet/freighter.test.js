/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  normalizeFreighterNetwork,
  onFreighterAccountChange,
  onFreighterLock,
  subscribeFreighterSession,
  __resetFreighterApiCacheForTests,
} from '../../../../src/lib/wallet/freighter.js'

describe('freighter connector', () => {
  beforeEach(() => {
    window.freighterApi = {
      isConnected: vi.fn(async () => ({ isConnected: true })),
      isAllowed: vi.fn(async () => ({ isAllowed: true })),
      getAddress: vi.fn(async () => ({ address: 'GOLD123' })),
      getNetwork: vi.fn(async () => ({ network: 'TESTNET' })),
    }
  })

  afterEach(() => {
    delete window.freighterApi
    __resetFreighterApiCacheForTests()
    vi.restoreAllMocks()
  })

  it('normalizes supported Freighter networks', () => {
    expect(normalizeFreighterNetwork('PUBLIC')).toBe('mainnet')
    expect(normalizeFreighterNetwork('TESTNET')).toBe('testnet')
    expect(normalizeFreighterNetwork('FUTURENET')).toBe('futurenet')
  })

  it('returns null for invalid network input', () => {
    expect(normalizeFreighterNetwork('')).toBeNull()
    expect(normalizeFreighterNetwork('UNKNOWN')).toBeNull()
    expect(normalizeFreighterNetwork(null)).toBeNull()
  })

  it('handles account change events', () => {
    const callback = vi.fn()
    const cleanup = onFreighterAccountChange(callback)

    window.dispatchEvent(new CustomEvent('freighterAccountChange', { detail: 'GNEW123' }))
    expect(callback).toHaveBeenCalledWith('GNEW123')

    cleanup()
    window.dispatchEvent(new CustomEvent('freighterAccountChange', { detail: 'GOTHER' }))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('handles lock events', () => {
    const callback = vi.fn()
    const cleanup = onFreighterLock(callback)

    window.dispatchEvent(new CustomEvent('freighterLock'))
    expect(callback).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('polls for account changes when Freighter updates outside DOM events', async () => {
    const onAccountChange = vi.fn()
    const cleanup = subscribeFreighterSession({
      onAccountChange,
      pollIntervalMs: 20,
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(onAccountChange).not.toHaveBeenCalled()

    window.freighterApi.getAddress = vi.fn(async () => ({ address: 'GNEW456' }))
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(onAccountChange).toHaveBeenCalledWith('GNEW456')
    cleanup()
  })

  it('reports disconnect when Freighter is no longer available', async () => {
    const onDisconnect = vi.fn()
    const cleanup = subscribeFreighterSession({
      onDisconnect,
      pollIntervalMs: 20,
    })

    await new Promise((resolve) => setTimeout(resolve, 25))

    delete window.freighterApi
    __resetFreighterApiCacheForTests()

    await vi.waitFor(
      () => {
        expect(onDisconnect).toHaveBeenCalled()
      },
      { timeout: 200 },
    )

    cleanup()
  })
})
