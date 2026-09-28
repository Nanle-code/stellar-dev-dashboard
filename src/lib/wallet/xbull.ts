/**
 * xBull Wallet connector for Stellar.
 *
 * xBull is a browser extension and mobile wallet. It exposes a global
 * `xBullWalletConnect` object (extension) and also supports a connector
 * library for mobile deep-link / WalletConnect bridging.
 *
 * Optional peer dependency:
 *   @creit.tech/xbull-wallet-connect
 *   npm install @creit.tech/xbull-wallet-connect
 *
 * Docs: https://docs.xbull.app
 */

/**
 * Check whether the xBull extension is injected in the current browser tab.
 */
export function isXBullInstalled() {
  return typeof window !== 'undefined' && typeof window.xBullWalletConnect !== 'undefined'
}

/**
 * Connect to xBull wallet (extension or mobile connector library).
 * Falls back to the npm connector when the extension is absent.
 * @returns {{ publicKey: string }}
 */
export async function connectXBull() {
  // Extension path
  if (isXBullInstalled()) {
    try {
      const result = await window.xBullWalletConnect.connect()
      if (!result?.publicKey) {
        throw new Error('xBull did not return a public key.')
      }
      return { publicKey: result.publicKey }
    } catch (error) {
      throw new Error(`xBull connection failed: ${error.message}`)
    }
  }

  // Connector library path (mobile / cross-origin)
  try {
    const mod = await new Function('s', 'return import(s)')('@creit.tech/xbull-wallet-connect')
    const { XBullWalletConnect } = mod
    const xbull = new XBullWalletConnect()
    const publicKey = await xbull.connect()
    if (!publicKey) throw new Error('xBull connector did not return a public key.')
    return { publicKey }
  } catch (error) {
    if (error.message?.includes('@creit.tech')) {
      throw new Error(
        'xBull wallet is not installed and the connector library is missing. ' +
        'Install xBull from https://xbull.app or run: npm install @creit.tech/xbull-wallet-connect'
      )
    }
    throw new Error(`xBull connection failed: ${error.message}`)
  }
}

/**
 * Sign a transaction XDR with xBull.
 * @param {string} xdr  — Base64-encoded unsigned transaction envelope
 * @param {string} network  — 'PUBLIC' | 'TESTNET'
 * @returns {Promise<string>}  signed XDR
 */
export async function signTransactionWithXBull(xdr, network = 'TESTNET') {
  if (isXBullInstalled()) {
    try {
      const result = await window.xBullWalletConnect.signXDR(xdr, { network })
      if (result?.error) throw new Error(result.error)
      return result?.signedXDR ?? result
    } catch (error) {
      throw new Error(`xBull signing failed: ${error.message}`)
    }
  }

  try {
    const mod = await new Function('s', 'return import(s)')('@creit.tech/xbull-wallet-connect')
    const { XBullWalletConnect } = mod
    const xbull = new XBullWalletConnect()
    const signed = await xbull.sign({ xdr, network })
    return signed
  } catch (error) {
    throw new Error(`xBull signing failed: ${error.message}`)
  }
}
