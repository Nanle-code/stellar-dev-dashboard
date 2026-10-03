import * as StellarSdk from '@stellar/stellar-sdk'
import { NETWORKS, type NetworkName } from '../stellar'
import {
  connectFreighter,
  getFreighterAddress,
  getFreighterNetwork,
  isFreighterInstalled,
  normalizeFreighterNetwork,
  signTransactionWithFreighter,
} from './freighter'
import { connectXBull, isXBullInstalled, signTransactionWithXBull } from './xbull'
import { connectLobstr, isLobstrInstalled, signTransactionWithLobstr } from './lobstr'
import { connectSolar, isSolarInstalled, signTransactionWithSolar } from './solar'
import {
  connectWalletConnect,
  disconnectWalletConnect,
  getActiveWCSession,
  signXdrWithWalletConnect,
} from './walletconnect'
import { connectHardwareWallet } from './devices'
import { disconnectLedger, signXdrWithLedger } from './ledger'

export type WalletId = 'freighter' | 'xbull' | 'albedo' | 'lobstr' | 'hana' | 'ledger' | 'walletconnect' | 'solar'

export interface WalletCapabilities {
  transactionSigning: boolean
  authEntrySigning: boolean
  networkIndependent: boolean
}

export interface WalletConnection {
  publicKey: string
  network: NetworkName | null
  mode?: string
}

export interface WalletAdapter {
  id: WalletId
  capabilities: WalletCapabilities
  isAvailable(): boolean | Promise<boolean>
  connect(network: NetworkName, options?: { derivationPath?: string }): Promise<WalletConnection>
  getAddress(): Promise<string | null>
  getNetwork(): Promise<NetworkName | null>
  signTransaction(xdr: string, network: NetworkName): Promise<string>
  signAuthEntry(authEntryXdr: string, network: NetworkName): Promise<string>
  disconnect(): Promise<void>
}

type InjectedWallet = {
  connect?: () => Promise<any>
  getAddress?: () => Promise<any>
  getPublicKey?: () => Promise<any>
  getNetwork?: () => Promise<any>
  signTransaction?: (...args: any[]) => Promise<any>
  signXDR?: (...args: any[]) => Promise<any>
  signAuthEntry?: (...args: any[]) => Promise<any>
}

type WalletWindow = Window & {
  albedo?: InjectedWallet & { publicKey?: (options?: any) => Promise<any>; tx?: (options: any) => Promise<any> }
  hana?: InjectedWallet
  xBullWalletConnect?: InjectedWallet
  lobstrWalletConnect?: InjectedWallet
  solarWallet?: InjectedWallet
}

function getInjectedWallet(key: keyof WalletWindow): InjectedWallet | undefined {
  return typeof window === 'undefined' ? undefined : (window as WalletWindow)[key] as InjectedWallet | undefined
}

function normalizeNetwork(value: unknown): NetworkName | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('pubnet') || normalized.includes('public') || normalized === 'mainnet') return 'mainnet'
  if (normalized.includes('testnet') || normalized.includes('test sdf') || normalized === 'test') return 'testnet'
  if (normalized.includes('futurenet')) return 'futurenet'
  if (normalized === 'local' || normalized.includes('standalone')) return 'local'
  if (normalized === 'custom') return 'custom'
  return null
}

function networkFromResult(result: any): NetworkName | null {
  if (!result) return null
  if (typeof result === 'string') return normalizeNetwork(result)
  return normalizeNetwork(result.network ?? result.networkName ?? result.chainId ?? result.networkPassphrase)
}

function requireSigningNetwork(adapter: WalletAdapter, actual: NetworkName | null, expected: NetworkName) {
  if (adapter.capabilities.networkIndependent) return
  if (!actual) {
    throw new Error(`${adapter.id} did not report its network. Reconnect after confirming the wallet network.`)
  }
  if (actual !== expected) {
    throw new Error(`Network mismatch: ${adapter.id} is connected to ${actual}, but the dashboard is on ${expected}.`)
  }
}

function validateTransactionNetwork(xdr: string, network: NetworkName) {
  const passphrase = NETWORKS[network].passphrase
  if (!passphrase) throw new Error(`Cannot verify transactions for the ${network} network without a network passphrase.`)
  try {
    StellarSdk.TransactionBuilder.fromXDR(xdr, passphrase)
  } catch {
    throw new Error(`Transaction XDR does not match the dashboard's ${network} network.`)
  }
}

function signedValue(result: any): string {
  if (typeof result === 'string') return result
  const signed = result?.signedTxXdr ?? result?.signedXDR ?? result?.signed_envelope_xdr ?? result?.signedXdr
    ?? result?.signedAuthEntryXdr ?? result?.signedAuthEntry
  if (typeof signed !== 'string') throw new Error('Wallet returned an unexpected signed transaction response.')
  return signed
}

function createAdapter(
  id: WalletId,
  capabilities: WalletCapabilities,
  options: {
    isAvailable: WalletAdapter['isAvailable']
    connect: WalletAdapter['connect']
    getAddress: WalletAdapter['getAddress']
    getNetwork: WalletAdapter['getNetwork']
    signTransaction: (xdr: string, network: NetworkName) => Promise<string>
    signAuthEntry?: WalletAdapter['signAuthEntry']
    disconnect?: WalletAdapter['disconnect']
  }
): WalletAdapter {
  return {
    id,
    capabilities,
    isAvailable: options.isAvailable,
    connect: options.connect,
    getAddress: options.getAddress,
    getNetwork: options.getNetwork,
    async signTransaction(xdr, network) {
      if (!capabilities.transactionSigning) throw new Error(`${id} does not support transaction signing.`)
      validateTransactionNetwork(xdr, network)
      requireSigningNetwork(this, await options.getNetwork(), network)
      return options.signTransaction(xdr, network)
    },
    async signAuthEntry(xdr, network) {
      if (!capabilities.authEntrySigning || !options.signAuthEntry) {
        throw new Error(`${id} does not support authorization-entry signing.`)
      }
      requireSigningNetwork(this, await options.getNetwork(), network)
      return options.signAuthEntry(xdr, network)
    },
    async disconnect() {
      await options.disconnect?.()
    },
  }
}

const freighter = createAdapter('freighter', {
  transactionSigning: true, authEntrySigning: true, networkIndependent: false,
}, {
  isAvailable: isFreighterInstalled,
  async connect() {
    const result = await connectFreighter()
    return { publicKey: result.publicKey, network: normalizeFreighterNetwork(result.network), mode: 'extension' }
  },
  getAddress: getFreighterAddress,
  async getNetwork() { return normalizeFreighterNetwork(await getFreighterNetwork()) },
  async signTransaction(xdr, network) {
    return signedValue(await signTransactionWithFreighter(xdr, network === 'mainnet' ? 'PUBLIC' : network.toUpperCase()))
  },
  async signAuthEntry(xdr, network) {
    const api = typeof window !== 'undefined' ? (window as any).freighterApi : null
    if (typeof api?.signAuthEntry !== 'function') throw new Error('Freighter does not support authorization-entry signing.')
    return signedValue(await api.signAuthEntry(xdr, { network: network === 'mainnet' ? 'PUBLIC' : network.toUpperCase() }))
  },
})

const xbull = createAdapter('xbull', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: false,
}, {
  isAvailable: isXBullInstalled,
  async connect() {
    const result = await connectXBull()
    return { publicKey: result.publicKey, network: networkFromResult(result), mode: isXBullInstalled() ? 'extension' : 'connector' }
  },
  async getAddress() {
    const result = await getInjectedWallet('xBullWalletConnect')?.getAddress?.()
    return result?.address ?? result?.publicKey ?? null
  },
  async getNetwork() {
    const result = await getInjectedWallet('xBullWalletConnect')?.getNetwork?.()
    return networkFromResult(result)
  },
  async signTransaction(xdr, network) {
    return signedValue(await signTransactionWithXBull(xdr, network === 'mainnet' ? 'PUBLIC' : network.toUpperCase()))
  },
})

const lobstr = createAdapter('lobstr', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: false,
}, {
  isAvailable: isLobstrInstalled,
  async connect() {
    const result = await connectLobstr()
    return { publicKey: result.publicKey, network: networkFromResult(result), mode: result.mode }
  },
  async getAddress() {
    const result = await getInjectedWallet('lobstrWalletConnect')?.getAddress?.()
    return result?.address ?? result?.publicKey ?? null
  },
  async getNetwork() {
    return networkFromResult(await getInjectedWallet('lobstrWalletConnect')?.getNetwork?.())
  },
  async signTransaction(xdr, network) {
    return signedValue(await signTransactionWithLobstr(xdr, network === 'mainnet' ? 'PUBLIC' : network.toUpperCase()))
  },
})

const solar = createAdapter('solar', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: false,
}, {
  isAvailable: isSolarInstalled,
  async connect() {
    const result = await connectSolar()
    return { publicKey: result.publicKey, network: networkFromResult(result), mode: result.mode }
  },
  async getAddress() {
    const result = await getInjectedWallet('solarWallet')?.getAddress?.()
    return result?.address ?? result?.publicKey ?? null
  },
  async getNetwork() {
    return networkFromResult(await getInjectedWallet('solarWallet')?.getNetwork?.())
  },
  async signTransaction(xdr, network) {
    return signedValue(await signTransactionWithSolar(xdr, network === 'mainnet' ? 'PUBLIC' : network.toUpperCase()))
  },
})

let albedoNetwork: NetworkName | null = null
let albedoAddress: string | null = null
const albedo = createAdapter('albedo', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: false,
}, {
  isAvailable: () => Boolean(typeof window !== 'undefined' && (window as WalletWindow).albedo),
  async connect(network) {
    const api = (window as WalletWindow).albedo
    if (!api?.publicKey) throw new Error('Albedo wallet is not available.')
    const result = await api.publicKey({ network: network === 'mainnet' ? 'public' : network })
    const publicKey = result?.pubkey ?? result?.publicKey ?? result?.address
    if (!publicKey) throw new Error('Albedo did not return a public key.')
    albedoAddress = publicKey
    albedoNetwork = networkFromResult(result) ?? network
    return { publicKey, network: albedoNetwork, mode: 'browser' }
  },
  async getAddress() { return albedoAddress },
  async getNetwork() {
    const result = await getInjectedWallet('albedo')?.getNetwork?.()
    return networkFromResult(result) ?? albedoNetwork
  },
  async signTransaction(xdr, network) {
    const api = (window as WalletWindow).albedo
    if (!api?.tx) throw new Error('Albedo transaction signing is not available.')
    return signedValue(await api.tx({ xdr, network: network === 'mainnet' ? 'public' : network }))
  },
  async signAuthEntry(xdr, network) {
    const api = (window as WalletWindow).albedo
    if (!api?.signAuthEntry) throw new Error('Albedo authorization-entry signing is not available.')
    return signedValue(await api.signAuthEntry({ xdr, network: network === 'mainnet' ? 'public' : network }))
  },
  async disconnect() { albedoNetwork = null; albedoAddress = null },
})

let hanaNetwork: NetworkName | null = null
let hanaAddress: string | null = null
const hana = createAdapter('hana', {
  transactionSigning: true, authEntrySigning: true, networkIndependent: false,
}, {
  isAvailable: () => Boolean(getInjectedWallet('hana')),
  async connect(network) {
    const api = getInjectedWallet('hana')
    if (!api) throw new Error('Hana wallet is not available.')
    const result = await api.connect?.()
    const queriedAddress = await (api.getAddress?.() ?? api.getPublicKey?.())
    const address = result?.publicKey ?? result?.address ?? result?.account?.address
      ?? queriedAddress?.address ?? queriedAddress?.publicKey ?? queriedAddress?.pubkey
    if (!address) throw new Error('Hana did not return a public key.')
    hanaAddress = address
    hanaNetwork = networkFromResult(result) ?? networkFromResult(await api.getNetwork?.())
    return { publicKey: address, network: hanaNetwork, mode: 'extension' }
  },
  async getAddress() {
    const api = getInjectedWallet('hana')
    const result = await (api?.getAddress?.() ?? api?.getPublicKey?.())
    return result?.address ?? result?.publicKey ?? result?.pubkey ?? hanaAddress
  },
  async getNetwork() {
    return networkFromResult(await getInjectedWallet('hana')?.getNetwork?.()) ?? hanaNetwork
  },
  async signTransaction(xdr, network) {
    const api = getInjectedWallet('hana')
    if (!api?.signTransaction) throw new Error('Hana transaction signing is not available.')
    return signedValue(await api.signTransaction(xdr, { network }))
  },
  async signAuthEntry(xdr, network) {
    const api = getInjectedWallet('hana')
    if (!api?.signAuthEntry) throw new Error('Hana authorization-entry signing is not available.')
    return signedValue(await api.signAuthEntry(xdr, { network }))
  },
  async disconnect() { hanaNetwork = null; hanaAddress = null },
})

let ledgerSession: { transport: any; stellarApp: any; publicKey: string; derivationPath: string } | null = null
const ledger = createAdapter('ledger', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: true,
}, {
  isAvailable: () => {
    if (typeof navigator === 'undefined') return false
    const hardwareNavigator = navigator as Navigator & { usb?: unknown; hid?: unknown }
    return Boolean(hardwareNavigator.usb || hardwareNavigator.hid)
  },
  async connect(_network, options) {
    const result = await connectHardwareWallet('ledger', { derivationPath: options?.derivationPath })
    ledgerSession = result as typeof ledgerSession
    return { publicKey: result.publicKey, network: null, mode: 'native-signing' }
  },
  async getAddress() { return ledgerSession?.publicKey ?? null },
  async getNetwork() { return null },
  async signTransaction(xdr, network) {
    if (!ledgerSession) throw new Error('Ledger is not connected. Connect the device first.')
    return signXdrWithLedger(xdr, NETWORKS[network].passphrase, ledgerSession.stellarApp, ledgerSession.publicKey, ledgerSession.derivationPath)
  },
  async disconnect() {
    if (ledgerSession) disconnectLedger(ledgerSession.transport)
    ledgerSession = null
  },
})

const walletConnect = createAdapter('walletconnect', {
  transactionSigning: true, authEntrySigning: false, networkIndependent: false,
}, {
  isAvailable: () => true,
  async connect(network) {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('WalletConnect currently supports only mainnet and testnet.')
    }
    const result = await connectWalletConnect(network)
    return { publicKey: result.publicKey, network: await walletConnect.getNetwork(), mode: 'walletconnect-v2' }
  },
  async getAddress() {
    const accounts = getActiveWCSession()?.namespaces?.stellar?.accounts ?? []
    return accounts.length ? accounts[0].split(':')[2] ?? null : null
  },
  async getNetwork() {
    const chain = getActiveWCSession()?.namespaces?.stellar?.accounts?.[0]?.split(':').slice(0, 2).join(':')
    return networkFromResult(chain)
  },
  async signTransaction(xdr, network) {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('WalletConnect currently supports only mainnet and testnet.')
    }
    return signXdrWithWalletConnect(xdr, network)
  },
  async disconnect() { await disconnectWalletConnect() },
})

export const walletAdapters: Record<WalletId, WalletAdapter> = {
  freighter, xbull, albedo, lobstr, hana, ledger, walletconnect: walletConnect, solar,
}

export function getWalletAdapter(id: string): WalletAdapter {
  const adapter = walletAdapters[id as WalletId]
  if (!adapter) throw new Error(`Unsupported wallet adapter: ${id}`)
  return adapter
}

export function connectWalletAdapter(id: string, network: NetworkName, options?: { derivationPath?: string }) {
  return getWalletAdapter(id).connect(network, options)
}