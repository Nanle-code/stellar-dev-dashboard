/**
 * Solar Wallet connector for Stellar.
 *
 * Solar is a mobile-first and desktop wallet that supports:
 *   - Browser extension (desktop)
 *   - SEP-0007 deep-link signing (mobile)
 *   - WalletConnect v2 for cross-platform sessions
 *
 * Extension detection key: window.solarWallet
 * SEP-0007 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

const SOLAR_EXTENSION_KEY = 'solarWallet'
const SEP7_PENDING_KEY = 'solar-sep7-pending-xdr'

export function isSolarInstalled() {
  return typeof window !== 'undefined' && typeof window[SOLAR_EXTENSION_KEY] !== 'undefined'
}

/**
 * Connect to Solar Wallet.
 * Uses the extension on desktop; throws a user-friendly error on mobile so
 * the caller can fall back to watch-only + SEP-0007 signing.
 * @returns {{ publicKey: string, mode: 'extension' | 'sep7' }}
 */
export async function connectSolar() {
  if (isSolarInstalled()) {
    try {
      const result = await window[SOLAR_EXTENSION_KEY].connect()
      if (!result?.publicKey) throw new Error('Solar did not return a public key.')
      return { publicKey: result.publicKey, mode: 'extension' }
    } catch (error) {
      throw new Error(`Solar extension connection failed: ${error.message}`)
    }
  }

  throw new Error(
    'Solar extension not found. On mobile, enter your public key and connect in ' +
    'watch-only mode — signing will open the Solar app automatically.'
  )
}

/**
 * Sign a transaction XDR with Solar.
 * Uses extension signing on desktop; SEP-0007 deep link on mobile.
 * @param {string} xdr
 * @param {'PUBLIC'|'TESTNET'} network
 * @returns {Promise<string>} signed XDR or 'SEP7_PENDING' on mobile
 */
export async function signTransactionWithSolar(xdr, network = 'TESTNET') {
  if (isSolarInstalled()) {
    try {
      const result = await window[SOLAR_EXTENSION_KEY].signXDR(xdr, { network })
      if (result?.error) throw new Error(result.error)
      return result?.signedXDR ?? result
    } catch (error) {
      throw new Error(`Solar signing failed: ${error.message}`)
    }
  }
  return signWithSolarSEP7(xdr, network)
}

/**
 * Fire-and-forget SEP-0007 deep link for mobile Solar signing.
 */
export function signWithSolarSEP7(xdr, network = 'TESTNET') {
  if (typeof window === 'undefined') {
    throw new Error('SEP-0007 signing requires a browser environment.')
  }

  try {
    sessionStorage.setItem(SEP7_PENDING_KEY, xdr)
  } catch {
    // ignore
  }

  const networkPassphrase =
    network === 'PUBLIC'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015'

  const sep7Uri =
    `web+stellar:tx?xdr=${encodeURIComponent(xdr)}` +
    `&network_passphrase=${encodeURIComponent(networkPassphrase)}` +
    `&callback=url:${encodeURIComponent(window.location.href)}`

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  if (isMobile) {
    window.location.href = sep7Uri
  } else {
    const labNetwork = network === 'PUBLIC' ? 'public' : 'testnet'
    window.open(
      `https://laboratory.stellar.org/#txsigner?xdr=${encodeURIComponent(xdr)}&network=${labNetwork}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return Promise.resolve('SEP7_PENDING')
}

export function readPendingSolarXdr() {
  try {
    return sessionStorage.getItem(SEP7_PENDING_KEY) || null
  } catch {
    return null
  }
}

export function clearPendingSolarXdr() {
  try {
    sessionStorage.removeItem(SEP7_PENDING_KEY)
  } catch {
    // ignore
  }
}
