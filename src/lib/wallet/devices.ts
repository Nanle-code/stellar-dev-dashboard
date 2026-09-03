import { isValidPublicKey } from '../stellar'
import { connectLedger, isLedgerSupported } from './ledger'

export const HARDWARE_WALLET_DEVICES = [
  {
    id: 'ledger',
    name: 'Ledger Nano (S/X/S Plus)',
    description: 'USB hardware wallet with native signing. Supports multi-account derivation paths.',
    support: 'native',
    features: ['native-signing', 'webusb', 'webhid', 'multi-account'],
  },
  {
    id: 'trezor',
    name: 'Trezor Model T / Safe 3',
    description: 'Watch-only mode. Sign externally via Trezor Suite or Trezor Bridge.',
    support: 'watch_only',
    features: ['watch-only', 'external-signing'],
  },
  {
    id: 'keystone',
    name: 'Keystone QR Wallet',
    description: 'Air-gapped watch-only mode with QR signing.',
    support: 'watch_only',
    features: ['watch-only', 'qr-signing', 'air-gapped'],
  },
]

/**
 * Standard BIP-44 Stellar derivation paths.
 * Index 0 is the default; users can select higher indices for sub-accounts.
 */
export const LEDGER_DERIVATION_PATHS = [
  { label: "Account 0 (default)  44'/148'/0'", path: "44'/148'/0'" },
  { label: "Account 1            44'/148'/1'", path: "44'/148'/1'" },
  { label: "Account 2            44'/148'/2'", path: "44'/148'/2'" },
  { label: "Account 3            44'/148'/3'", path: "44'/148'/3'" },
]

/**
 * Connect a hardware wallet.
 * @param {'ledger'|'trezor'|'keystone'} type
 * @param {{ manualPublicKey?: string, derivationPath?: string }} options
 */
export async function connectHardwareWallet(type, options = {}) {
  if (type === 'ledger') {
    const supported = await isLedgerSupported()
    if (!supported) {
      throw new Error('Ledger requires WebUSB/WebHID support (recommended browser: Chrome).')
    }
    const result = await connectLedger(options.derivationPath)
    return {
      ...result,
      mode: 'native-signing',
      deviceType: type,
      derivationPath: options.derivationPath || "44'/148'/0'",
    }
  }

  if (type === 'trezor' || type === 'keystone') {
    const manualPublicKey = (options.manualPublicKey || '').trim()
    if (!isValidPublicKey(manualPublicKey)) {
      throw new Error('Enter a valid G... public key to connect this device in watch-only mode.')
    }
    return {
      publicKey: manualPublicKey,
      transport: null,
      mode: 'watch-only',
      deviceType: type,
      requiresExternalConfirmation: true,
    }
  }

  throw new Error(`Unsupported hardware wallet type: ${type}`)
}
