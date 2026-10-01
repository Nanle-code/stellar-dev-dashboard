/**
 * Deterministic wallet-adapter provider mock for E2E tests.
 * The selected adapter provider is exposed through the Freighter-compatible API.
 */

window.__MOCK_WALLET_ADAPTER_STATE__ = {
  isConnected: true,
  isLocked: false,
  publicKey: 'GA1234567890MOCKWALLETPUBLICKEY1234567890',
  network: 'TESTNET',
  networkUrl: 'https://horizon-testnet.stellar.org',
  rejectNextConnect: false,
  rejectNextSign: false,
};

window.mockWalletAdapter = {
  setState(newState) {
    window.__MOCK_WALLET_ADAPTER_STATE__ = {
      ...window.__MOCK_WALLET_ADAPTER_STATE__,
      ...newState,
    };
  },
  simulateAccountChange(newPublicKey) {
    this.setState({ publicKey: newPublicKey });
    window.dispatchEvent(new CustomEvent('walletAccountChange', { detail: newPublicKey }));
  },
  simulateNetworkChange(newNetwork, newNetworkUrl = 'https://horizon-mock.stellar.org') {
    this.setState({ network: newNetwork, networkUrl: newNetworkUrl });
    window.dispatchEvent(new CustomEvent('walletNetworkChange', { detail: newNetwork }));
  },
  simulateLock() {
    this.setState({ isLocked: true });
    window.dispatchEvent(new CustomEvent('walletLock'));
  },
  rejectNextConnect() {
    this.setState({ rejectNextConnect: true });
  },
  rejectNextSign() {
    this.setState({ rejectNextSign: true });
  },
  simulateSpoofedPublicKey(invalidKey = 'INVALID_SPOOFED_KEY_12345') {
    this.setState({ publicKey: invalidKey });
    window.dispatchEvent(new CustomEvent('walletAccountChange', { detail: invalidKey }));
  },
  simulateNetworkMismatch(mismatchedNetwork = 'PUBLIC') {
    this.setState({ network: mismatchedNetwork });
    window.dispatchEvent(new CustomEvent('walletNetworkChange', { detail: mismatchedNetwork }));
  },
  simulateHostileProvider(tamperedProps = {}) {
    Object.assign(window.freighterApi, tamperedProps);
  },
  simulateUnsupportedEnvironment() {
    this._savedFreighterApi = window.freighterApi;
    delete window.freighterApi;
  },
  resetThreatSimulation() {
    if (this._savedFreighterApi) {
      window.freighterApi = this._savedFreighterApi;
      this._savedFreighterApi = null;
    }
    this.setState({
      isConnected: true,
      isLocked: false,
      publicKey: 'GA1234567890MOCKWALLETPUBLICKEY1234567890',
      network: 'TESTNET',
      networkUrl: 'https://horizon-testnet.stellar.org',
      rejectNextConnect: false,
      rejectNextSign: false,
    });
  },
};

window.freighterApi = {
  isConnected: async () => {
    return { isConnected: window.__MOCK_WALLET_ADAPTER_STATE__.isConnected };
  },

  isAllowed: async () => {
    return { isAllowed: !window.__MOCK_WALLET_ADAPTER_STATE__.isLocked };
  },

  setAllowed: async () => {
    return { isAllowed: true };
  },

  requestAccess: async () => {
    const state = window.__MOCK_WALLET_ADAPTER_STATE__;
    if (state.isLocked) {
      return { error: 'Freighter is locked. Please unlock it.' };
    }
    if (state.rejectNextConnect) {
      state.rejectNextConnect = false;
      return { error: 'User declined access.' };
    }
    return { address: state.publicKey };
  },

  getAddress: async () => {
    const state = window.__MOCK_WALLET_ADAPTER_STATE__;
    if (state.isLocked) {
      return { error: 'Freighter is locked. Please unlock it.' };
    }
    return { address: state.publicKey };
  },

  getNetwork: async () => {
    const state = window.__MOCK_WALLET_ADAPTER_STATE__;
    return {
      network: state.network,
      networkUrl: state.networkUrl,
    };
  },

  signTransaction: async (tx, _opts) => {
    const state = window.__MOCK_WALLET_ADAPTER_STATE__;
    if (state.isLocked) {
      return { error: 'Freighter is locked. Please unlock it.' };
    }
    if (state.rejectNextSign) {
      state.rejectNextSign = false;
      return { error: 'User declined transaction signing.' };
    }
    return {
      signedTxXdr: tx + '_mock_signed_by_adapter',
    };
  },

  getUserInfo: async () => {
    const state = window.__MOCK_WALLET_ADAPTER_STATE__;
    return {
      publicKey: state.publicKey,
    };
  },
};
