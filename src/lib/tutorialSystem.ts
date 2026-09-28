/**
 * Tutorial System — manages guided tours, step state, contextual help, and video walkthroughs
 * Enhanced with progress tracking, interactive elements, and multimedia support
 */

// ─── Tour definitions ─────────────────────────────────────────────────────────

export const TOURS = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to Stellar Dashboard',
    description: 'A quick tour of the main features',
    category: 'Getting Started',
    estimatedTime: '3 min',
    difficulty: 'beginner',
    videoUrl: 'https://player.vimeo.com/video/placeholder-welcome',
    thumbnail: '🚀',
    prerequisites: [],
    steps: [
      {
        id: 'connect',
        target: '[data-tour="connect-panel"]',
        title: 'Connect Your Wallet',
        content: 'Start by entering a Stellar public key or connecting Freighter wallet to explore account data.',
        placement: 'right',
        action: 'Try clicking the Connect button to see it in action!',
        interactiveHint: 'You can use the Testnet to experiment safely.',
      },
      {
        id: 'network',
        target: '[data-tour="network-selector"]',
        title: 'Switch Networks',
        content: 'Toggle between Testnet and Mainnet. Use Testnet for development — it\'s free and safe.',
        placement: 'bottom',
        action: 'Click the network selector and choose Testnet',
        interactiveHint: 'Testnet is perfect for learning without spending real XLM!',
      },
      {
        id: 'sidebar',
        target: '[data-tour="sidebar"]',
        title: 'Navigation',
        content: 'Access all dashboard sections here: account details, transactions, contracts, DEX, and more.',
        placement: 'right',
        action: 'Explore the different sections available',
        interactiveHint: 'Each section is designed for specific Stellar operations.',
      },
      {
        id: 'overview',
        target: '[data-tour="overview-tab"]',
        title: 'Account Overview',
        content: 'See your balances, recent activity, and portfolio value at a glance.',
        placement: 'bottom',
        action: 'Check out the overview to see account information',
        interactiveHint: 'This is your dashboard home - bookmark it!',
      },
    ],
  },

  transactions: {
    id: 'transactions',
    title: 'Building & Signing Transactions',
    description: 'Learn to build and sign transactions on Stellar',
    category: 'Core Features',
    estimatedTime: '5 min',
    difficulty: 'intermediate',
    videoUrl: 'https://player.vimeo.com/video/placeholder-transactions',
    thumbnail: '💸',
    prerequisites: ['welcome'],
    steps: [
      {
        id: 'tx-builder',
        target: '[data-tour="tx-builder"]',
        title: 'Build Transactions',
        content: 'Construct any Stellar operation — payments, trustlines, offers — with a visual builder.',
        placement: 'top',
        action: 'Try building a simple payment transaction',
        interactiveHint: 'Start with payment operations - they\'re the most common!',
      },
      {
        id: 'tx-signer',
        target: '[data-tour="tx-signer"]',
        title: 'Sign & Submit',
        content: 'Sign transactions with your secret key or hardware wallet, then submit to the network.',
        placement: 'top',
        action: 'Connect your wallet to enable signing',
        interactiveHint: 'Always use Testnet for practice!',
      },
      {
        id: 'tx-simulator',
        target: '[data-tour="tx-simulator"]',
        title: 'Simulate First',
        content: 'Always simulate before submitting — catch errors and preview fees without spending XLM.',
        placement: 'top',
        action: 'Click simulate to test your transaction',
        interactiveHint: 'Simulation is free and helps prevent costly mistakes!',
      },
    ],
  },

  contracts: {
    id: 'contracts',
    title: 'Soroban Smart Contracts',
    description: 'Interact with Soroban smart contracts',
    category: 'Advanced',
    estimatedTime: '7 min',
    difficulty: 'advanced',
    videoUrl: 'https://player.vimeo.com/video/placeholder-contracts',
    thumbnail: '📜',
    prerequisites: ['welcome', 'transactions'],
    steps: [
      {
        id: 'contract-id',
        target: '[data-tour="contract-input"]',
        title: 'Enter Contract ID',
        content: 'Paste a Soroban contract address to inspect its ABI and invoke functions.',
        placement: 'bottom',
        action: 'Enter a contract address starting with C...',
        interactiveHint: 'Contract addresses always start with C on Stellar',
      },
      {
        id: 'contract-abi',
        target: '[data-tour="contract-abi"]',
        title: 'Browse the ABI',
        content: 'View all contract functions, their parameters, and return types.',
        placement: 'right',
        action: 'Explore the available contract functions',
        interactiveHint: 'The ABI shows all available methods you can call',
      },
      {
        id: 'contract-invoke',
        target: '[data-tour="contract-invoke"]',
        title: 'Invoke Functions',
        content: 'Call contract functions directly from the dashboard with automatic XDR encoding.',
        placement: 'top',
        action: 'Try invoking a read-only function first',
        interactiveHint: 'Read-only functions don\'t cost XLM!',
      },
    ],
  },

  dex: {
    id: 'dex',
    title: 'Decentralized Exchange (DEX)',
    description: 'Trade assets on Stellar\'s built-in DEX',
    category: 'Trading',
    estimatedTime: '6 min',
    difficulty: 'intermediate',
    videoUrl: 'https://player.vimeo.com/video/placeholder-dex',
    thumbnail: '📊',
    prerequisites: ['welcome'],
    steps: [
      {
        id: 'dex-overview',
        target: '[data-tour="dex-explorer"]',
        title: 'DEX Explorer',
        content: 'View order books, spreads, and recent trades for any asset pair on the Stellar DEX.',
        placement: 'top',
        action: 'Select an asset pair to view the order book',
        interactiveHint: 'The DEX is built into Stellar - no third parties needed!',
      },
      {
        id: 'order-book',
        target: '[data-tour="order-book"]',
        title: 'Order Book',
        content: 'See all bids and asks with real-time depth visualization.',
        placement: 'right',
        action: 'Explore the order book depth chart',
        interactiveHint: 'Green bars are bids, red bars are asks',
      },
      {
        id: 'path-payments',
        target: '[data-tour="path-explorer"]',
        title: 'Path Payments',
        content: 'Find the best exchange rates using Stellar\'s pathfinding algorithm.',
        placement: 'bottom',
        action: 'Try finding paths between two assets',
        interactiveHint: 'Stellar finds the best rate automatically!',
      },
    ],
  },

  portfolio: {
    id: 'portfolio',
    title: 'Portfolio Analytics',
    description: 'Track your portfolio value and performance',
    category: 'Analytics',
    estimatedTime: '4 min',
    difficulty: 'beginner',
    videoUrl: 'https://player.vimeo.com/video/placeholder-portfolio',
    thumbnail: '💰',
    prerequisites: ['welcome'],
    steps: [
      {
        id: 'portfolio-value',
        target: '[data-tour="portfolio-value"]',
        title: 'Portfolio Overview',
        content: 'View your total portfolio value in USD with 24h change tracking.',
        placement: 'top',
        action: 'Connect an account to see portfolio value',
        interactiveHint: 'Prices are fetched from CoinGecko in real-time',
      },
      {
        id: 'asset-breakdown',
        target: '[data-tour="asset-breakdown"]',
        title: 'Asset Breakdown',
        content: 'See per-asset values and allocations with price charts.',
        placement: 'bottom',
        action: 'Click on any asset for detailed information',
        interactiveHint: 'Hover over assets to see more details',
      },
      {
        id: 'comparison',
        target: '[data-tour="account-comparison"]',
        title: 'Compare Accounts',
        content: 'Compare up to 5 accounts side-by-side to analyze portfolios.',
        placement: 'right',
        action: 'Add accounts to compare their holdings',
        interactiveHint: 'Great for managing multiple accounts!',
      },
    ],
  },

  alerts: {
    id: 'alerts',
    title: 'Setting Up Alerts',
    description: 'Configure notifications for account activity',
    category: 'Monitoring',
    estimatedTime: '5 min',
    difficulty: 'intermediate',
    videoUrl: 'https://player.vimeo.com/video/placeholder-alerts',
    thumbnail: '🔔',
    prerequisites: ['welcome'],
    steps: [
      {
        id: 'alert-rules',
        target: '[data-tour="alert-rules"]',
        title: 'Alert Rules',
        content: 'Create custom rules to monitor balance changes, transactions, and specific operations.',
        placement: 'top',
        action: 'Click "Create Rule" to start',
        interactiveHint: 'You can create multiple rules per account',
      },
      {
        id: 'rule-config',
        target: '[data-tour="rule-config"]',
        title: 'Configure Rules',
        content: 'Set thresholds, operation types, and monitoring frequency.',
        placement: 'right',
        action: 'Try setting a balance threshold alert',
        interactiveHint: 'Rules are evaluated in real-time!',
      },
      {
        id: 'notifications',
        target: '[data-tour="notification-center"]',
        title: 'Notification Center',
        content: 'View all triggered alerts and manage notification preferences.',
        placement: 'bottom',
        action: 'Enable browser notifications for real-time alerts',
        interactiveHint: 'Notifications persist across browser sessions',
      },
    ],
  },

  wallet: {
    id: 'wallet',
    title: 'Wallet Integration',
    description: 'Connect hardware wallets and Freighter',
    category: 'Security',
    estimatedTime: '4 min',
    difficulty: 'beginner',
    videoUrl: 'https://player.vimeo.com/video/placeholder-wallet',
    thumbnail: '🔐',
    prerequisites: [],
    steps: [
      {
        id: 'wallet-connect',
        target: '[data-tour="wallet-connect"]',
        title: 'Connect Wallet',
        content: 'Link your Freighter extension or Ledger hardware wallet for secure signing.',
        placement: 'right',
        action: 'Click Connect and choose your wallet type',
        interactiveHint: 'Hardware wallets offer the best security!',
      },
      {
        id: 'wallet-freighter',
        target: '[data-tour="freighter-option"]',
        title: 'Freighter Wallet',
        content: 'The official Stellar browser extension wallet - easy and secure.',
        placement: 'bottom',
        action: 'Install Freighter from the Chrome Web Store',
        interactiveHint: 'Freighter is recommended for most users',
      },
      {
        id: 'wallet-ledger',
        target: '[data-tour="ledger-option"]',
        title: 'Ledger Hardware Wallet',
        content: 'Use your Ledger device for maximum security with cold storage.',
        placement: 'top',
        action: 'Connect your Ledger and open the Stellar app',
        interactiveHint: 'Best for large amounts or long-term storage',
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
  'horizon': {
    title: 'Horizon API',
    content: 'Horizon is the REST API for interacting with the Stellar network. It provides endpoints for accounts, transactions, and operations.',
    learnMore: 'https://developers.stellar.org/docs/data/horizon',
  },
  'sdex': {
    title: 'Stellar DEX',
    content: 'The Stellar Decentralized Exchange (SDEX) is built into the protocol, allowing trustless peer-to-peer trading.',
    learnMore: 'https://developers.stellar.org/docs/learn/encyclopedia/sdex',
  },
  'claimable-balance': {
    title: 'Claimable Balance',
    content: 'A claimable balance allows you to send assets to an account that doesn\'t exist yet or doesn\'t have a trustline.',
    learnMore: 'https://developers.stellar.org/docs/learn/encyclopedia/claimable-balances',
  },
};

// ─── Achievement and Progress Tracking ────────────────────────────────────────

export const ACHIEVEMENTS = {
  'first-tour': {
    id: 'first-tour',
    title: 'Getting Started',
    description: 'Completed your first tutorial',
    icon: '🎉',
  },
  'tour-master': {
    id: 'tour-master',
    title: 'Tour Master',
    description: 'Completed all tutorials',
    icon: '🏆',
  },
  'transaction-builder': {
    id: 'transaction-builder',
    title: 'Transaction Builder',
    description: 'Learned to build transactions',
    icon: '⚡',
  },
  'contract-expert': {
    id: 'contract-expert',
    title: 'Contract Expert',
    description: 'Mastered Soroban contracts',
    icon: '🎓',
  },
  'dex-trader': {
    id: 'dex-trader',
    title: 'DEX Trader',
    description: 'Explored the Stellar DEX',
    icon: '📈',
  },
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'tutorial_state';
const PROGRESS_KEY = 'tutorial_progress';
const ACHIEVEMENTS_KEY = 'tutorial_achievements';
const ANALYTICS_KEY = 'tutorial_analytics';
const ONBOARDING_KEY = 'tutorial_onboarding';

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

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

function loadAchievements() {
  try {
    return JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAchievements(achievements) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
  } catch { /* ignore */ }
}

function loadAnalytics() {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAnalytics(analytics) {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
  } catch { /* ignore */ }
}

function loadOnboarding() {
  try {
    return JSON.parse(localStorage.getItem(ONBOARDING_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveOnboarding(onboarding) {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboarding));
  } catch { /* ignore */ }
}

const ONBOARDING_MILESTONES = [
  {
    id: 'welcome-tour',
    title: 'Complete the welcome tour',
    description: 'Learn the dashboard layout and core account workflow.',
    tourId: 'welcome',
  },
  {
    id: 'wallet-ready',
    title: 'Review wallet options',
    description: 'Compare Freighter and hardware wallet connection paths.',
    tourId: 'wallet',
  },
  {
    id: 'transaction-basics',
    title: 'Practice transaction building',
    description: 'Walk through building, simulating, and signing safely.',
    tourId: 'transactions',
  },
  {
    id: 'monitoring-ready',
    title: 'Set up monitoring basics',
    description: 'Explore alerts and notifications for account activity.',
    tourId: 'alerts',
  },
];

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
    
    // Update progress
    this.updateProgress(tourId, 100);
    this.trackEvent('tour_completed', { tourId });
    
    // Check for achievements
    this.checkAchievements();
  },

  /** Reset a tour so it can be replayed */
  reset(tourId) {
    const state = loadState();
    delete state[`completed_${tourId}`];
    delete state[`skipped_${tourId}`];
    saveState(state);
    
    // Reset progress
    const progress = loadProgress();
    delete progress[tourId];
    saveProgress(progress);
  },

  /** Reset all tours */
  resetAll() {
    saveState({});
    saveProgress({});
    saveOnboarding({});
    saveAnalytics({});
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
    this.trackEvent('tour_step_viewed', { tourId, stepIndex });
    
    // Update progress percentage
    const tour = this.getTour(tourId);
    if (tour) {
      const progress = Math.round((stepIndex / tour.steps.length) * 100);
      this.updateProgress(tourId, progress);
    }
  },

  /** Update tour progress */
  updateProgress(tourId, percentage) {
    const progress = loadProgress();
    progress[tourId] = {
      percentage,
      lastUpdated: Date.now(),
    };
    saveProgress(progress);
  },

  /** Get progress for a tour */
  getProgress(tourId) {
    return loadProgress()[tourId] || { percentage: 0, lastUpdated: null };
  },

  /** Get overall progress across all tours */
  getOverallProgress() {
    const tours = this.getTours();
    const completed = tours.filter(t => this.isCompleted(t.id)).length;
    return {
      completed,
      total: tours.length,
      percentage: Math.round((completed / tours.length) * 100),
    };
  },

  /** Get all available tours */
  getTours() {
    return Object.values(TOURS);
  },

  /** Get tours by category */
  getToursByCategory(category) {
    return this.getTours().filter(t => t.category === category);
  },

  /** Get all categories */
  getCategories() {
    const categories = new Set(this.getTours().map(t => t.category));
    return Array.from(categories);
  },

  /** Get a specific tour */
  getTour(tourId) {
    return TOURS[tourId] ?? null;
  },

  /** Get contextual help for a topic */
  getHelp(topic) {
    return HELP_ENTRIES[topic] ?? null;
  },

  /** Get all help entries */
  getAllHelp() {
    return Object.values(HELP_ENTRIES);
  },

  /** Search help entries and tour content */
  searchHelp(query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];

    const helpResults = Object.entries(HELP_ENTRIES)
      .filter(([, entry]) => {
        return `${entry.title} ${entry.content}`.toLowerCase().includes(normalized);
      })
      .map(([id, entry]) => ({
        id,
        type: 'help',
        title: entry.title,
        description: entry.content,
        learnMore: entry.learnMore,
      }));

    const tourResults = this.getTours()
      .filter((tour) => {
        const searchable = [
          tour.title,
          tour.description,
          tour.category,
          ...tour.steps.flatMap((step) => [step.title, step.content, step.action, step.interactiveHint]),
        ].join(' ');
        return searchable.toLowerCase().includes(normalized);
      })
      .map((tour) => ({
        id: tour.id,
        type: 'tour',
        title: tour.title,
        description: tour.description,
        tourId: tour.id,
      }));

    return [...helpResults, ...tourResults];
  },

  /** Record a user-submitted help search */
  recordHelpSearch(query, resultCount = 0) {
    const normalized = String(query || '').trim().toLowerCase();
    if (normalized) {
      this.trackEvent('help_searched', { query: normalized, resultCount });
    }
  },

  /** Check if this is a first-time user (no tours completed) */
  isFirstVisit() {
    const state = loadState();
    const onboarding = loadOnboarding();
    return !onboarding.dismissedWelcome && !Object.keys(state).some(k => k.startsWith('completed_') || k.startsWith('skipped_'));
  },

  /** Mark a tour as skipped so onboarding can report drop-off points */
  skip(tourId, stepIndex = 0) {
    const state = loadState();
    state[`skipped_${tourId}`] = { stepIndex, at: Date.now() };
    state[`step_${tourId}`] = 0;
    saveState(state);
    this.trackEvent('tour_skipped', { tourId, stepIndex });
  },

  /** Dismiss the first-run welcome prompt without completing a tour */
  dismissWelcome() {
    const onboarding = loadOnboarding();
    onboarding.dismissedWelcome = Date.now();
    saveOnboarding(onboarding);
    this.trackEvent('onboarding_dismissed');
  },

  /** Get progressive onboarding milestones */
  getOnboardingMilestones() {
    return ONBOARDING_MILESTONES.map((milestone) => ({
      ...milestone,
      completed: this.isCompleted(milestone.tourId),
      progress: this.getProgress(milestone.tourId),
    }));
  },

  /** Completion status for the advanced onboarding flow */
  getOnboardingStatus() {
    const milestones = this.getOnboardingMilestones();
    const completed = milestones.filter((milestone) => milestone.completed).length;
    return {
      milestones,
      completed,
      total: milestones.length,
      percentage: milestones.length ? Math.round((completed / milestones.length) * 100) : 0,
      next: milestones.find((milestone) => !milestone.completed) || null,
    };
  },

  /** Check and award achievements */
  checkAchievements() {
    const achievements = loadAchievements();
    const completedTours = this.getTours().filter(t => this.isCompleted(t.id));
    
    // First tour achievement
    if (completedTours.length === 1 && !achievements.includes('first-tour')) {
      achievements.push('first-tour');
    }
    
    // All tours completed
    if (completedTours.length === this.getTours().length && !achievements.includes('tour-master')) {
      achievements.push('tour-master');
    }
    
    // Specific tour achievements
    if (this.isCompleted('transactions') && !achievements.includes('transaction-builder')) {
      achievements.push('transaction-builder');
    }
    
    if (this.isCompleted('contracts') && !achievements.includes('contract-expert')) {
      achievements.push('contract-expert');
    }
    
    if (this.isCompleted('dex') && !achievements.includes('dex-trader')) {
      achievements.push('dex-trader');
    }
    
    saveAchievements(achievements);
    return achievements;
  },

  /** Get all earned achievements */
  getAchievements() {
    const earned = loadAchievements();
    return earned.map(id => ACHIEVEMENTS[id]).filter(Boolean);
  },

  /** Get recommended next tour based on prerequisites and progress */
  getRecommendedTour() {
    const tours = this.getTours();
    const completed = tours.filter(t => this.isCompleted(t.id)).map(t => t.id);
    
    // Find tours where all prerequisites are met but tour is not completed
    const available = tours.filter(tour => {
      if (this.isCompleted(tour.id)) return false;
      if (!tour.prerequisites || tour.prerequisites.length === 0) return true;
      return tour.prerequisites.every(prereq => completed.includes(prereq));
    });
    
    // Return first available tour, prioritizing beginner difficulty
    return available.sort((a, b) => {
      const difficultyOrder = { beginner: 1, intermediate: 2, advanced: 3 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    })[0] || null;
  },

  /** Track time spent on tutorials */
  startTimer(tourId) {
    const state = loadState();
    state[`timer_${tourId}`] = Date.now();
    saveState(state);
    this.trackEvent('tour_started', { tourId });
  },

  stopTimer(tourId) {
    const state = loadState();
    const startTime = state[`timer_${tourId}`];
    if (startTime) {
      const duration = Date.now() - startTime;
      state[`duration_${tourId}`] = (state[`duration_${tourId}`] || 0) + duration;
      delete state[`timer_${tourId}`];
      saveState(state);
      this.trackEvent('tour_engaged', { tourId, duration });
    }
  },

  getDuration(tourId) {
    return loadState()[`duration_${tourId}`] || 0;
  },

  /** Capture local product analytics for onboarding and tutorial engagement */
  trackEvent(eventName, metadata = {}) {
    const analytics = loadAnalytics();
    const events = analytics.events || [];
    events.push({
      eventName,
      metadata,
      timestamp: Date.now(),
    });

    analytics.events = events.slice(-250);
    analytics.updatedAt = Date.now();
    saveAnalytics(analytics);
  },

  /** Summarize onboarding completion, drop-off points, and engagement */
  getAnalyticsSummary() {
    const analytics = loadAnalytics();
    const events = analytics.events || [];
    const starts = events.filter((event) => event.eventName === 'tour_started');
    const completions = events.filter((event) => event.eventName === 'tour_completed');
    const skips = events.filter((event) => event.eventName === 'tour_skipped');
    const engagements = events.filter((event) => event.eventName === 'tour_engaged');
    const totalDuration = engagements.reduce((sum, event) => sum + (event.metadata?.duration || 0), 0);
    const dropOffPoints = skips.reduce((acc, event) => {
      const key = `${event.metadata?.tourId || 'unknown'}:${event.metadata?.stepIndex || 0}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      onboarding: this.getOnboardingStatus(),
      starts: starts.length,
      completions: completions.length,
      skips: skips.length,
      completionRate: starts.length ? Math.round((completions.length / starts.length) * 100) : 0,
      averageEngagementMs: engagements.length ? Math.round(totalDuration / engagements.length) : 0,
      dropOffPoints,
      helpSearches: events.filter((event) => event.eventName === 'help_searched').length,
    };
  },
};

export default tutorialSystem;
