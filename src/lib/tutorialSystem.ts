/**
 * Tutorial System — manages guided tours, step state, and contextual help
 */

// ─── Tour definitions ─────────────────────────────────────────────────────────

export const TOURS = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to Stellar Dashboard',
    description: 'A quick tour of the main features',
    steps: [
      {
        id: 'connect',
        target: '[data-tour="connect-panel"]',
        title: 'Connect Your Wallet',
        content: 'Start by entering a Stellar public key or connecting Freighter wallet to explore account data.',
        placement: 'right',
      },
      {
        id: 'network',
        target: '[data-tour="network-selector"]',
        title: 'Switch Networks',
        content: 'Toggle between Testnet and Mainnet. Use Testnet for development — it\'s free and safe.',
        placement: 'bottom',
      },
      {
        id: 'sidebar',
        target: '[data-tour="sidebar"]',
        title: 'Navigation',
        content: 'Access all dashboard sections here: account details, transactions, contracts, DEX, and more.',
        placement: 'right',
      },
      {
        id: 'overview',
        target: '[data-tour="overview-tab"]',
        title: 'Account Overview',
        content: 'See your balances, recent activity, and portfolio value at a glance.',
        placement: 'bottom',
      },
    ],
  },

  transactions: {
    id: 'transactions',
    title: 'Transaction Builder',
    description: 'Learn to build and sign transactions',
    steps: [
      {
        id: 'tx-builder',
        target: '[data-tour="tx-builder"]',
        title: 'Build Transactions',
        content: 'Construct any Stellar operation — payments, trustlines, offers — with a visual builder.',
        placement: 'top',
      },
      {
        id: 'tx-signer',
        target: '[data-tour="tx-signer"]',
        title: 'Sign & Submit',
        content: 'Sign transactions with your secret key or hardware wallet, then submit to the network.',
        placement: 'top',
      },
      {
        id: 'tx-simulator',
        target: '[data-tour="tx-simulator"]',
        title: 'Simulate First',
        content: 'Always simulate before submitting — catch errors and preview fees without spending XLM.',
        placement: 'top',
      },
    ],
  },

  contracts: {
    id: 'contracts',
    title: 'Soroban Smart Contracts',
    description: 'Interact with Soroban contracts',
    steps: [
      {
        id: 'contract-id',
        target: '[data-tour="contract-input"]',
        title: 'Enter Contract ID',
        content: 'Paste a Soroban contract address to inspect its ABI and invoke functions.',
        placement: 'bottom',
      },
      {
        id: 'contract-abi',
        target: '[data-tour="contract-abi"]',
        title: 'Browse the ABI',
        content: 'View all contract functions, their parameters, and return types.',
        placement: 'right',
      },
      {
        id: 'contract-invoke',
        target: '[data-tour="contract-invoke"]',
        title: 'Invoke Functions',
        content: 'Call contract functions directly from the dashboard with automatic XDR encoding.',
        placement: 'top',
      },
    ],
  },
};

// ─── Contextual help entries ──────────────────────────────────────────────────

export const HELP_ENTRIES = {
  'public-key': {
    title: 'Public Key',
    content: 'A Stellar public key starts with "G" and is 56 characters long. It\'s safe to share — it\'s your account address.',
    learnMore: 'https://developers.stellar.org/docs/learn/glossary#keypair',
  },
  'secret-key': {
    title: 'Secret Key',
    content: 'Starts with "S". Never share this — it controls your account. Use hardware wallets or Freighter for production.',
    learnMore: 'https://developers.stellar.org/docs/learn/glossary#keypair',
  },
  'trustline': {
    title: 'Trustline',
    content: 'A trustline allows your account to hold a non-XLM asset. You must establish one before receiving any token.',
    learnMore: 'https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts#trustlines',
  },
  'sequence-number': {
    title: 'Sequence Number',
    content: 'Each transaction must include the account\'s current sequence number + 1. It prevents replay attacks.',
    learnMore: 'https://developers.stellar.org/docs/learn/glossary#sequence-number',
  },
  'base-fee': {
    title: 'Base Fee',
    content: 'The minimum fee per operation is 100 stroops (0.00001 XLM). Higher fees get priority during congestion.',
    learnMore: 'https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering',
  },
  'soroban': {
    title: 'Soroban',
    content: 'Stellar\'s smart contract platform. Contracts are written in Rust and compiled to WebAssembly.',
    learnMore: 'https://developers.stellar.org/docs/build/smart-contracts/overview',
  },
  'multisig': {
    title: 'Multisig',
    content: 'Require multiple signers to authorize a transaction. Set thresholds for low, medium, and high operations.',
    learnMore: 'https://developers.stellar.org/docs/learn/encyclopedia/security/signatures-multisig',
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'tutorial_state';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const tutorialSystem = {
  /** Check if a tour has been completed */
  isCompleted(tourId) {
    return !!loadState()[`completed_${tourId}`];
  },

  /** Mark a tour as completed */
  complete(tourId) {
    const state = loadState();
    state[`completed_${tourId}`] = Date.now();
    saveState(state);
  },

  /** Reset a tour so it can be replayed */
  reset(tourId) {
    const state = loadState();
    delete state[`completed_${tourId}`];
    saveState(state);
  },

  /** Reset all tours */
  resetAll() {
    saveState({});
  },

  /** Get saved step index for a tour */
  getSavedStep(tourId) {
    return loadState()[`step_${tourId}`] ?? 0;
  },

  /** Save current step for a tour */
  saveStep(tourId, stepIndex) {
    const state = loadState();
    state[`step_${tourId}`] = stepIndex;
    saveState(state);
  },

  /** Get all available tours */
  getTours() {
    return Object.values(TOURS);
  },

  /** Get a specific tour */
  getTour(tourId) {
    return TOURS[tourId] ?? null;
  },

  /** Get contextual help for a topic */
  getHelp(topic) {
    return HELP_ENTRIES[topic] ?? null;
  },

  /** Check if this is a first-time user (no tours completed) */
  isFirstVisit() {
    const state = loadState();
    return !Object.keys(state).some(k => k.startsWith('completed_'));
  },
};

export default tutorialSystem;
