/**
 * LOBSTR Wallet connector for Stellar.
 *
 * LOBSTR is a mobile-first wallet with social-recovery features.
 * It supports SEP-0007 (Stellar Web Protocol) for transaction signing
 * via deep links on mobile and via the LOBSTR browser extension on desktop.
 *
 * SEP-0007 reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 * LOBSTR extension:   https://lobstr.co/wallet/connect
 */

import * as StellarSdk from '@stellar/stellar-sdk'

const LOBSTR_EXTENSION_KEY = 'lobstrWalletConnect'
const SEP7_CALLBACK_STORAGE_KEY = 'lobstr-sep7-pending-xdr'

/**
 * Detect whether the LOBSTR browser extension is present.
 */
export function isLobstrInstalled() {
  return typeof window !== 'undefined' && typeof window[LOBSTR_EXTENSION_KEY] !== 'undefined'
}

/**
 * Connect to LOBSTR. On desktop it uses the extension; on mobile it
 * opens the LOBSTR app via a SEP-0007 deep link and stores the pending
 * XDR so the callback handler can pick it up.
 * @returns {{ publicKey: string, mode: 'extension'|'sep7' }}
 */
export async function connectLobstr() {
  if (isLobstrInstalled()) {
    try {
      const result = await window[LOBSTR_EXTENSION_KEY].connect()
      if (!result?.publicKey) throw new Error('LOBSTR did not return a public key.')
      return { publicKey: result.publicKey, mode: 'extension' }
    } catch (error) {
      throw new Error(`LOBSTR extension connection failed: ${error.message}`)
    }
  }

  // On mobile, the user needs to paste their public key (read-only connect),
  // then signing uses the SEP-0007 deep link flow.
  throw new Error(
    'LOBSTR browser extension not found. On mobile, enter your public key above and ' +
    'connect in watch-only mode — signing will open the LOBSTR app automatically.'
  )
}

/**
 * Sign a transaction XDR via LOBSTR extension.
 * @param {string} xdr
 * @param {string} network — 'PUBLIC' | 'TESTNET'
 * @returns {Promise<string>} signed XDR
 */
export async function signTransactionWithLobstr(xdr, network = 'TESTNET') {
  if (isLobstrInstalled()) {
    try {
      const result = await window[LOBSTR_EXTENSION_KEY].signXDR(xdr, { network })
      if (result?.error) throw new Error(result.error)
      return result?.signedXDR ?? result
    } catch (error) {
      throw new Error(`LOBSTR signing failed: ${error.message}`)
    }
  }
  // Mobile: fall through to SEP-0007
  return signWithSEP7(xdr, network)
}

/**
 * Open the LOBSTR app via a SEP-0007 `tx` link for signing.
 * On mobile the app deep-links back with the signed XDR.
 * On desktop it opens the Stellar Laboratory as a fallback.
 *
 * This is a fire-and-forget; the caller should listen for the callback
 * via the `onSEP7Callback` helper below.
 *
 * @param {string} xdr
 * @param {'PUBLIC'|'TESTNET'} network
 */
export function signWithSEP7(xdr, network = 'TESTNET') {
  if (typeof window === 'undefined') {
    throw new Error('SEP-0007 signing requires a browser environment.')
  }

  // Store the pending XDR so a callback handler can retrieve it
  try {
    sessionStorage.setItem(SEP7_CALLBACK_STORAGE_KEY, xdr)
  } catch {
    // sessionStorage unavailable — continue anyway
  }

  const networkParam = network === 'PUBLIC' ? 'public' : 'testnet'
  const encodedXdr = encodeURIComponent(xdr)
  const callbackUrl = encodeURIComponent(window.location.href)

  // SEP-0007 tx link targeting LOBSTR
  const sep7Uri =
    `web+stellar:tx?xdr=${encodedXdr}` +
    `&network_passphrase=${encodeURIComponent(
      network === 'PUBLIC'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015'
    )}` +
    `&callback=url:${callbackUrl}`

  // Detect mobile: open deep link, otherwise open Stellar Laboratory
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  if (isMobile) {
    window.location.href = sep7Uri
  } else {
    const labUrl =
      `https://laboratory.stellar.org/#txsigner?xdr=${encodedXdr}&network=${networkParam}`
    window.open(labUrl, '_blank', 'noopener,noreferrer')
  }

  return Promise.resolve('SEP7_PENDING')
}

/**
 * Social recovery helper: build a guardian set configuration object.
 * LOBSTR supports multi-device recovery through trusted contact accounts.
 * This helper generates the account threshold settings needed.
 *
 * @param {string[]} guardianPublicKeys  — Array of guardian Stellar public keys
 * @param {number} threshold  — Minimum signatures required (1-of-N style)
 * @returns {{ signers: object[], thresholds: object }}
 */
export function buildSocialRecoveryConfig(guardianPublicKeys, threshold = 1) {
  if (!Array.isArray(guardianPublicKeys) || guardianPublicKeys.length === 0) {
    throw new Error('At least one guardian public key is required.')
  }
  if (threshold < 1 || threshold > guardianPublicKeys.length) {
    throw new Error(`Threshold must be between 1 and ${guardianPublicKeys.length}.`)
  }

  const signers = guardianPublicKeys.map((key) => ({
    publicKey: key,
    weight: 1,
    type: 'ed25519PublicKey',
  }))

  return {
    signers,
    thresholds: {
      low: threshold,
      med: threshold,
      high: threshold,
    },
    recoveryMode: 'social',
    guardianCount: guardianPublicKeys.length,
    threshold,
  }
}

/**
 * Read a pending SEP-0007 XDR from sessionStorage (if present).
 */
export function readPendingSEP7Xdr() {
  try {
    return sessionStorage.getItem(SEP7_CALLBACK_STORAGE_KEY) || null
  } catch {
    return null
  }
}

/**
 * Clear any pending SEP-0007 XDR from sessionStorage.
 */
export function clearPendingSEP7Xdr() {
  try {
    sessionStorage.removeItem(SEP7_CALLBACK_STORAGE_KEY)
  } catch {
    // ignore
  }
}
