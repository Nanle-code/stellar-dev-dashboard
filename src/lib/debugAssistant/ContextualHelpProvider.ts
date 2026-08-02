export interface HelpSuggestion {
  id: string;
  title: string;
  description: string;
  relevance: number;
  type: 'doc' | 'action' | 'tip' | 'tutorial';
  url?: string;
  action?: string;
  category: string;
}

const TAB_SPECIFIC_HELP: Record<string, HelpSuggestion[]> = {
  overview: [
    {
      id: 'ov-1',
      title: 'Understanding Account Balances',
      description: 'The Overview shows your XLM balance and USD estimates. Non-native assets are priced via SDEX order books.',
      relevance: 0.9,
      type: 'tip',
      category: 'account',
    },
    {
      id: 'ov-2',
      title: 'Transaction Activity',
      description: 'Recent transactions show the latest 5 operations. Use the Transactions tab for the full history.',
      relevance: 0.8,
      type: 'tip',
      category: 'transactions',
    },
  ],
  account: [
    {
      id: 'ac-1',
      title: 'Account Signers and Thresholds',
      description: 'Signers with combined weight meeting the threshold can authorize transactions. Low/Medium/High thresholds apply to different operation types.',
      relevance: 0.95,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/learn/encyclopedia/signatures-multisig',
      category: 'account',
    },
    {
      id: 'ac-2',
      title: 'Managing Trustlines',
      description: 'Each trustline adds a subentry and increases the minimum XLM balance. Remove unused trustlines to free up XLM.',
      relevance: 0.85,
      type: 'action',
      action: 'Review your trustlines in the asset balances section',
      category: 'assets',
    },
    {
      id: 'ac-3',
      title: 'Open Offers Management',
      description: 'Active SDEX sell offers are shown below. Manage offers to control your exposure in the order book.',
      relevance: 0.7,
      type: 'tip',
      category: 'dex',
    },
  ],
  transactions: [
    {
      id: 'tx-1',
      title: 'Transaction Pagination',
      description: 'Use the "Load More" button to fetch additional records. The cursor-based pagination preserves previously loaded data.',
      relevance: 0.9,
      type: 'tip',
      category: 'transactions',
    },
    {
      id: 'tx-2',
      title: 'Operation Type Reference',
      description: 'Each operation type has specific fields. Payment operations show from/to/amount; ManageSellOffer shows offer details.',
      relevance: 0.8,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/learn/encyclopedia/transactions/operations',
      category: 'transactions',
    },
    {
      id: 'tx-3',
      title: 'Transaction Status Codes',
      description: 'Failed transactions include result codes that explain the failure. Hover over the status indicator for details.',
      relevance: 0.85,
      type: 'tip',
      category: 'transactions',
    },
  ],
  contracts: [
    {
      id: 'ct-1',
      title: 'Soroban Contract Inspection',
      description: 'Enter a contract ID (C...) to fetch its ledger entry. The raw JSON shows the contract code and storage.',
      relevance: 0.9,
      type: 'tip',
      category: 'contracts',
    },
    {
      id: 'ct-2',
      title: 'Contract Invocation',
      description: 'Build contract calls with typed arguments. Use Simulate to check return values and costs before submitting.',
      relevance: 0.95,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/soroban/contracts',
      category: 'contracts',
    },
  ],
  network: [
    {
      id: 'ns-1',
      title: 'Live Ledger Data',
      description: 'Network Stats streams ledger data in real-time. Watch fee stats, close times, and transaction volume.',
      relevance: 0.9,
      type: 'tip',
      category: 'network',
    },
    {
      id: 'ns-2',
      title: 'Fee Intelligence',
      description: 'The fee stats table shows accepted network fees. Use this data to set competitive fees for your transactions.',
      relevance: 0.95,
      type: 'action',
      action: 'Check the fee table for recommended fee levels',
      category: 'network',
    },
  ],
  builder: [
    {
      id: 'bl-1',
      title: 'Transaction Building Basics',
      description: 'Set source account, memo, base fee, and time bounds. The builder supports payment and createAccount operations.',
      relevance: 0.9,
      type: 'tip',
      category: 'builder',
    },
    {
      id: 'bl-2',
      title: 'Time Bounds',
      description: 'Set min/max time bounds in Unix timestamps. Use https://timestamp.online/ to convert dates.',
      relevance: 0.7,
      type: 'tip',
      category: 'builder',
    },
  ],
  faucet: [
    {
      id: 'fa-1',
      title: 'Testnet Funding',
      description: 'Friendbot sends 10,000 XLM to any Testnet account. Limit one request per account per hour.',
      relevance: 0.95,
      type: 'tip',
      category: 'faucet',
    },
    {
      id: 'fa-2',
      title: 'Mainnet Warning',
      description: 'Faucet is disabled on Mainnet. Use the Dashboard to track real XLM balances.',
      relevance: 0.9,
      type: 'warning',
      category: 'faucet',
    },
  ],
  compare: [
    {
      id: 'cp-1',
      title: 'Account Comparison',
      description: 'Compare up to 5 accounts side-by-side. Sort by balance, asset count, or open orders.',
      relevance: 0.9,
      type: 'tip',
      category: 'comparison',
    },
    {
      id: 'cp-2',
      title: 'CSV Export',
      description: 'Use the Export CSV button to download comparison data for offline analysis.',
      relevance: 0.7,
      type: 'action',
      action: 'Click Export CSV to download comparison data',
      category: 'comparison',
    },
  ],
  wallet: [
    {
      id: 'wa-1',
      title: 'Freighter Wallet',
      description: 'Install the Freighter browser extension from https://freighter.app. Unlock it and approve the connection.',
      relevance: 0.95,
      type: 'doc',
      url: 'https://freighter.app',
      category: 'wallet',
    },
    {
      id: 'wa-2',
      title: 'Ledger Hardware Wallet',
      description: 'Connect your Ledger via USB. Requires WebUSB/WebHID support. Install the Stellar app on your Ledger device.',
      relevance: 0.85,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/tools/ledger-wallet',
      category: 'wallet',
    },
  ],
  dex: [
    {
      id: 'dx-1',
      title: 'SDEX Order Books',
      description: 'View aggregated bids and asks for any asset pair. The spread shows the gap between best bid and ask.',
      relevance: 0.95,
      type: 'tip',
      category: 'dex',
    },
    {
      id: 'dx-2',
      title: 'Recent Trades',
      description: 'Recent trades show executed orders with price, amount, and timestamp. Use this to gauge market activity.',
      relevance: 0.8,
      type: 'tip',
      category: 'dex',
    },
  ],
  txBuilder: [
    {
      id: 'tb-1',
      title: 'Advanced Transaction Building',
      description: 'Full operation factory supporting payments, trustlines, offers, fee bumps, and sponsorship operations.',
      relevance: 0.95,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/learn/encyclopedia/transactions/operations',
      category: 'builder',
    },
    {
      id: 'tb-2',
      title: 'Fee Bump Transactions',
      description: 'Fee bump transactions allow one account to pay the fee for another. Useful for operational accounts.',
      relevance: 0.8,
      type: 'tip',
      category: 'builder',
    },
  ],
  signer: [
    {
      id: 'sg-1',
      title: 'Signing XDR',
      description: 'Paste an unsigned transaction XDR and sign it with your connected wallet. The signed XDR can be submitted.',
      relevance: 0.9,
      type: 'tip',
      category: 'wallet',
    },
  ],
  portfolio: [
    {
      id: 'po-1',
      title: 'Portfolio Valuation',
      description: 'USD prices are fetched from CoinGecko. 24h change indicators show price movement.',
      relevance: 0.9,
      type: 'tip',
      category: 'portfolio',
    },
  ],
};

const NETWORK_HELP: Record<string, HelpSuggestion[]> = {
  testnet: [
    {
      id: 'nt-1',
      title: 'Testnet Best Practices',
      description: 'Testnet resets periodically. Do not rely on persistent account state. Use the Faucet to fund accounts freely.',
      relevance: 0.95,
      type: 'tip',
      category: 'network',
    },
    {
      id: 'nt-2',
      title: 'Soroban on Testnet',
      description: 'Contracts must be deployed separately on Testnet. Use the Contract Interaction panel to deploy and invoke.',
      relevance: 0.85,
      type: 'doc',
      url: 'https://developers.stellar.org/docs/soroban/contracts',
      category: 'contracts',
    },
  ],
  mainnet: [
    {
      id: 'nm-1',
      title: 'Mainnet Safety',
      description: 'All operations on Mainnet involve real XLM. Always simulate transactions first and verify all parameters.',
      relevance: 1.0,
      type: 'warning',
      category: 'security',
    },
    {
      id: 'nm-2',
      title: 'Production Tips',
      description: 'Use a dedicated Horizon endpoint for production workloads. Consider running your own node for reliability.',
      relevance: 0.8,
      type: 'tip',
      category: 'network',
    },
  ],
  futurenet: [
    {
      id: 'nf-1',
      title: 'Futurenet Preview',
      description: 'Futurenet is a preview of upcoming protocol changes. Expect instability and periodic resets.',
      relevance: 0.9,
      type: 'warning',
      category: 'network',
    },
  ],
};

const GENERAL_TIPS: HelpSuggestion[] = [
  {
    id: 'gt-1',
    title: 'Keyboard Navigation',
    description: 'Use Tab to navigate between elements, Enter to activate, and Escape to close panels. Screen reader announcements are supported.',
    relevance: 0.85,
    type: 'tip',
    category: 'accessibility',
  },
  {
    id: 'gt-2',
    title: 'Alert Rules',
    description: 'Set up custom alert rules to monitor account activity, balance changes, and specific operation types.',
    relevance: 0.8,
    type: 'action',
    action: 'Configure alert rules in the alert settings panel',
    category: 'alerts',
  },
  {
    id: 'gt-3',
    title: 'Theme Customization',
    description: 'Toggle between light and dark themes using the theme button in the top bar.',
    relevance: 0.6,
    type: 'action',
    action: 'Click the theme toggle button to switch themes',
    category: 'preferences',
  },
  {
    id: 'gt-4',
    title: 'Offline Support',
    description: 'The app queues operations when offline and replays them when connectivity returns.',
    relevance: 0.7,
    type: 'tip',
    category: 'network',
  },
  {
    id: 'gt-5',
    title: 'Search Tips',
    description: 'Use the global search bar to find accounts, transactions, and operations across the current network.',
    relevance: 0.75,
    type: 'action',
    action: 'Press Ctrl+K to focus the search bar',
    category: 'search',
  },
  {
    id: 'gt-6',
    title: 'Network Switcher',
    description: 'Switch between Testnet and Mainnet using the network indicator in the sidebar.',
    relevance: 0.7,
    type: 'tip',
    category: 'network',
  },
];

export function getContextualHelp(
  activeTab: string,
  network: string,
  errorCategory?: string,
): HelpSuggestion[] {
  const suggestions: HelpSuggestion[] = [];
  const seen = new Set<string>();

  const addUnique = (items: HelpSuggestion[]) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        suggestions.push(item);
      }
    }
  };

  if (errorCategory) {
    suggestions.push({
      id: 'err-help',
      title: `Debugging ${errorCategory} Errors`,
      description: errorCategory === 'network'
        ? 'Network errors often resolve with retry and backoff. Check the Network Stats panel for network conditions.'
        : errorCategory === 'stellar'
        ? 'Stellar errors typically indicate operation-level failures. Review transaction result codes for details.'
        : `Review the error details above and try the suggested solutions. Use the help links for more information.`,
      relevance: 1.0,
      type: 'tip',
      category: errorCategory,
    });
  }

  if (TAB_SPECIFIC_HELP[activeTab]) {
    addUnique(TAB_SPECIFIC_HELP[activeTab]);
  }

  if (NETWORK_HELP[network]) {
    addUnique(NETWORK_HELP[network]);
  }

  const generalScore = errorCategory ? 0.5 : 0.7;
  const generalWithScore = GENERAL_TIPS.map((t) => ({
    ...t,
    relevance: t.relevance * generalScore,
  }));
  addUnique(generalWithScore);

  if (suggestions.length > 0) {
    suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  return suggestions.slice(0, 8);
}

export function getTabSpecificHelp(tab: string): HelpSuggestion[] {
  return TAB_SPECIFIC_HELP[tab] || [];
}

export function getSearchHelp(query: string): HelpSuggestion[] {
  const q = query.toLowerCase();
  const results: HelpSuggestion[] = [];

  const allHelp = [
    ...GENERAL_TIPS,
    ...Object.values(TAB_SPECIFIC_HELP).flat(),
    ...Object.values(NETWORK_HELP).flat(),
  ];

  for (const item of allHelp) {
    if (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    ) {
      results.push(item);
    }
  }

  return results.slice(0, 5);
}
