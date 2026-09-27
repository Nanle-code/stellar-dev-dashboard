/**
 * Anonymized Sample Datasets for Sandbox Analytics Demos (#908)
 *
 * Provides production-like, anonymized Stellar Horizon account and DEX trade datasets
 * designed for educational demos, offline simulation, and sandbox analytics dashboards
 * without requiring Mainnet credentials, live keys, or active network connectivity.
 */

export type AccountArchetype =
  | 'retail_active'
  | 'institutional_market_maker'
  | 'soroban_dapp_treasury'
  | 'new_onboarded_sandbox';

export type TradeType = 'orderbook' | 'liquidity_pool';

export interface SandboxBalance {
  asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities?: string;
  selling_liabilities?: string;
  last_modified_ledger?: number;
}

export interface SandboxSigner {
  key: string;
  weight: number;
  type: string;
}

export interface SandboxThresholds {
  low_threshold: number;
  med_threshold: number;
  high_threshold: number;
}

export interface SandboxFlags {
  auth_required: boolean;
  auth_revocable: boolean;
  auth_immutable: boolean;
  auth_clawback_enabled?: boolean;
}

export interface SandboxAccount {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  archetype: AccountArchetype;
  displayName: string;
  description: string;
  balances: SandboxBalance[];
  signers: SandboxSigner[];
  thresholds: SandboxThresholds;
  flags: SandboxFlags;
  tags: string[];
}

export interface SandboxTradePrice {
  n: number;
  d: number;
}

export interface SandboxTrade {
  id: string;
  paging_token: string;
  ledger_close_time: string;
  trade_type: TradeType;
  base_account: string;
  counter_account: string;
  base_asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  base_asset_code?: string;
  base_asset_issuer?: string;
  counter_asset_type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  counter_asset_code?: string;
  counter_asset_issuer?: string;
  base_amount: string;
  counter_amount: string;
  price: SandboxTradePrice;
  price_r: string; // decimal string representation
  base_is_seller: boolean;
}

// ── Known Anonymized Public Keys ─────────────────────────────────────────────

export const ANONYMIZED_ADDRESSES = {
  RETAIL_TRADER: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVTAX',
  MARKET_MAKER: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  DAPP_TREASURY: 'GCKFJ324LSTXZM5QHQZ4N3FOD4M25732G23N2UXA77YJ6YNYA6PVDEMO',
  NEW_USER: 'GD3Y6K2RVDW7L2B6M3JNZD57W4G4X3RKYE6LODV2X5Z8N3O9V7JONBRD',
  SIGNER_SECONDARY: 'GCV6L2N3W5QDF742T5V4748N7Y2JDU9A4D3G8X1V4J7Z2Q0M9K3LSIGN',
  SIGNER_TERTIARY: 'GB248M3K5L9P7Q1R3T5V7W9X2Z4B6D8F0H2J4L6N8P0R2T4V6X8Z0TERT',
  USDC_ISSUER: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  AQUA_ISSUER: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFQDUGXA5AA7WWINNPDAA57AQUA',
  EURT_ISSUER: 'GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIY6IGK6URNUMEURT',
  BTC_ISSUER: 'GATEMHCCKCY67ZUCKTROYN24ZYT5GK4EQZ65JJLDHKHRUZI3EUEWBTC0',
} as const;

// ── Anonymized Account Datasets ──────────────────────────────────────────────

export const SAMPLE_SANDBOX_ACCOUNTS: SandboxAccount[] = [
  {
    id: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    account_id: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    sequence: '348291049281044',
    subentry_count: 3,
    archetype: 'retail_active',
    displayName: 'Active Retail Trader Demo',
    description:
      'A realistic retail active trader portfolio with diversified crypto and stable asset holdings.',
    balances: [
      {
        asset_type: 'native',
        balance: '4820.5000000',
        buying_liabilities: '120.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53120042,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
        balance: '1250.7500000',
        limit: '100000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '50.0000000',
        last_modified_ledger: 53120040,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'AQUA',
        asset_issuer: ANONYMIZED_ADDRESSES.AQUA_ISSUER,
        balance: '18500.0000000',
        limit: '500000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53119850,
      },
    ],
    signers: [
      {
        key: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
        weight: 1,
        type: 'ed25519_public_key',
      },
    ],
    thresholds: {
      low_threshold: 0,
      med_threshold: 1,
      high_threshold: 1,
    },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: false,
      auth_clawback_enabled: false,
    },
    tags: ['retail', 'dex_trader', 'diversified'],
  },
  {
    id: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    account_id: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    sequence: '782910492810992',
    subentry_count: 5,
    archetype: 'institutional_market_maker',
    displayName: 'Institutional Market Maker Demo',
    description:
      'High-balance automated liquidity provider with multi-asset trustlines and 2-of-3 multisig policy.',
    balances: [
      {
        asset_type: 'native',
        balance: '450000.0000000',
        buying_liabilities: '35000.0000000',
        selling_liabilities: '42000.0000000',
        last_modified_ledger: 53120090,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
        balance: '65200.0000000',
        limit: '5000000.0000000',
        buying_liabilities: '12000.0000000',
        selling_liabilities: '8500.0000000',
        last_modified_ledger: 53120088,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'EURT',
        asset_issuer: ANONYMIZED_ADDRESSES.EURT_ISSUER,
        balance: '38400.0000000',
        limit: '2000000.0000000',
        buying_liabilities: '5000.0000000',
        selling_liabilities: '3200.0000000',
        last_modified_ledger: 53120070,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'BTC',
        asset_issuer: ANONYMIZED_ADDRESSES.BTC_ISSUER,
        balance: '4.2500000',
        limit: '100.0000000',
        buying_liabilities: '0.5000000',
        selling_liabilities: '0.2500000',
        last_modified_ledger: 53120065,
      },
    ],
    signers: [
      {
        key: ANONYMIZED_ADDRESSES.MARKET_MAKER,
        weight: 1,
        type: 'ed25519_public_key',
      },
      {
        key: ANONYMIZED_ADDRESSES.SIGNER_SECONDARY,
        weight: 1,
        type: 'ed25519_public_key',
      },
      {
        key: ANONYMIZED_ADDRESSES.SIGNER_TERTIARY,
        weight: 1,
        type: 'ed25519_public_key',
      },
    ],
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 2,
    },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: true,
      auth_clawback_enabled: false,
    },
    tags: ['institutional', 'multisig', 'market_maker', 'high_volume'],
  },
  {
    id: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    account_id: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    sequence: '192049281048201',
    subentry_count: 4,
    archetype: 'soroban_dapp_treasury',
    displayName: 'Soroban Protocol Treasury Demo',
    description:
      'Decentralized application treasury holding smart contract fees and liquidity reserves.',
    balances: [
      {
        asset_type: 'native',
        balance: '75000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53119500,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'USDC',
        asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
        balance: '142500.0000000',
        limit: '10000000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53119480,
      },
      {
        asset_type: 'credit_alphanum4',
        asset_code: 'AQUA',
        asset_issuer: ANONYMIZED_ADDRESSES.AQUA_ISSUER,
        balance: '950000.0000000',
        limit: '20000000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53119450,
      },
    ],
    signers: [
      {
        key: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
        weight: 2,
        type: 'ed25519_public_key',
      },
      {
        key: ANONYMIZED_ADDRESSES.SIGNER_SECONDARY,
        weight: 1,
        type: 'ed25519_public_key',
      },
    ],
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 3,
    },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: false,
      auth_clawback_enabled: false,
    },
    tags: ['soroban', 'smart_contract', 'treasury', 'dao'],
  },
  {
    id: ANONYMIZED_ADDRESSES.NEW_USER,
    account_id: ANONYMIZED_ADDRESSES.NEW_USER,
    sequence: '582049281048100',
    subentry_count: 0,
    archetype: 'new_onboarded_sandbox',
    displayName: 'New Sandbox Onboarding Account',
    description:
      'Clean onboarding sandbox profile funded via testnet Friendbot with initial base reserves.',
    balances: [
      {
        asset_type: 'native',
        balance: '10000.0000000',
        buying_liabilities: '0.0000000',
        selling_liabilities: '0.0000000',
        last_modified_ledger: 53120100,
      },
    ],
    signers: [
      {
        key: ANONYMIZED_ADDRESSES.NEW_USER,
        weight: 1,
        type: 'ed25519_public_key',
      },
    ],
    thresholds: {
      low_threshold: 0,
      med_threshold: 0,
      high_threshold: 0,
    },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: false,
      auth_clawback_enabled: false,
    },
    tags: ['onboarding', 'beginner', 'friendbot', 'clean_slate'],
  },
];

// ── Anonymized Trade Datasets (Chronological Time Series) ─────────────────────

export const SAMPLE_SANDBOX_TRADES: SandboxTrade[] = [
  // ── XLM / USDC Orderbook trades (Trending market) ──
  {
    id: 'trade_sbx_001',
    paging_token: '1001-01',
    ledger_close_time: '2026-09-25T08:00:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '1000.0000000',
    counter_amount: '124.5000000',
    price: { n: 1245, d: 10000 },
    price_r: '0.1245000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_002',
    paging_token: '1001-02',
    ledger_close_time: '2026-09-25T08:15:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    counter_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '2500.0000000',
    counter_amount: '312.7500000',
    price: { n: 1251, d: 10000 },
    price_r: '0.1251000',
    base_is_seller: false,
  },
  {
    id: 'trade_sbx_003',
    paging_token: '1001-03',
    ledger_close_time: '2026-09-25T08:30:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '1800.0000000',
    counter_amount: '226.4400000',
    price: { n: 1258, d: 10000 },
    price_r: '0.1258000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_004',
    paging_token: '1001-04',
    ledger_close_time: '2026-09-25T08:45:00Z',
    trade_type: 'liquidity_pool',
    base_account: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '5000.0000000',
    counter_amount: '631.5000000',
    price: { n: 1263, d: 10000 },
    price_r: '0.1263000',
    base_is_seller: false,
  },
  {
    id: 'trade_sbx_005',
    paging_token: '1001-05',
    ledger_close_time: '2026-09-25T09:00:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '3200.0000000',
    counter_amount: '406.4000000',
    price: { n: 1270, d: 10000 },
    price_r: '0.1270000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_006',
    paging_token: '1001-06',
    ledger_close_time: '2026-09-25T09:15:00Z',
    trade_type: 'liquidity_pool',
    base_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    counter_account: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '7500.0000000',
    counter_amount: '948.7500000',
    price: { n: 1265, d: 10000 },
    price_r: '0.1265000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_007',
    paging_token: '1001-07',
    ledger_close_time: '2026-09-25T09:30:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'native',
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '4000.0000000',
    counter_amount: '512.0000000',
    price: { n: 1280, d: 10000 },
    price_r: '0.1280000',
    base_is_seller: false,
  },

  // ── AQUA / XLM Trades ──
  {
    id: 'trade_sbx_008',
    paging_token: '1002-01',
    ledger_close_time: '2026-09-25T08:10:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'credit_alphanum4',
    base_asset_code: 'AQUA',
    base_asset_issuer: ANONYMIZED_ADDRESSES.AQUA_ISSUER,
    counter_asset_type: 'native',
    base_amount: '10000.0000000',
    counter_amount: '54.0000000',
    price: { n: 54, d: 10000 },
    price_r: '0.0054000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_009',
    paging_token: '1002-02',
    ledger_close_time: '2026-09-25T08:40:00Z',
    trade_type: 'liquidity_pool',
    base_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    counter_account: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    base_asset_type: 'credit_alphanum4',
    base_asset_code: 'AQUA',
    base_asset_issuer: ANONYMIZED_ADDRESSES.AQUA_ISSUER,
    counter_asset_type: 'native',
    base_amount: '25000.0000000',
    counter_amount: '137.5000000',
    price: { n: 55, d: 10000 },
    price_r: '0.0055000',
    base_is_seller: false,
  },
  {
    id: 'trade_sbx_010',
    paging_token: '1002-03',
    ledger_close_time: '2026-09-25T09:20:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.RETAIL_TRADER,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'credit_alphanum4',
    base_asset_code: 'AQUA',
    base_asset_issuer: ANONYMIZED_ADDRESSES.AQUA_ISSUER,
    counter_asset_type: 'native',
    base_amount: '15000.0000000',
    counter_amount: '84.0000000',
    price: { n: 56, d: 10000 },
    price_r: '0.0056000',
    base_is_seller: true,
  },

  // ── BTC / USDC Trades ──
  {
    id: 'trade_sbx_011',
    paging_token: '1003-01',
    ledger_close_time: '2026-09-25T08:05:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    counter_account: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    base_asset_type: 'credit_alphanum4',
    base_asset_code: 'BTC',
    base_asset_issuer: ANONYMIZED_ADDRESSES.BTC_ISSUER,
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '0.2500000',
    counter_amount: '16250.0000000',
    price: { n: 65000, d: 1 },
    price_r: '65000.0000000',
    base_is_seller: true,
  },
  {
    id: 'trade_sbx_012',
    paging_token: '1003-02',
    ledger_close_time: '2026-09-25T09:10:00Z',
    trade_type: 'orderbook',
    base_account: ANONYMIZED_ADDRESSES.DAPP_TREASURY,
    counter_account: ANONYMIZED_ADDRESSES.MARKET_MAKER,
    base_asset_type: 'credit_alphanum4',
    base_asset_code: 'BTC',
    base_asset_issuer: ANONYMIZED_ADDRESSES.BTC_ISSUER,
    counter_asset_type: 'credit_alphanum4',
    counter_asset_code: 'USDC',
    counter_asset_issuer: ANONYMIZED_ADDRESSES.USDC_ISSUER,
    base_amount: '0.4000000',
    counter_amount: '26160.0000000',
    price: { n: 65400, d: 1 },
    price_r: '65400.0000000',
    base_is_seller: false,
  },
];
