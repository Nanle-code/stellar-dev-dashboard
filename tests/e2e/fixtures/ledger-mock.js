/**
 * Deterministic Ledger Hardware Wallet mock fixture for E2E and browser integration tests.
 * Simulates WebUSB / WebHID transport and Stellar Ledger app interactions (#841).
 */

window.__MOCK_LEDGER_STATE__ = {
  connected: true,
  isLocked: false,
  appOpen: true,
  rejectNextSign: false,
  publicKey: 'GBLEDGER1234567890MOCKKEY123456789012345678901234567890',
  derivationPath: "44'/148'/0'",
  firmwareVersion: '2.1.0',
  vendorId: 0x2c97, // Ledger Official Vendor ID
  productId: 0x0004, // Ledger Nano X
  isSupportedBrowser: true,
};

window.mockLedgerAdapter = {
  setState(newState) {
    window.__MOCK_LEDGER_STATE__ = {
      ...window.__MOCK_LEDGER_STATE__,
      ...newState,
    };
  },

  simulateLock() {
    this.setState({ isLocked: true });
    window.dispatchEvent(new CustomEvent('ledgerLock'));
  },

  simulateUnlock() {
    this.setState({ isLocked: false });
    window.dispatchEvent(new CustomEvent('ledgerUnlock'));
  },

  simulateAppClosed() {
    this.setState({ appOpen: false });
  },

  simulateAppOpened() {
    this.setState({ appOpen: true });
  },

  simulateUserRejection() {
    this.setState({ rejectNextSign: true });
  },

  simulateSpoofedPublicKey(invalidKey = 'INVALID_SPOOFED_LEDGER_KEY') {
    this.setState({ publicKey: invalidKey });
  },

  simulateRogueDevice() {
    this.setState({
      vendorId: 0x9999, // Unrecognized vendor
      publicKey: 'MALICIOUS_ROGUE_DEVICE_KEY',
    });
  },

  simulateOutdatedFirmware(version = '1.5.0') {
    this.setState({ firmwareVersion: version });
  },

  simulateUnsupportedBrowser() {
    this.setState({ isSupportedBrowser: false });
    this._originalUsb = navigator.usb;
    this._originalHid = navigator.hid;
    try {
      delete navigator.usb;
      delete navigator.hid;
    } catch {
      Object.defineProperty(navigator, 'usb', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'hid', { value: undefined, configurable: true });
    }
  },

  reset() {
    if (this._originalUsb) {
      Object.defineProperty(navigator, 'usb', { value: this._originalUsb, configurable: true });
    }
    if (this._originalHid) {
      Object.defineProperty(navigator, 'hid', { value: this._originalHid, configurable: true });
    }
    this.setState({
      connected: true,
      isLocked: false,
      appOpen: true,
      rejectNextSign: false,
      publicKey: 'GBLEDGER1234567890MOCKKEY123456789012345678901234567890',
      derivationPath: "44'/148'/0'",
      firmwareVersion: '2.1.0',
      vendorId: 0x2c97,
      productId: 0x0004,
      isSupportedBrowser: true,
    });
  },
};

// Mock Stellar Ledger app representation
window.mockStellarLedgerApp = {
  async getPublicKey(_derivationPath) {
    const state = window.__MOCK_LEDGER_STATE__;
    if (state.isLocked) {
      throw new Error('0x6b0c: Ledger device is locked');
    }
    if (!state.appOpen) {
      throw new Error('0x6d00: Stellar app is not open on the Ledger device');
    }
    return { publicKey: state.publicKey };
  },

  async signTransaction(_derivationPath, _txHash) {
    const state = window.__MOCK_LEDGER_STATE__;
    if (state.isLocked) {
      throw new Error('0x6b0c: Ledger device is locked');
    }
    if (!state.appOpen) {
      throw new Error('0x6d00: Stellar app is not open on the Ledger device');
    }
    if (state.rejectNextSign) {
      state.rejectNextSign = false;
      throw new Error('0x6985: user rejected transaction');
    }
    // Return dummy 64-byte signature
    const signature = new Uint8Array(64);
    signature.fill(0xaa);
    return { signature };
  },
};
