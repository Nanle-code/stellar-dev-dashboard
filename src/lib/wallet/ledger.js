/**
 * Ledger hardware wallet connector for Stellar.
 * Uses the Stellar Ledger transport for signing transactions.
 *
 * NOTE: Ledger integration requires the user to have:
 * - A Ledger hardware wallet (Nano S/X/S Plus)
 * - The Stellar app installed on the device
 * - The device connected via USB and unlocked
 */

const LEDGER_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
}

let ledgerStatus = LEDGER_STATUS.DISCONNECTED

export function getLedgerStatus() {
  return ledgerStatus
}

export async function isLedgerSupported() {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.usb !== 'undefined' || typeof navigator.hid !== 'undefined'
}

export async function connectLedger() {
  const supported = await isLedgerSupported()
  if (!supported) {
    throw new Error('WebUSB/WebHID is not supported in this browser. Please use Chrome or a compatible browser.')
  }

  ledgerStatus = LEDGER_STATUS.CONNECTING

  try {
    // Dynamic import – the user must install @ledgerhq packages separately
    // These packages are optional and not bundled with the app.
    // We use Function constructor to avoid Rollup/Vite static analysis of the import path.
    const dynamicImport = new Function('specifier', 'return import(specifier)')
    let TransportWebUSB, StellarLedger

    try {
      TransportWebUSB = (await dynamicImport('@ledgerhq/hw-transport-webusb')).default
    } catch {
      throw new Error(
        'Ledger transport library is not installed. Install @ledgerhq/hw-transport-webusb and @stellar/ledger to use Ledger.'
      )
    }

    const transport = await TransportWebUSB.create()

    try {
      StellarLedger = (await dynamicImport('@stellar/ledger')).default
    } catch {
      transport.close()
      throw new Error('Stellar Ledger library is not installed. Install @stellar/ledger.')
    }

    const stellarApp = new StellarLedger(transport)
    const result = await stellarApp.getPublicKey("44'/148'/0'")

    ledgerStatus = LEDGER_STATUS.CONNECTED

    return {
      publicKey: result.publicKey,
      transport,
      stellarApp,
    }
  } catch (error) {
    ledgerStatus = LEDGER_STATUS.ERROR
    throw new Error(`Ledger connection failed: ${error.message}`)
  }
}

export async function signTransactionWithLedger(transaction, stellarApp) {
  if (!stellarApp) {
    throw new Error('Ledger is not connected')
  }

  try {
    const result = await stellarApp.signTransaction("44'/148'/0'", transaction.signatureBase())
    return result.signature
  } catch (error) {
    throw new Error(`Ledger signing failed: ${error.message}`)
  }
}

export function disconnectLedger(transport) {
  if (transport) {
    try {
      transport.close()
    } catch {
      // Already closed
    }
  }
  ledgerStatus = LEDGER_STATUS.DISCONNECTED
}
