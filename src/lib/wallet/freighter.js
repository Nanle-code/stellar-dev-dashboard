/**
 * Freighter wallet connector for Stellar.
 * Freighter is a browser extension wallet for the Stellar network.
 */

const FREIGHTER_API_URL = 'https://cdn.jsdelivr.net/npm/@stellar/freighter-api/dist/index.min.js'

let freighterApi = null

export function __resetFreighterApiCacheForTests() {
  freighterApi = null
}

async function getFreighterApi() {
  if (freighterApi) return freighterApi
  if (typeof window !== 'undefined' && window.freighterApi) {
    freighterApi = window.freighterApi
    return freighterApi
  }
  return null
}

export async function isFreighterInstalled() {
  const api = await getFreighterApi()
  if (!api) return false
  try {
    const result = await api.isConnected()
    return result.isConnected === true
  } catch {
    return false
  }
}

export async function connectFreighter() {
  const api = await getFreighterApi()
  if (!api) {
    throw new Error('Freighter wallet extension is not installed. Please install it from https://freighter.app')
  }

  try {
    const accessResult = await api.requestAccess()
    if (accessResult.error) {
      throw new Error(accessResult.error)
    }

    const addressResult = await api.getAddress()
    if (addressResult.error) {
      throw new Error(addressResult.error)
    }

    const networkResult = await api.getNetwork()

    return {
      publicKey: addressResult.address,
      network: networkResult.network || 'TESTNET',
    }
  } catch (error) {
    throw new Error(`Freighter connection failed: ${error.message}`)
  }
}

export async function signTransactionWithFreighter(xdr, network = 'TESTNET') {
  const api = await getFreighterApi()
  if (!api) {
    throw new Error('Freighter wallet is not available')
  }

  try {
    const result = await api.signTransaction(xdr, {
      network,
    })

    if (result.error) {
      throw new Error(result.error)
    }

    return result.signedTxXdr || result
  } catch (error) {
    throw new Error(`Transaction signing failed: ${error.message}`)
  }
}

export async function getFreighterNetwork() {
  const api = await getFreighterApi()
  if (!api) return null
  try {
    const result = await api.getNetwork()
    return result.network || null
  } catch {
    return null
  }
}

export async function getFreighterAddress() {
  const api = await getFreighterApi()
  if (!api) return null
  try {
    const result = await api.getAddress()
    if (result.error) return null
    return result.address || null
  } catch {
    return null
  }
}

export async function isFreighterAllowed() {
  const api = await getFreighterApi()
  if (!api || typeof api.isAllowed !== 'function') return null
  try {
    const result = await api.isAllowed()
    return result.isAllowed === true
  } catch {
    return false
  }
}

/**
 * Map Freighter network identifiers to dashboard network names.
 */
export function normalizeFreighterNetwork(network) {
  if (typeof network !== 'string') return null
  const value = network.trim().toUpperCase()
  switch (value) {
    case 'PUBLIC':
    case 'MAINNET':
      return 'mainnet'
    case 'TESTNET':
      return 'testnet'
    case 'FUTURENET':
      return 'futurenet'
    case 'LOCAL':
      return 'local'
    default:
      return null
  }
}

/**
 * Listen for account changes from Freighter.
 * Not all versions of Freighter natively broadcast this, but we handle it if fired.
 */
export function onFreighterAccountChange(callback) {
  if (typeof window !== 'undefined') {
    const handler = (e) => callback(e.detail);
    window.addEventListener('freighterAccountChange', handler);
    return () => window.removeEventListener('freighterAccountChange', handler);
  }
  return () => {};
}

/**
 * Listen for network changes from Freighter.
 */
export function onFreighterNetworkChange(callback) {
  if (typeof window !== 'undefined') {
    const handler = (e) => callback(e.detail);
    window.addEventListener('freighterNetworkChange', handler);
    return () => window.removeEventListener('freighterNetworkChange', handler);
  }
  return () => {};
}

/**
 * Listen for Freighter lock events.
 */
export function onFreighterLock(callback) {
  if (typeof window !== 'undefined') {
    const handler = () => callback();
    window.addEventListener('freighterLock', handler);
    return () => window.removeEventListener('freighterLock', handler);
  }
  return () => {};
}

const DEFAULT_POLL_INTERVAL_MS = 5000

/**
 * Poll Freighter for lock, disconnect, account, and network changes.
 * Supplements custom DOM events for environments where Freighter does not emit them.
 * @param {object} [options]
 * @param {() => void} [options.onLock]
 * @param {() => void} [options.onDisconnect]
 * @param {(publicKey: string) => void} [options.onAccountChange]
 * @param {(network: string) => void} [options.onNetworkChange]
 * @param {number} [options.pollIntervalMs]
 */
export function subscribeFreighterSession({
  onLock,
  onDisconnect,
  onAccountChange,
  onNetworkChange,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
} = {}) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let stopped = false
  let lastAddress = null
  let lastNetwork = null

  const poll = async () => {
    if (stopped) return

    const api = await getFreighterApi()
    if (!api) {
      onDisconnect?.()
      return
    }

    try {
      const allowed = await isFreighterAllowed()
      if (allowed === false) {
        onLock?.()
        return
      }

      const connected = await api.isConnected()
      if (!connected?.isConnected) {
        onDisconnect?.()
        return
      }

      const address = await getFreighterAddress()
      if (!address) {
        onLock?.()
        return
      }

      if (lastAddress !== null && address !== lastAddress) {
        onAccountChange?.(address)
      }
      lastAddress = address

      const network = await getFreighterNetwork()
      if (network && lastNetwork !== null && network !== lastNetwork) {
        onNetworkChange?.(network)
      }
      if (network) {
        lastNetwork = network
      }
    } catch {
      onDisconnect?.()
    }
  }

  void poll()
  const intervalId = window.setInterval(() => {
    void poll()
  }, pollIntervalMs)

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      void poll()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    stopped = true
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
