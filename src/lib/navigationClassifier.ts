/**
 * Navigation Intent Classifier — Conversational Dashboard Navigation (#555)
 *
 * Classifies natural language navigation commands into dashboard tabs
 * with confidence scoring. Handles 30+ navigation commands with
 * synonym expansion, fuzzy matching, and entity extraction.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavIntentType =
  | 'overview'
  | 'account'
  | 'transactions'
  | 'contracts'
  | 'network'
  | 'builder'
  | 'faucet'
  | 'compare'
  | 'wallet'
  | 'signer'
  | 'portfolio'
  | 'txBuilder'
  | 'contractInteraction'
  | 'contractABI'
  | 'dex'
  | 'pathExplorer'
  | 'explorers'
  | 'realtime'
  | 'charts'
  | 'assets'
  | 'anchors'
  | 'search'
  | 'liveActivity'
  | 'cacheStats'
  | 'multisig'
  | 'analytics'
  | 'systemHealth'
  | 'performance'
  | 'logAnalyzer'
  | 'settings'
  | 'audit'
  | 'security'
  | 'governance'
  | 'collaboration'
  | 'monitoringDashboards'
  | 'dataExport'
  | 'claimableBalances'
  | 'designSystem'
  | 'featureFlags'
  | 'help'
  | 'connect'
  | 'unknown';

export interface NavigationIntent {
  type: NavIntentType;
  confidence: number;
  originalQuery: string;
  normalizedQuery: string;
  entities: NavEntities;
  isAmbiguous: boolean;
  alternatives: Array<{ type: NavIntentType; confidence: number; label: string }>;
}

export interface NavEntities {
  targetAccount?: string;
  amounts?: number[];
  assetCodes?: string[];
  timeframes?: string[];
}

export interface NavCommand {
  id: NavIntentType;
  label: string;
  aliases: string[];
  category: string;
  description: string;
  icon: string;
  keywords: string[];
}

// ─── Commands Registry (30+ commands) ────────────────────────────────────────

export const NAV_COMMANDS: NavCommand[] = [
  // ANALYTICS
  {
    id: 'overview', label: 'Overview', category: 'Analytics',
    description: 'View dashboard overview with balance and recent activity',
    icon: '◈', aliases: ['home', 'dashboard', 'main', 'start', 'landing'],
    keywords: ['overview', 'home', 'dashboard', 'main', 'landing', 'summary', 'start', 'welcome', 'goto overview']
  },
  {
    id: 'account', label: 'Account', category: 'Analytics',
    description: 'View account details and balances',
    icon: '◉', aliases: ['my account', 'profile', 'address'],
    keywords: ['account', 'profile', 'my account', 'address details', 'account info', 'show account']
  },
  {
    id: 'transactions', label: 'Transactions', category: 'Analytics',
    description: 'View transaction history',
    icon: '⇄', aliases: ['txns', 'tx', 'history', 'payment history'],
    keywords: ['transaction', 'txns', 'tx', 'history', 'payments', 'activity', 'operations', 'sent', 'received', 'transfers']
  },
  {
    id: 'contracts', label: 'Contracts', category: 'Analytics',
    description: 'View smart contracts',
    icon: '◻', aliases: ['smart contracts', 'soroban contracts'],
    keywords: ['contracts', 'smart contract', 'soroban', 'wasm', 'contract']
  },
  {
    id: 'compare', label: 'Compare', category: 'Analytics',
    description: 'Compare multiple accounts side-by-side',
    icon: '◫', aliases: ['comparison', 'side by side', 'compare accounts'],
    keywords: ['compare', 'comparison', 'side by side', 'account compare', 'vs']
  },
  {
    id: 'claimableBalances', label: 'Claimable', category: 'Analytics',
    description: 'View claimable balances',
    icon: '⊛', aliases: ['claimable', 'claims', 'claimables'],
    keywords: ['claimable', 'claims', 'claim', 'claimable balances']
  },
  {
    id: 'assets', label: 'Assets', category: 'Analytics',
    description: 'View and discover assets on the network',
    icon: '💎', aliases: ['tokens', 'all assets', 'token list'],
    keywords: ['assets', 'tokens', 'token list', 'all assets', 'asset discovery', 'assets view']
  },
  {
    id: 'anchors', label: 'Anchors', category: 'Analytics',
    description: 'View Stellar anchors',
    icon: '⚓', aliases: ['anchor', 'trusted anchors'],
    keywords: ['anchors', 'anchor', 'trusted entities']
  },
  {
    id: 'search', label: 'Search', category: 'Analytics',
    description: 'Advanced search across accounts, transactions, and more',
    icon: '🔍', aliases: ['find', 'lookup', 'query', 'advanced search'],
    keywords: ['search', 'find', 'lookup', 'query', 'advanced search', 'search for']
  },

  // NETWORK
  {
    id: 'network', label: 'Network Info', category: 'Network',
    description: 'View network statistics and status',
    icon: '◎', aliases: ['net stats', 'network stats', 'network status'],
    keywords: ['network', 'network stats', 'network info', 'net stats', 'network status', 'stellar network']
  },
  {
    id: 'realtime', label: 'Real-Time', category: 'Network',
    description: 'View real-time ledger updates',
    icon: '◉', aliases: ['live', 'live ledger', 'ledger stream'],
    keywords: ['realtime', 'real-time', 'live', 'live ledger', 'ledger stream', 'live feed']
  },
  {
    id: 'liveActivity', label: 'Live Activity', category: 'Network',
    description: 'View live network activity feed',
    icon: '⚡', aliases: ['activity feed', 'live feed', 'network activity'],
    keywords: ['live activity', 'activity feed', 'network activity', 'live feed']
  },
  {
    id: 'cacheStats', label: 'Cache Stats', category: 'Network',
    description: 'View cache performance statistics',
    icon: '⊞', aliases: ['cache', 'caching', 'cache status'],
    keywords: ['cache', 'cache stats', 'caching', 'cache status', 'cache statistics']
  },
  {
    id: 'performance', label: 'Performance', category: 'Network',
    description: 'View performance monitoring dashboards',
    icon: 'P', aliases: ['perf', 'perf monitor', 'performance monitor'],
    keywords: ['performance', 'perf', 'perf monitor', 'performance metrics', 'speed']
  },

  // BUILD
  {
    id: 'builder', label: 'Builder', category: 'Build',
    description: 'Build and construct transactions',
    icon: '⚒', aliases: ['tx builder', 'transaction builder', 'construct'],
    keywords: ['builder', 'tx builder', 'transaction builder', 'construct', 'build']
  },
  {
    id: 'faucet', label: 'Faucet', category: 'Build',
    description: 'Get testnet XLM for development',
    icon: '⬡', aliases: ['testnet faucet', 'get xlm', 'fund'],
    keywords: ['faucet', 'get xlm', 'testnet funds', 'fund account', 'free xlm', 'testnet xlm']
  },

  // EXPLORE
  {
    id: 'dex', label: 'DEX', category: 'Explore',
    description: 'Explore the Stellar decentralized exchange',
    icon: '⇌', aliases: ['dex explorer', 'orderbook', 'order book'],
    keywords: ['dex', 'dex explorer', 'orderbook', 'order book', 'trades', 'exchange']
  },
  {
    id: 'pathExplorer', label: 'Path Explorer', category: 'Explore',
    description: 'Explore payment paths between assets',
    icon: '⇢', aliases: ['paths', 'path', 'payment paths'],
    keywords: ['path', 'paths', 'path explorer', 'payment paths', 'find path']
  },
  {
    id: 'explorers', label: 'Explorer Links', category: 'Explore',
    description: 'Access external Stellar network explorers',
    icon: '⊞', aliases: ['external', 'stellar explorers', 'block explorers'],
    keywords: ['explorers', 'external', 'stellar expert', 'block explorer', 'explorer links']
  },
  {
    id: 'charts', label: 'Charts', category: 'Explore',
    description: 'View charts and analytics visualizations',
    icon: '▤', aliases: ['chart', 'graphs', 'visualizations', 'analytics charts'],
    keywords: ['charts', 'chart', 'graphs', 'visualizations', 'analytics charts', 'metrics']
  },

  // PAYMENTS
  {
    id: 'wallet', label: 'Wallet', category: 'Payments',
    description: 'Connect and manage wallets',
    icon: '⊡', aliases: ['wallet connect', 'connect wallet', 'freighter'],
    keywords: ['wallet', 'wallet connect', 'connect wallet', 'freighter', 'albedo', 'wallet connection']
  },
  {
    id: 'signer', label: 'Signer', category: 'Payments',
    description: 'Sign transactions manually',
    icon: '✎', aliases: ['tx signer', 'transaction signer', 'sign'],
    keywords: ['signer', 'tx signer', 'transaction signer', 'sign transaction', 'sign xdr']
  },
  {
    id: 'multisig', label: 'Multisig', category: 'Payments',
    description: 'Manage multi-signature accounts',
    icon: '⊕', aliases: ['multi sig', 'multi signature', 'msig'],
    keywords: ['multisig', 'multi sig', 'multi signature', 'msig', 'multi-signature']
  },

  // TOOLS
  {
    id: 'portfolio', label: 'Portfolio', category: 'Tools',
    description: 'View portfolio value and allocation',
    icon: '◐', aliases: ['my portfolio', 'holdings', 'investment'],
    keywords: ['portfolio', 'holdings', 'my portfolio', 'investment', 'portfolio value', 'allocation']
  },
  {
    id: 'analytics', label: 'Analytics', category: 'Tools',
    description: 'View data analytics and insights',
    icon: '◍', aliases: ['data analytics', 'insights', 'statistics'],
    keywords: ['analytics', 'data analytics', 'insights', 'statistics', 'data insights']
  },
  {
    id: 'logAnalyzer', label: 'Log Analyzer', category: 'Tools',
    description: 'Analyze logs and error patterns',
    icon: '📋', aliases: ['logs', 'log analysis', 'log viewer'],
    keywords: ['logs', 'log analyzer', 'log analysis', 'log viewer', 'log']
  },
  {
    id: 'settings', label: 'Settings', category: 'Tools',
    description: 'Configure dashboard settings and preferences',
    icon: '⚙', aliases: ['preferences', 'config', 'configuration', 'options'],
    keywords: ['settings', 'preferences', 'config', 'configuration', 'options', 'setup']
  },
  {
    id: 'audit', label: 'Audit', category: 'Tools',
    description: 'View audit trail and logs',
    icon: '⊟', aliases: ['audit log', 'audit trail', 'activity log'],
    keywords: ['audit', 'audit log', 'audit trail', 'activity log', 'history log']
  },
  {
    id: 'security', label: 'Security', category: 'Tools',
    description: 'View security dashboard and alerts',
    icon: '🛡️', aliases: ['security dashboard', 'security alerts', 'secure'],
    keywords: ['security', 'security dashboard', 'security alerts', 'secure', 'security center']
  },
  {
    id: 'systemHealth', label: 'Health', category: 'Tools',
    description: 'View system health status',
    icon: '⚕', aliases: ['health', 'system status', 'status'],
    keywords: ['health', 'system health', 'system status', 'status', 'health check']
  },
  {
    id: 'governance', label: 'Governance', category: 'Tools',
    description: 'View governance proposals and voting',
    icon: '🗳', aliases: ['voting', 'proposals', 'governance votes'],
    keywords: ['governance', 'voting', 'proposals', 'governance votes', 'dao']
  },
  {
    id: 'collaboration', label: 'Collaboration', category: 'Tools',
    description: 'Collaborate with team members in real-time',
    icon: '◌', aliases: ['team', 'share', 'collab'],
    keywords: ['collaboration', 'team', 'share', 'collab', 'presence', 'annotations']
  },
  {
    id: 'monitoringDashboards', label: 'Monitoring', category: 'Tools',
    description: 'View monitoring dashboards',
    icon: '📊', aliases: ['monitor', 'dashboards', 'monitoring'],
    keywords: ['monitoring', 'monitor', 'dashboards', 'monitoring dashboards', 'custom dashboards']
  },
  {
    id: 'dataExport', label: 'Export', category: 'Tools',
    description: 'Export dashboard data',
    icon: '⬇', aliases: ['export data', 'download', 'backup'],
    keywords: ['export', 'export data', 'download', 'backup', 'data export']
  },
  {
    id: 'designSystem', label: 'Design System', category: 'Tools',
    description: 'View the design system components',
    icon: '◈', aliases: ['components', 'ui', 'design'],
    keywords: ['design system', 'components', 'ui library', 'design']
  },
  {
    id: 'featureFlags', label: 'Flags', category: 'Tools',
    description: 'Manage feature flags and toggles',
    icon: '🚩', aliases: ['feature toggles', 'flags', 'features'],
    keywords: ['flags', 'feature flags', 'feature toggles', 'feature management']
  },

  // SYSTEM
  {
    id: 'connect', label: 'Connect', category: 'System',
    description: 'Connect to a Stellar account',
    icon: '🔗', aliases: ['login', 'sign in', 'connect account'],
    keywords: ['connect', 'login', 'sign in', 'connect account', 'connect wallet']
  },
  {
    id: 'help', label: 'Help', category: 'System',
    description: 'Show available navigation commands',
    icon: '❓', aliases: ['commands', 'guide', 'help me', 'what can I say'],
    keywords: ['help', 'commands', 'guide', 'what can I do', 'help me', 'navigation help', 'available commands']
  },
];

// ─── Category aliases for broad commands ──────────────────────────────────────

const CATEGORY_ALIASES: Record<string, NavIntentType[]> = {
  'analytics': ['overview', 'account', 'transactions', 'contracts', 'compare'],
  'network': ['network', 'realtime', 'liveActivity', 'cacheStats', 'performance'],
  'build': ['builder', 'faucet'],
  'explore': ['dex', 'pathExplorer', 'explorers', 'charts'],
  'payments': ['wallet', 'signer', 'multisig'],
  'tools': ['portfolio', 'analytics', 'logAnalyzer', 'settings', 'audit', 'security', 'systemHealth', 'governance', 'collaboration', 'monitoringDashboards', 'dataExport', 'designSystem', 'featureFlags'],
  'system': ['connect', 'help'],
};

// ─── Normalize text ───────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Intent Classification ───────────────────────────────────────────────────

/**
 * Classify a natural language navigation command into a dashboard intent.
 * Returns the matched intent with confidence score.
 */
export function classifyNavigationIntent(query: string): NavigationIntent {
  const normalized = normalize(query);
  const words = normalized.split(' ').filter(Boolean);

  // Check for exact phrase match first
  const matches: Array<{
    type: NavIntentType;
    confidence: number;
    matchedKeyword: string;
  }> = [];

  for (const cmd of NAV_COMMANDS) {
    // Check all aliases as full phrase matches
    const allPhrases = [...cmd.aliases, ...cmd.keywords];
    for (const phrase of allPhrases) {
      const normalizedPhrase = normalize(phrase);

      // Exact match of the phrase within the query
      if (normalized.includes(normalizedPhrase)) {
        const lengthBonus = Math.min(normalizedPhrase.length / normalized.length, 1) * 0.15;
        const baseScore = normalizedPhrase === normalized ? 0.95 : 0.85;
        matches.push({
          type: cmd.id,
          confidence: Math.min(baseScore + lengthBonus, 0.99),
          matchedKeyword: phrase,
        });
        break; // One match per command (highest)
      }

      // Fuzzy match for each word in multi-word queries
      const phraseWords = normalizedPhrase.split(' ').filter(Boolean);
      const matchedWords = phraseWords.filter(pw =>
        words.some(w => w === pw || w.startsWith(pw) || pw.startsWith(w))
      );
      if (matchedWords.length > 0 && phraseWords.length > 0) {
        const ratio = matchedWords.length / phraseWords.length;
        if (ratio >= 0.6) {
          matches.push({
            type: cmd.id,
            confidence: 0.5 + ratio * 0.35,
            matchedKeyword: phrase,
          });
        }
      }
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);

  // Check for category-level matches
  let categoryMatch: NavIntentType[] | null = null;
  for (const [category, intents] of Object.entries(CATEGORY_ALIASES)) {
    const normalizedCategory = normalize(category);
    if (normalized.includes(normalizedCategory) || normalizedCategory.includes(normalized)) {
      categoryMatch = intents;
      break;
    }
  }

  // Take top match(s)
  const top = matches.slice(0, 3);
  const best = top[0];

  if (!best) {
    return {
      type: 'unknown',
      confidence: 0,
      originalQuery: query,
      normalizedQuery: normalized,
      entities: {},
      isAmbiguous: false,
      alternatives: [],
    };
  }

  // Build alternatives
  const alternatives = matches.slice(0, 4).map(m => ({
    type: m.type as NavIntentType,
    confidence: m.confidence,
    label: NAV_COMMANDS.find(c => c.id === m.type)?.label || m.type,
  }));

  const isAmbiguous = best.confidence < 0.75 && alternatives.length > 1;

  return {
    type: best.type as NavIntentType,
    confidence: best.confidence,
    originalQuery: query,
    normalizedQuery: normalized,
    entities: extractNavEntities(query),
    isAmbiguous,
    alternatives: isAmbiguous ? alternatives : [],
  };
}

// ─── Entity Extraction ────────────────────────────────────────────────────────

function extractNavEntities(query: string): NavEntities {
  const entities: NavEntities = {};

  // Extract Stellar addresses
  const addressMatch = query.match(/[A-Z0-9]{56}/);
  if (addressMatch) {
    entities.targetAccount = addressMatch[0];
  }

  // Extract amounts
  const amounts = query.match(/\d+(\.\d+)?/g);
  if (amounts) {
    entities.amounts = amounts.map(Number);
  }

  // Extract asset codes (3-12 uppercase letters)
  const assets = query.match(/\b[A-Z]{3,12}\b/g);
  if (assets) {
    entities.assetCodes = assets;
  }

  // Extract timeframes
  const timeframePatterns = [
    /\b(today|yesterday)\b/i,
    /\b(last|past|this)\s+(day|week|month|year|hour)\b/i,
    /\b(\d+)\s*(hours?|days?|weeks?|months?)\s+(ago|back)\b/i,
  ];
  const timeframes: string[] = [];
  for (const pattern of timeframePatterns) {
    const match = query.match(pattern);
    if (match) {
      timeframes.push(match[0].toLowerCase());
    }
  }
  if (timeframes.length > 0) {
    entities.timeframes = timeframes;
  }

  return entities;
}

// ─── Command Help Text ────────────────────────────────────────────────────────

export function getCommandHelpText(): string {
  const categories = new Map<string, NavCommand[]>();
  for (const cmd of NAV_COMMANDS) {
    if (!categories.has(cmd.category)) {
      categories.set(cmd.category, []);
    }
    categories.get(cmd.category)!.push(cmd);
  }

  let text = 'I can navigate you to any section of the dashboard. Try saying:\n\n';
  for (const [category, cmds] of categories) {
    text += `📁 **${category}**\n`;
    for (const cmd of cmds) {
      text += `  • *"${cmd.aliases[0] || cmd.keywords[0]}"* — ${cmd.description}\n`;
    }
    text += '\n';
  }
  text += 'Or just type "take me to [section name]" or "show me [section name]".';
  return text;
}

/**
 * Get suggestion chips for the navigation panel
 */
export function getQuickNavSuggestions(): NavCommand[] {
  return [
    NAV_COMMANDS.find(c => c.id === 'overview')!,
    NAV_COMMANDS.find(c => c.id === 'account')!,
    NAV_COMMANDS.find(c => c.id === 'transactions')!,
    NAV_COMMANDS.find(c => c.id === 'network')!,
    NAV_COMMANDS.find(c => c.id === 'portfolio')!,
    NAV_COMMANDS.find(c => c.id === 'contracts')!,
    NAV_COMMANDS.find(c => c.id === 'charts')!,
    NAV_COMMANDS.find(c => c.id === 'settings')!,
  ];
}

/**
 * Get all commands grouped by category
 */
export function getCommandsByCategory(): Map<string, NavCommand[]> {
  const groups = new Map<string, NavCommand[]>();
  for (const cmd of NAV_COMMANDS) {
    if (!groups.has(cmd.category)) {
      groups.set(cmd.category, []);
    }
    groups.get(cmd.category)!.push(cmd);
  }
  return groups;
}
