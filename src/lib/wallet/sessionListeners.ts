/**
 * Global wallet session listeners for Freighter.
 * Mounted at the app layout level so events are handled even when the wallet tab is unmounted.
 */

import { useStore } from '../store'
import type { NetworkName } from '../stellar'
import { fetchAccount } from '../stellar'
import {
  onFreighterAccountChange,
  onFreighterLock,
  onFreighterNetworkChange,
  subscribeFreighterSession,
  normalizeFreighterNetwork,
} from './freighter'

let accountFetchGeneration = 0

function revokeSession(reason: string): void {
  accountFetchGeneration += 1
  useStore.getState().revokeWalletSession(reason)
}

async function reloadAccountForKey(publicKey: string): Promise<void> {
  const generation = ++accountFetchGeneration
  const state = useStore.getState()

  if (!state.walletConnected || state.walletType !== 'freighter') {
    return
  }

  state.setWalletConnected(true, 'freighter', publicKey)
  state.setConnectedAddress(publicKey)
  state.setAccountLoading(true)
  state.setAccountError(null)

  try {
    const account = await fetchAccount(publicKey, useStore.getState().network)
    if (generation !== accountFetchGeneration) return
    useStore.getState().setAccountData(account)
  } catch (error) {
    if (generation !== accountFetchGeneration) return
    const message = error instanceof Error ? error.message : String(error)
    useStore.getState().setAccountError(message)
  } finally {
    if (generation === accountFetchGeneration) {
      useStore.getState().setAccountLoading(false)
    }
  }
}

function handleAccountChange(publicKey: unknown): void {
  if (typeof publicKey !== 'string' || !publicKey.trim()) {
    revokeSession('invalid_account_change')
    return
  }

  const { walletConnected, walletType, walletPublicKey } = useStore.getState()
  if (!walletConnected || walletType !== 'freighter') {
    return
  }

  if (publicKey === walletPublicKey) {
    return
  }

  void reloadAccountForKey(publicKey)
}

function handleNetworkChange(network: unknown): void {
  if (typeof network !== 'string' || !network.trim()) {
    revokeSession('invalid_network_change')
    return
  }

  const { walletConnected, walletType, network: dashboardNetwork } = useStore.getState()
  if (!walletConnected || walletType !== 'freighter') {
    return
  }

  const normalized = normalizeFreighterNetwork(network)
  if (!normalized) {
    revokeSession('unsupported_network')
    return
  }

  if (normalized !== dashboardNetwork) {
    useStore.getState().setNetwork(normalized as NetworkName)
    const { walletPublicKey } = useStore.getState()
    if (walletPublicKey) {
      void reloadAccountForKey(walletPublicKey)
    }
  }
}

/**
 * Start Freighter session listeners. Returns a cleanup function.
 */
export function startWalletSessionListeners(): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const cleanups: Array<() => void> = []

  cleanups.push(onFreighterLock(() => revokeSession('wallet_locked')))
  cleanups.push(onFreighterAccountChange(handleAccountChange))
  cleanups.push(onFreighterNetworkChange(handleNetworkChange))

  cleanups.push(
    subscribeFreighterSession({
      onLock: () => revokeSession('wallet_locked'),
      onDisconnect: () => revokeSession('wallet_disconnected'),
      onAccountChange: handleAccountChange,
      onNetworkChange: handleNetworkChange,
    }),
  )

  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}
