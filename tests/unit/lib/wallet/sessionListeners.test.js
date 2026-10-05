/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../../../src/lib/storage', () => ({
  getStoredValue: vi.fn().mockResolvedValue(null),
  setStoredValue: vi.fn(),
}))

vi.mock('../../../../src/utils/stateSync', () => ({
  broadcastStateChange: vi.fn(),
  onStateChange: vi.fn(),
  syncState: vi.fn().mockResolvedValue(undefined),
  loadSyncedState: vi.fn().mockResolvedValue(null),
  resolveStateConflict: vi.fn((local) => local),
  getTabId: vi.fn().mockReturnValue('test-tab'),
}))

vi.mock('../../../../src/lib/stellar', () => ({
  fetchAccount: vi.fn(async () => ({ id: 'GNEW123', balances: [] })),
}))

vi.mock('../../../../src/lib/wallet/freighter', () => ({
  onFreighterAccountChange: vi.fn((callback) => {
    window.__accountChangeCallback = callback
    return () => {}
  }),
  onFreighterLock: vi.fn((callback) => {
    window.__lockCallback = callback
    return () => {}
  }),
  onFreighterNetworkChange: vi.fn((callback) => {
    window.__networkChangeCallback = callback
    return () => {}
  }),
  subscribeFreighterSession: vi.fn(() => () => {}),
  normalizeFreighterNetwork: vi.fn((network) => {
    if (network === 'TESTNET') return 'testnet'
    if (network === 'PUBLIC') return 'mainnet'
    return null
  }),
}))

import { useStore } from '../../../../src/lib/store'
import { startWalletSessionListeners } from '../../../../src/lib/wallet/sessionListeners'
import { fetchAccount } from '../../../../src/lib/stellar'

describe('wallet session listeners', () => {
  beforeEach(() => {
    useStore.setState({
      walletConnected: true,
      walletType: 'freighter',
      walletPublicKey: 'GOLD123',
      connectedAddress: 'GOLD123',
      accountData: { id: 'GOLD123' },
      accountLoading: false,
      accountError: null,
      network: 'testnet',
      walletSessionRevokedReason: null,
    }, false)
  })

  it('revokes the wallet session when Freighter locks', () => {
    startWalletSessionListeners()
    window.__lockCallback()

    const state = useStore.getState()
    expect(state.walletConnected).toBe(false)
    expect(state.connectedAddress).toBeNull()
    expect(state.accountData).toBeNull()
    expect(state.walletSessionRevokedReason).toBe('wallet_locked')
  })

  it('reloads account data when the active account changes', async () => {
    startWalletSessionListeners()
    window.__accountChangeCallback('GNEW123')

    await Promise.resolve()
    await Promise.resolve()

    const state = useStore.getState()
    expect(fetchAccount).toHaveBeenCalledWith('GNEW123', 'testnet')
    expect(state.walletPublicKey).toBe('GNEW123')
    expect(state.connectedAddress).toBe('GNEW123')
    expect(state.accountData).toEqual({ id: 'GNEW123', balances: [] })
  })

  it('revokes session for unsupported network changes', () => {
    startWalletSessionListeners()
    window.__networkChangeCallback('CUSTOM-UNKNOWN')

    const state = useStore.getState()
    expect(state.walletConnected).toBe(false)
    expect(state.walletSessionRevokedReason).toBe('unsupported_network')
  })

  it('does not clear a read-only account when no Freighter session is active', () => {
    useStore.setState({ walletConnected: false, walletType: null, walletPublicKey: null, connectedAddress: 'GREADONLY' }, false)
    startWalletSessionListeners()
    window.__lockCallback()

    const state = useStore.getState()
    expect(state.connectedAddress).toBe('GREADONLY')
    expect(state.walletSessionRevokedReason).toBeNull()
  })

  it('does not revoke a session owned by another wallet', () => {
    useStore.setState({ walletType: 'ledger' }, false)
    startWalletSessionListeners()
    window.__lockCallback()

    expect(useStore.getState().walletConnected).toBe(true)
  })
})
