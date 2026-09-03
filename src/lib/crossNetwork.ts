import { NETWORKS, probeAllNetworks, fetchAccount } from './stellar'

/**
 * Cross-network utilities that reuse existing Stellar ecosystem APIs.
 * Realistic scope: multi-network probing, comparison, address lookup.
 * Does NOT invent APIs or assume cross-network transaction capability.
 */

const NETWORK_LABELS = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  futurenet: 'Futurenet',
  local: 'Local',
  custom: 'Custom',
}

const NETWORK_ORDER = ['mainnet', 'testnet', 'futurenet', 'local', 'custom']

/**
 * Probe all configured networks and return status for each.
 * Reuses existing probeAllNetworks() from stellar.ts.
 * @returns {Promise<Array<{network: string, name: string, status: string, horizonMs?: number}>>}
 */
export async function probeNetworkStatuses() {
  const results = await probeAllNetworks()
  return NETWORK_ORDER.map((key) => {
    const cfg = NETWORKS[key]
    const found = results.find((r) => r.network === key)
    return {
      network: key,
      name: NETWORK_LABELS[key] || cfg?.name || key,
      horizonUrl: cfg?.horizonUrl || '',
      status: found && found.horizon && found.horizon.status === 'up' ? 'up' : 'down',
      horizonMs: found?.horizon?.latencyMs,
      sorobanMs: found?.soroban?.latencyMs,
    }
  })
}

/**
 * Fetch a single address's basic account data across multiple networks.
 * Returns per-network results; networks that error are marked with error field.
 * @param {string} address - Stellar public key
 * @param {string[]} networks - Networks to query (defaults to mainnet + testnet)
 * @returns {Promise<Object<string, {success: boolean, balance?: string, error?: string}>>}
 */
export async function resolveAddressAcrossNetworks(address, networks = ['mainnet', 'testnet']) {
  const results = {}
  const promises = networks.map(async (network) => {
    try {
      const account = await fetchAccount(address, network)
      const nativeBalance = account.balances?.find((b) => b.asset_type === 'native')
      results[network] = {
        success: true,
        balance: nativeBalance ? nativeBalance.balance : '0',
        subentryCount: account.subentry_count,
        sequence: account.sequence,
        signers: account.signers?.length || 0,
      }
    } catch (err) {
      results[network] = { success: false, error: err.message || 'Account not found on ' + network }
    }
  })
  await Promise.allSettled(promises)
  return results
}

/**
 * Compare a single key metric across networks for the same address.
 * @param {string} address
 * @param {string[]} networks
 * @returns {Promise<Array<{network: string, metrics: Object}>>}
 */
export async function compareAccountsAcrossNetworks(address, networks = ['mainnet', 'testnet', 'futurenet']) {
  const perNetwork = await resolveAddressAcrossNetworks(address, networks)
  return networks.map((network) => ({
    network,
    label: NETWORK_LABELS[network] || network,
    ...perNetwork[network],
  }))
}

export { NETWORKS, NETWORK_LABELS, NETWORK_ORDER }
