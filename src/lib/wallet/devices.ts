import { isValidPublicKey } from '../stellar'
import { connectLedger, isLedgerSupported } from './ledger'

export const HARDWARE_WALLET_DEVICES = [
  {
    id: 'ledger',
    name: 'Ledger Nano (S/X/S Plus)',
    description: 'USB hardware wallet with native signing support.',
    support: 'native',
  },
  {
    id: 'trezor',
    name: 'Trezor Model T / Safe 3',
    description: 'Watch-only mode with external signing flow.',
    support: 'watch_only',
  },
  {
    id: 'keystone',
    name: 'Keystone QR Wallet',
    description: 'Air-gapped watch-only mode with QR signing.',
    support: 'watch_only',
  },
]

export async function connectHardwareWallet(type, options = {}) {
  if (type === 'ledger') {
    const supported = await isLedgerSupported()
    if (!supported) {
      throw new Error('Ledger requires WebUSB/WebHID support (recommended browser: Chrome).')
    }
    const result = await connectLedger()
    return {
      ...result,
      mode: 'native-signing',
      deviceType: type,
    }
  }

  if (type === 'trezor' || type === 'keystone') {
    const manualPublicKey = (options.manualPublicKey || '').trim()
    if (!isValidPublicKey(manualPublicKey)) {
      throw new Error('Enter a valid public key to connect this device in watch-only mode.')
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
