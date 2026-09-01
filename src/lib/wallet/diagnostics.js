/**
 * Wallet connection diagnostics.
 *
 * Centralizes classification of common Freighter and Ledger connection and
 * signing failures so that both the UI and the troubleshooting runbook can
 * share a single source of truth for "what went wrong" + "how to fix it".
 *
 * Every recognized failure is mapped to:
 *   - `category`   – coarse bucket (extension, network, browser, hardware, ...)
 *   - `message`    – user-facing description of the failure
 *   - `remediation`– concrete next step(s) to resolve it
 *   - `severity`   – how severe the failure is (error | warning | info)
 */

export const WALLET_DIAGNOSTIC_CATEGORIES = Object.freeze({
  EXTENSION_NOT_INSTALLED: 'extension_not_installed',
  EXTENSION_LOCKED: 'extension_locked',
  ACCESS_DENIED: 'access_denied',
  NETWORK_MISMATCH: 'network_mismatch',
  BROWSER_UNSUPPORTED: 'browser_unsupported',
  HARDWARE_NOT_CONNECTED: 'hardware_not_connected',
  HARDWARE_LOCKED: 'hardware_locked',
  STELLAR_APP_NOT_OPEN: 'stellar_app_not_open',
  LEDGER_DEPENDENCY_MISSING: 'ledger_dependency_missing',
  INVALID_INPUT: 'invalid_input',
  UNKNOWN: 'unknown',
})

/**
 * @typedef {{
 *   category: string,
 *   message: string,
 *   remediation: string,
 *   severity: 'error'|'warning'|'info',
 *   matched: boolean,
 * }} ConnectionDiagnostic
 */

const SEVERITY_ERROR = 'error'
const SEVERITY_WARNING = 'warning'

/**
 * Normalize a thrown/returned error into a stable lower-cased string so that
 * matching is resilient to case and leading "Error:" prefixes.
 * @param {unknown} err
 * @returns {string}
 */
function normalizeError(err) {
  if (!err) return ''
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : 'unknown error'
  return String(raw)
    .toLowerCase()
    .replace(/^error:\s*/, '')
    .trim()
}

/**
 * Classify a Freighter error message into a diagnostic.
 * @param {unknown} err
 * @returns {ConnectionDiagnostic}
 */
export function diagnoseFreighterError(err) {
  const msg = normalizeError(err)
  const base = { severity: SEVERITY_ERROR, matched: true }

  if (!msg) {
    return {
      category: WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN,
      message: 'Freighter returned an empty error.',
      remediation: 'Retry the connection. If it persists, reinstall the Freighter extension.',
      severity: SEVERITY_WARNING,
      matched: false,
    }
  }

  if (
    /not installed|not found|no freighter|freighter wallet extension is not installed|freighter wallet not found|isn't installed/i.test(msg)
  ) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_NOT_INSTALLED,
      message: 'The Freighter browser extension is not installed, not injected, or was blocked.',
      remediation:
        'Install Freighter from https://freighter.app, then refresh the page. ' +
        'The dashboard cannot detect the extension if it is disabled, pinned to another profile, ' +
        'or blocked by a browser privacy setting.',
    }
  }

  if (/locked|unlock|rejected|declined|denied|user declined|access.*denied/i.test(msg)) {
    const isDenied = /declined|denied|rejected/i.test(msg)
    if (isDenied) {
      return {
        ...base,
        category: WALLET_DIAGNOSTIC_CATEGORIES.ACCESS_DENIED,
        message: 'The connection request was declined.',
        remediation:
          'Click the wallet button again and approve the access request in the Freighter popup. ' +
          'If the popup is not appearing, check that it is not blocked by the browser.',
      }
    }
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.EXTENSION_LOCKED,
      message: 'The Freighter wallet is locked.',
      remediation: 'Open Freighter and unlock your wallet, then reconnect from the dashboard.',
    }
  }

  if (/network|passphrase|turned off|turn.*off|blocked/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.NETWORK_MISMATCH,
      message:
        'There is a network mismatch between the dashboard and Freighter, or the extension ' +
        'cannot reach the network.',
      remediation:
        'In Freighter, switch to the same network as the dashboard (Testnet or Mainnet) using the ' +
        'network selector in the extension, then reconnect.',
    }
  }

  if (/sign|publickey|get address|getaddress|invalid/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.INVALID_INPUT,
      message: 'Freighter could not produce a valid address or signature.',
      remediation:
        'Confirm the account is funded on the selected network and that Freighter has a valid ' +
        'active account selected, then try again.',
    }
  }

  return {
    category: WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN,
    message: `Unrecognized Freighter error: ${msg}`,
    remediation: 'Enable developer tools, reproduce the failure, and inspect the console for details.',
    severity: SEVERITY_WARNING,
    matched: false,
  }
}

/**
 * Classify a Ledger hardware wallet error message into a diagnostic.
 * @param {unknown} err
 * @returns {ConnectionDiagnostic}
 */
export function diagnoseLedgerError(err) {
  const msg = normalizeError(err)
  const base = { severity: SEVERITY_ERROR, matched: true }

  if (!msg) {
    return {
      category: WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN,
      message: 'The Ledger device returned an empty error.',
      remediation: 'Retry the connection. Confirm the device is plugged in and unlocked.',
      severity: SEVERITY_WARNING,
      matched: false,
    }
  }

  if (/optional dependency|not installed|@ledgerhq|@stellar\/ledger|npm install|hw-transport/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.LEDGER_DEPENDENCY_MISSING,
      message: 'Optional Ledger dependencies are not installed.',
      remediation:
        'Install the optional transports: `npm install @ledgerhq/hw-transport-webusb @stellar/ledger`, ' +
        'then rebuild the application.',
    }
  }

  if (/webusb|webhid|not supported in this browser|firefox|safari|cannot read property|usb is undefined|hid is undefined/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.BROWSER_UNSUPPORTED,
      message: 'This browser does not support the WebUSB/WebHID transports required by Ledger.',
      remediation:
        'Use Chrome, Edge, or a Chromium-based browser. Firefox and Safari do not expose the ' +
        'WebUSB/WebHID APIs that the Ledger Stellar connection relies on.',
    }
  }

  if (/not connected|connect the device|no device|disconnected|device not found|no device selected/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.HARDWARE_NOT_CONNECTED,
      message: 'No Ledger device was detected.',
      remediation:
        'Plug the Ledger into a USB port (or pair over Bluetooth), unlock it, and open the ' +
        'Stellar app, then try connecting again.',
    }
  }

  if (/(0x6985|denied|rejected|user rejected|declined)/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.ACCESS_DENIED,
      message: 'The transaction/request was rejected on the Ledger device.',
      remediation: 'Review the request shown on the device screen and approve it when you intend to continue.',
    }
  }

  if (/(0x6b0c|locked|lock)/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.HARDWARE_LOCKED,
      message: 'The Ledger device is locked.',
      remediation: 'Enter the PIN to unlock the Ledger, then retry the connection or signing operation.',
    }
  }

  if (/(0x6d00|not open|stellar app|is not open|0x6511)/i.test(msg)) {
    return {
      ...base,
      category: WALLET_DIAGNOSTIC_CATEGORIES.STELLAR_APP_NOT_OPEN,
      message: 'The Stellar app is not open on the Ledger device.',
      remediation: 'On the Ledger, navigate to and open the Stellar app, then retry.',
    }
  }

  return {
    category: WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN,
    message: `Unrecognized Ledger error: ${msg}`,
    remediation: 'Inspect the device screen messages and the browser console for the raw error code.',
    severity: SEVERITY_WARNING,
    matched: false,
  }
}

/**
 * Diagnose a wallet connection failure. Delegates to the Freighter or Ledger
 * classifier based on `walletType`.
 *
 * @param {string} walletType – 'freighter', 'ledger', or any other id
 * @param {unknown} err
 * @returns {ConnectionDiagnostic}
 */
export function diagnoseWalletConnection(walletType, err) {
  const type = String(walletType || '').toLowerCase()

  if (type === 'freighter') {
    return diagnoseFreighterError(err)
  }
  if (type === 'ledger') {
    return diagnoseLedgerError(err)
  }

  const msg = normalizeError(err)
  return {
    category: WALLET_DIAGNOSTIC_CATEGORIES.UNKNOWN,
    message: msg
      ? `Connection failed for unsupported wallet type "${walletType}": ${msg}`
      : `Connection failed for an unsupported wallet type: "${walletType}".`,
    remediation:
      'Check the wallet\'s own documentation and confirm the wallet is supported ' +
      '(Freighter and Ledger are supported).',
    severity: SEVERITY_ERROR,
    matched: false,
  }
}
