/**
 * Deterministic Freighter browser mock for E2E tests.
 * This script is injected into the page via Playwright's addInitScript.
 */

window.__MOCK_FREIGHTER_STATE__ = {
  isConnected: true,
  isLocked: false,
  publicKey: 'GA1234567890MOCKFREIGHTERPUBLICKEY1234567890',
  network: 'TESTNET',
  networkUrl: 'https://horizon-testnet.stellar.org',
  rejectNextConnect: false,
  rejectNextSign: false,
};

window.mockFreighter = {
  setState(newState) {
    window.__MOCK_FREIGHTER_STATE__ = {
      ...window.__MOCK_FREIGHTER_STATE__,
      ...newState,
    };
  },
  simulateAccountChange(newPublicKey) {
    this.setState({ publicKey: newPublicKey });
    window.dispatchEvent(new CustomEvent('freighterAccountChange', { detail: newPublicKey }));
  },
  simulateNetworkChange(newNetwork, newNetworkUrl = 'https://horizon-mock.stellar.org') {
    this.setState({ network: newNetwork, networkUrl: newNetworkUrl });
    window.dispatchEvent(new CustomEvent('freighterNetworkChange', { detail: newNetwork }));
  },
  simulateLock() {
    this.setState({ isLocked: true });
    window.dispatchEvent(new CustomEvent('freighterLock'));
  },
  rejectNextConnect() {
    this.setState({ rejectNextConnect: true });
  },
  rejectNextSign() {
    this.setState({ rejectNextSign: true });
  }
};

window.freighterApi = {
  isConnected: async () => {
    return { isConnected: window.__MOCK_FREIGHTER_STATE__.isConnected };
  },
  
  isAllowed: async () => {
    return { isAllowed: !window.__MOCK_FREIGHTER_STATE__.isLocked };
  },
  
  setAllowed: async () => {
    return { isAllowed: true };
  },

  requestAccess: async () => {
    const state = window.__MOCK_FREIGHTER_STATE__;
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
    const state = window.__MOCK_FREIGHTER_STATE__;
    if (state.isLocked) {
      return { error: 'Freighter is locked. Please unlock it.' };
    }
    return { address: state.publicKey };
  },

  getNetwork: async () => {
    const state = window.__MOCK_FREIGHTER_STATE__;
    return { 
      network: state.network,
      networkUrl: state.networkUrl
    };
  },

  signTransaction: async (tx, opts) => {
    const state = window.__MOCK_FREIGHTER_STATE__;
    if (state.isLocked) {
      return { error: 'Freighter is locked. Please unlock it.' };
    }
    if (state.rejectNextSign) {
      state.rejectNextSign = false;
      return { error: 'User declined transaction signing.' };
    }
    return { 
      signedTxXdr: tx + '_mock_signed_by_freighter' 
    };
  },
  
  getUserInfo: async () => {
    const state = window.__MOCK_FREIGHTER_STATE__;
    return {
      publicKey: state.publicKey,
    };
  }
};
