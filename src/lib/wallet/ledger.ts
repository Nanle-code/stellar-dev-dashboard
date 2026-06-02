/**
 * Ledger hardware wallet connector for Stellar.
 *
 * Optional peer dependencies (not bundled):
 *   @ledgerhq/hw-transport-webusb  – WebUSB transport (Chrome / Edge)
 *   @ledgerhq/hw-transport-webhid  – WebHID transport (Chrome 89+)
 *   @stellar/ledger                – Stellar Ledger app bindings
 *
 * Install them alongside the app when Ledger support is needed:
 *   npm install @ledgerhq/hw-transport-webusb @stellar/ledger
 *
 * Browser support:
 *   WebUSB  – Chrome, Edge (not Firefox, Safari)
 *   WebHID  – Chrome 89+, Edge 89+ (not Firefox, Safari)
 */

import * as StellarSdk from '@stellar/stellar-sdk'

const LEDGER_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
}

const DERIVATION_PATH = "44'/148'/0'"

let ledgerStatus = LEDGER_STATUS.DISCONNECTED
// Module-level session – survives component re-mounts
let _activeStellarApp = null
let _activePublicKey = null

export function getActiveLedgerSession() {
  return { stellarApp: _activeStellarApp, publicKey: _activePublicKey }
}

export function clearLedgerSession() {
  _activeStellarApp = null
  _activePublicKey = null
}

export function getLedgerStatus() {
  return ledgerStatus
}

/**
 * Returns true when the browser exposes WebUSB or WebHID.
 * Firefox and Safari do not support either API.
 */
export async function isLedgerSupported() {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.usb !== 'undefined' || typeof navigator.hid !== 'undefined'
}

/**
 * Dynamically import a package without Vite/Rollup static analysis.
 * Throws a user-friendly error when the package is absent.
 */
async function dynamicImport(specifier) {
  try {
    return await new Function('s', 'return import(s)')(specifier)
  } catch {
    throw new Error(
      `Optional dependency "${specifier}" is not installed. ` +
      `Run: npm install @ledgerhq/hw-transport-webusb @stellar/ledger`
    )
  }
}

/**
 * Open a Ledger transport (WebUSB preferred, WebHID fallback).
 * @returns {{ transport, stellarApp, publicKey }}
 */
export async function connectLedger() {
  const supported = await isLedgerSupported()
  if (!supported) {
    throw new Error(
      'WebUSB/WebHID is not supported in this browser. ' +
      'Please use Chrome or a Chromium-based browser.'
    )
  }

  ledgerStatus = LEDGER_STATUS.CONNECTING

  try {
    let TransportWebUSB
    try {
      TransportWebUSB = (await dynamicImport('@ledgerhq/hw-transport-webusb')).default
    } catch {
      // Try WebHID as fallback
      const TransportWebHID = (await dynamicImport('@ledgerhq/hw-transport-webhid')).default
      const transport = await TransportWebHID.create()
      return await _finishConnect(transport)
    }

    const transport = await TransportWebUSB.create()
    return await _finishConnect(transport)
  } catch (error) {
    ledgerStatus = LEDGER_STATUS.ERROR
    throw new Error(`Ledger connection failed: ${error.message}`)
  }
}

async function _finishConnect(transport) {
  let StellarLedger
  try {
    StellarLedger = (await dynamicImport('@stellar/ledger')).default
  } catch (err) {
    transport.close()
    throw err
  }

  const stellarApp = new StellarLedger(transport)
  const result = await stellarApp.getPublicKey(DERIVATION_PATH)

  ledgerStatus = LEDGER_STATUS.CONNECTED
  _activeStellarApp = stellarApp
  _activePublicKey = result.publicKey

  return {
    publicKey: result.publicKey,
    transport,
    stellarApp,
  }
}

/**
 * Sign a raw Stellar Transaction object with the connected Ledger device.
 * Returns the raw signature bytes (Buffer / Uint8Array).
 *
 * @param {StellarSdk.Transaction} transaction
 * @param {object} stellarApp – instance returned by connectLedger
 */
export async function signTransactionWithLedger(transaction, stellarApp) {
  if (!stellarApp) {
    throw new Error('Ledger is not connected. Connect the device first.')
  }

  try {
    const result = await stellarApp.signTransaction(DERIVATION_PATH, transaction.signatureBase())
    return result.signature
  } catch (error) {
    throw new Error(`Ledger signing failed: ${error.message}`)
  }
}

/**
 * Full XDR signing flow:
 *   1. Parse the unsigned XDR envelope
 *   2. Prompt the Ledger device to sign
 *   3. Attach the signature to the transaction
 *   4. Return the signed XDR envelope string
 *
 * @param {string} xdr            – Base64-encoded unsigned transaction XDR
 * @param {string} networkPassphrase
 * @param {object} stellarApp     – instance returned by connectLedger
 * @param {string} publicKey      – Ledger public key (for attaching the signature)
 * @returns {Promise<string>}     – Signed XDR envelope (base64)
 */
export async function signXdrWithLedger(xdr, networkPassphrase, stellarApp, publicKey) {
  if (!stellarApp) {
    throw new Error('Ledger is not connected. Connect the device first.')
  }

  if (!xdr || !xdr.trim()) {
    throw new Error('Transaction XDR is required.')
  }

  let transaction
  try {
    transaction = StellarSdk.TransactionBuilder.fromXDR(xdr.trim(), networkPassphrase)
  } catch {
    throw new Error('Invalid transaction XDR. Make sure you pasted the full unsigned envelope.')
  }

  // FeeBumpTransaction wraps an inner transaction – sign the inner one.
  const txToSign =
    transaction instanceof StellarSdk.FeeBumpTransaction
      ? transaction.innerTransaction
      : transaction

  let signatureBytes
  try {
    const result = await stellarApp.signTransaction(DERIVATION_PATH, txToSign.signatureBase())
    signatureBytes = result.signature
  } catch (error) {
    // Surface device-specific errors clearly
    if (error.message?.includes('0x6985') || error.message?.toLowerCase().includes('denied')) {
      throw new Error('Transaction was rejected on the Ledger device.')
    }
    if (error.message?.includes('0x6b0c') || error.message?.toLowerCase().includes('locked')) {
      throw new Error('Ledger device is locked. Unlock it and open the Stellar app.')
    }
    if (error.message?.includes('0x6d00') || error.message?.toLowerCase().includes('not open')) {
      throw new Error('Stellar app is not open on the Ledger device.')
    }
    throw new Error(`Ledger signing failed: ${error.message}`)
  }

  // Attach the signature
  const keypair = StellarSdk.Keypair.fromPublicKey(publicKey)
  txToSign.addSignature(keypair.publicKey(), signatureBytes.toString('base64'))

  return txToSign.toEnvelope().toXDR('base64')
}

export function disconnectLedger(transport) {
  if (transport) {
    try {
      transport.close()
    } catch {
      // Already closed
    }
  }
  _activeStellarApp = null
  _activePublicKey = null
  ledgerStatus = LEDGER_STATUS.DISCONNECTED
}
