/**
 * WalletConnect v2 connector for Stellar.
 *
 * Works with any WalletConnect-compatible wallet including mobile wallets
 * (e.g. Lobstr, xBull Mobile, Solar Wallet).
 *
 * Optional peer dependency (not bundled):
 *   @walletconnect/sign-client  — install when WC support is needed:
 *   npm install @walletconnect/sign-client @walletconnect/modal
 *
 * The PROJECT_ID below is a public demo key from WalletConnect Cloud.
 * Replace it with your own at https://cloud.walletconnect.com
 */

const WC_PROJECT_ID = 'YOUR_WALLETCONNECT_PROJECT_ID'
const STELLAR_NAMESPACE = 'stellar'
const STELLAR_CHAIN_MAINNET = 'stellar:pubnet'
const STELLAR_CHAIN_TESTNET = 'stellar:testnet'

let _wcClient = null
let _wcSession = null
let _wcModal = null

/**
 * Dynamically import WalletConnect packages.
 */
async function dynamicImport(specifier) {
  try {
    return await new Function('s', 'return import(s)')(specifier)
  } catch {
    throw new Error(
      `Optional dependency "${specifier}" is not installed. ` +
      `Run: npm install @walletconnect/sign-client @walletconnect/modal`
    )
  }
}

export function getActiveWCSession() {
  return _wcSession
}

export function clearWCSession() {
  _wcSession = null
  _wcClient = null
}

/**
 * Initialize WalletConnect client and display the QR/deep-link modal.
 * @param {'mainnet'|'testnet'} network
 * @returns {{ publicKey: string, session: object }}
 */
export async function connectWalletConnect(network = 'testnet') {
  const chain = network === 'mainnet' ? STELLAR_CHAIN_MAINNET : STELLAR_CHAIN_TESTNET

  const { SignClient } = await dynamicImport('@walletconnect/sign-client')
  const { WalletConnectModal } = await dynamicImport('@walletconnect/modal')

  _wcClient = await SignClient.init({
    projectId: WC_PROJECT_ID,
    metadata: {
      name: 'Stellar Dev Dashboard',
      description: 'Stellar network development dashboard',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
      icons: ['https://stellar.org/favicon.ico'],
    },
  })

  _wcModal = new WalletConnectModal({
    projectId: WC_PROJECT_ID,
    chains: [chain],
  })

  return new Promise((resolve, reject) => {
    let settled = false

    const done = (err, value) => {
      if (settled) return
      settled = true
      _wcModal?.closeModal()
      if (err) reject(err)
      else resolve(value)
    }

    _wcClient.on('session_update', ({ topic, params }) => {
      const { namespaces } = params
      const currentSession = _wcClient.session.get(topic)
      _wcSession = { ...currentSession, namespaces }
    })

    _wcClient.on('session_delete', () => {
      clearWCSession()
    })

    _wcClient
      .connect({
        requiredNamespaces: {
          [STELLAR_NAMESPACE]: {
            methods: ['stellar_signXDR', 'stellar_getPublicKey'],
            chains: [chain],
            events: [],
          },
        },
      })
      .then(({ uri, approval }) => {
        if (uri) {
          _wcModal.openModal({ uri })
        }
        return approval()
      })
      .then((session) => {
        _wcSession = session
        // Extract public key from the session accounts
        // Format: stellar:pubnet:GABCDEF...
        const accounts = session.namespaces?.[STELLAR_NAMESPACE]?.accounts ?? []
        if (!accounts.length) {
          return done(new Error('No accounts returned from WalletConnect session.'))
        }
        const publicKey = accounts[0].split(':')[2]
        if (!publicKey) {
          return done(new Error('Could not parse public key from WalletConnect session.'))
        }
        done(null, { publicKey, session })
      })
      .catch((err) => {
        done(new Error(`WalletConnect connection failed: ${err.message}`))
      })
  })
}

/**
 * Sign a transaction XDR via a WalletConnect session.
 * @param {string} xdr  — Base64-encoded unsigned transaction envelope
 * @param {'mainnet'|'testnet'} network
 * @returns {Promise<string>}  signed XDR
 */
export async function signXdrWithWalletConnect(xdr, network = 'testnet') {
  if (!_wcClient || !_wcSession) {
    throw new Error('WalletConnect session not active. Please reconnect.')
  }

  const chain = network === 'mainnet' ? STELLAR_CHAIN_MAINNET : STELLAR_CHAIN_TESTNET

  try {
    const result = await _wcClient.request({
      topic: _wcSession.topic,
      chainId: chain,
      request: {
        method: 'stellar_signXDR',
        params: { xdr },
      },
    })

    // Different wallets return the signed XDR in different shapes
    if (typeof result === 'string') return result
    if (result?.signedXDR) return result.signedXDR
    if (result?.signedTxXdr) return result.signedTxXdr
    throw new Error('Unexpected response shape from WalletConnect wallet.')
  } catch (error) {
    if (error?.code === 5000 || error?.message?.toLowerCase().includes('rejected')) {
      throw new Error('Transaction rejected by the mobile wallet.')
    }
    throw new Error(`WalletConnect signing failed: ${error.message}`)
  }
}

/**
 * Disconnect the active WalletConnect session.
 */
export async function disconnectWalletConnect() {
  if (_wcClient && _wcSession) {
    try {
      await _wcClient.disconnect({
        topic: _wcSession.topic,
        reason: { code: 6000, message: 'User disconnected' },
      })
    } catch {
      // Already disconnected
    }
  }
  clearWCSession()
}
