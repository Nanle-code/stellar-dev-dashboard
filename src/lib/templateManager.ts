/**
 * templateManager.ts — Issue #148, extended for Issue #563
 * Manages Soroban smart contract templates: listing, loading, deploying.
 *
 * Issue #563 additions:
 *   - `tags` and `useCases` on ContractTemplate, powering requirement-based
 *     recommendations (see templateRecommendation.ts).
 *   - Expanded template set. A curated group of fully-specified patterns plus
 *     clearly-marked work-in-progress stubs (`status: 'wip'`) that carry real
 *     tags/useCases for discovery but still need constructor/method detail.
 */

export interface TemplateConstructorParam {
  name: string
  type: 'address' | 'string' | 'u32' | 'u64' | 'bool'
  description: string
  required?: boolean
}

export interface ContractTemplate {
  id: string
  name: string
  description: string
  category: 'token' | 'escrow' | 'governance' | 'nft' | 'utility'
  constructor: TemplateConstructorParam[]
  methods: string[]
  readme?: string
  /** Simulated WASM size in bytes */
  wasmSize?: number
  /** Issue #563: keywords for requirement matching. */
  tags?: string[]
  /** Issue #563: short phrases describing what this template is for. */
  useCases?: string[]
  /** Issue #563: 'ready' = fully specified; 'wip' = discovery-ready stub. */
  status?: 'ready' | 'wip'
}

// ─── Template registry ────────────────────────────────────────────────────────

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'token',
    name: 'Fungible Token',
    description: 'Standard Soroban token contract with mint, transfer, and allowance.',
    category: 'token',
    constructor: [
      { name: 'admin', type: 'address', description: 'Token administrator address', required: true },
      { name: 'name', type: 'string', description: 'Token name', required: true },
      { name: 'symbol', type: 'string', description: 'Token symbol (e.g. USDC)', required: true },
      { name: 'decimals', type: 'u32', description: 'Decimal places (default 7)', required: false },
    ],
    methods: ['initialize', 'mint', 'transfer', 'transfer_from', 'balance', 'allowance', 'approve', 'burn'],
    wasmSize: 48_000,
    tags: ['token', 'fungible', 'erc20', 'mint', 'transfer', 'allowance', 'currency', 'stablecoin'],
    useCases: ['Issue a fungible token', 'Create a stablecoin', 'Launch a utility token'],
    status: 'ready',
  },
  {
    id: 'escrow',
    name: 'Escrow Contract',
    description: 'Time-locked escrow with arbiter approval and dispute resolution.',
    category: 'escrow',
    constructor: [
      { name: 'depositor', type: 'address', description: 'Account depositing funds', required: true },
      { name: 'recipient', type: 'address', description: 'Account receiving funds on release', required: true },
      { name: 'arbiter', type: 'address', description: 'Neutral arbiter for disputes', required: true },
      { name: 'unlock_time', type: 'u64', description: 'Unix timestamp when funds unlock', required: true },
    ],
    methods: ['deposit', 'release', 'dispute', 'resolve', 'refund', 'get_balance', 'get_status'],
    wasmSize: 36_000,
    tags: ['escrow', 'timelock', 'arbiter', 'dispute', 'deposit', 'release', 'conditional', 'payment', 'buyer', 'delivery', 'hold', 'funds'],
    useCases: ['Hold funds until a condition is met', 'Time-locked payment', 'Dispute-protected sale'],
    status: 'ready',
  },
  {
    id: 'governance',
    name: 'Governance Contract',
    description: 'On-chain voting and proposal system with configurable quorum.',
    category: 'governance',
    constructor: [
      { name: 'admin', type: 'address', description: 'Governance administrator', required: true },
      { name: 'token', type: 'address', description: 'Voting token contract address', required: true },
      { name: 'quorum_bps', type: 'u32', description: 'Quorum in basis points (e.g. 1000 = 10%)', required: true },
      { name: 'voting_period', type: 'u64', description: 'Voting period in seconds', required: true },
    ],
    methods: ['create_proposal', 'vote', 'execute', 'cancel', 'get_proposal', 'get_vote', 'quorum_reached'],
    wasmSize: 52_000,
    tags: ['governance', 'voting', 'proposal', 'quorum', 'dao', 'ballot', 'onchain'],
    useCases: ['Run a DAO', 'On-chain proposal voting', 'Community treasury decisions'],
    status: 'ready',
  },
  {
    id: 'nft',
    name: 'NFT Contract',
    description: 'Non-fungible token contract with metadata and royalty support.',
    category: 'nft',
    constructor: [
      { name: 'admin', type: 'address', description: 'Collection administrator', required: true },
      { name: 'name', type: 'string', description: 'Collection name', required: true },
      { name: 'symbol', type: 'string', description: 'Collection symbol', required: true },
      { name: 'royalty_bps', type: 'u32', description: 'Royalty in basis points (0-1000)', required: false },
    ],
    methods: ['mint', 'transfer', 'burn', 'approve', 'get_owner', 'get_metadata', 'total_supply'],
    wasmSize: 44_000,
    tags: ['nft', 'collectible', 'metadata', 'royalty', 'mint', 'nonfungible', 'art', 'collection'],
    useCases: ['Mint an NFT collection', 'Digital collectibles with royalties', 'Membership passes'],
    status: 'ready',
  },
  {
    id: 'vesting',
    name: 'Token Vesting',
    description: 'Linear or cliff vesting schedule that releases tokens over time.',
    category: 'utility',
    constructor: [
      { name: 'admin', type: 'address', description: 'Vesting administrator', required: true },
      { name: 'beneficiary', type: 'address', description: 'Account receiving vested tokens', required: true },
      { name: 'token', type: 'address', description: 'Token being vested', required: true },
      { name: 'start_time', type: 'u64', description: 'Vesting start timestamp', required: true },
      { name: 'duration', type: 'u64', description: 'Total vesting duration in seconds', required: true },
    ],
    methods: ['initialize', 'release', 'releasable', 'revoke', 'get_schedule'],
    wasmSize: 34_000,
    tags: ['vesting', 'timelock', 'cliff', 'linear', 'release', 'token', 'schedule', 'payroll'],
    useCases: ['Vest team tokens', 'Investor cliff schedule', 'Gradual token release'],
    status: 'ready',
  },
  {
    id: 'multisig-wallet',
    name: 'Multisig Wallet',
    description: 'Shared wallet requiring M-of-N signer approvals to execute actions.',
    category: 'utility',
    constructor: [
      { name: 'admin', type: 'address', description: 'Initial administrator', required: true },
      { name: 'threshold', type: 'u32', description: 'Number of approvals required', required: true },
    ],
    methods: ['add_signer', 'remove_signer', 'submit', 'approve', 'execute', 'get_signers', 'get_threshold'],
    wasmSize: 40_000,
    tags: ['multisig', 'wallet', 'approval', 'threshold', 'signers', 'shared', 'security', 'treasury'],
    useCases: ['Shared team treasury', 'M-of-N approval wallet', 'Secure fund custody'],
    status: 'ready',
  },
  {
    id: 'crowdfund',
    name: 'Crowdfunding Campaign',
    description: 'Goal-based fundraising with refunds if the target is not met.',
    category: 'escrow',
    constructor: [
      { name: 'beneficiary', type: 'address', description: 'Recipient of funds if goal met', required: true },
      { name: 'token', type: 'address', description: 'Token accepted for pledges', required: true },
      { name: 'goal', type: 'u64', description: 'Funding goal amount', required: true },
      { name: 'deadline', type: 'u64', description: 'Campaign end timestamp', required: true },
    ],
    methods: ['pledge', 'claim', 'refund', 'total_pledged', 'get_status'],
    wasmSize: 38_000,
    tags: ['crowdfunding', 'fundraising', 'pledge', 'refund', 'goal', 'campaign', 'kickstarter'],
    useCases: ['Run a crowdfunding campaign', 'All-or-nothing fundraiser', 'Community funding round'],
    status: 'ready',
  },
  {
    id: 'airdrop',
    name: 'Token Airdrop',
    description: 'Distribute tokens to many recipients, optionally via a claim list.',
    category: 'token',
    constructor: [
      { name: 'admin', type: 'address', description: 'Airdrop administrator', required: true },
      { name: 'token', type: 'address', description: 'Token to distribute', required: true },
    ],
    methods: ['fund', 'set_allocation', 'claim', 'sweep', 'get_allocation'],
    wasmSize: 32_000,
    tags: ['airdrop', 'distribution', 'claim', 'allocation', 'reward', 'token', 'giveaway'],
    useCases: ['Airdrop tokens to users', 'Claimable reward distribution', 'Community token drop'],
    status: 'ready',
  },
  {
    id: 'staking',
    name: 'Staking Pool',
    description: 'Stake tokens to earn rewards accrued over time.',
    category: 'token',
    constructor: [
      { name: 'admin', type: 'address', description: 'Pool administrator', required: true },
      { name: 'stake_token', type: 'address', description: 'Token users stake', required: true },
      { name: 'reward_token', type: 'address', description: 'Token paid as reward', required: true },
      { name: 'reward_rate', type: 'u64', description: 'Reward emitted per second', required: true },
    ],
    methods: ['stake', 'unstake', 'claim_reward', 'earned', 'total_staked'],
    wasmSize: 46_000,
    tags: ['staking', 'rewards', 'yield', 'pool', 'stake', 'earn', 'defi', 'farming'],
    useCases: ['Reward token stakers', 'Yield farming pool', 'Incentivize holding'],
    status: 'ready',
  },
  {
    id: 'subscription',
    name: 'Subscription Payments',
    description: 'Recurring on-chain payments with pause and cancel support.',
    category: 'utility',
    constructor: [
      { name: 'merchant', type: 'address', description: 'Account receiving payments', required: true },
      { name: 'token', type: 'address', description: 'Payment token', required: true },
      { name: 'amount', type: 'u64', description: 'Amount charged per period', required: true },
      { name: 'period', type: 'u64', description: 'Billing period in seconds', required: true },
    ],
    methods: ['subscribe', 'charge', 'pause', 'resume', 'cancel', 'get_subscription'],
    wasmSize: 42_000,
    tags: ['subscription', 'recurring', 'billing', 'payment', 'merchant', 'saas', 'membership'],
    useCases: ['Recurring subscription billing', 'Membership dues', 'SaaS on-chain payments'],
    status: 'ready',
  },
  {
    id: 'timelock',
    name: 'Timelock Controller',
    description: 'Queue actions that can only execute after a mandatory delay.',
    category: 'governance',
    constructor: [
      { name: 'admin', type: 'address', description: 'Timelock administrator', required: true },
      { name: 'min_delay', type: 'u64', description: 'Minimum delay before execution (seconds)', required: true },
    ],
    methods: ['queue', 'execute', 'cancel', 'get_operation', 'is_ready'],
    wasmSize: 36_000,
    tags: ['timelock', 'delay', 'queue', 'governance', 'security', 'schedule', 'controller'],
    useCases: ['Delay sensitive admin actions', 'Governance execution buffer', 'Safety delay on upgrades'],
    status: 'ready',
  },
  {
    id: 'soulbound',
    name: 'Soulbound Token',
    description: 'Non-transferable token for credentials, badges, or reputation.',
    category: 'nft',
    constructor: [
      { name: 'admin', type: 'address', description: 'Issuer address', required: true },
      { name: 'name', type: 'string', description: 'Credential name', required: true },
    ],
    methods: ['issue', 'revoke', 'has_token', 'get_metadata'],
    wasmSize: 30_000,
    tags: ['soulbound', 'credential', 'badge', 'reputation', 'nontransferable', 'identity', 'certificate'],
    useCases: ['Issue non-transferable badges', 'On-chain credentials', 'Reputation tokens'],
    status: 'ready',
  },
]

// ─── Work-in-progress stubs (Issue #563) ──────────────────────────────────────
// These are discovery-ready: real names, tags, and use-cases so the recommender
// can surface them, but constructor/method detail is still to be written.
// Marked status: 'wip' and excluded from deployment until completed.

const WIP_STUBS: ContractTemplate[] = [
  ['payment-splitter', 'Payment Splitter', 'utility', ['split', 'payment', 'shares', 'revenue', 'payout'], 'Split incoming funds among recipients'],
  ['dutch-auction', 'Dutch Auction', 'utility', ['auction', 'dutch', 'price', 'descending', 'sale', 'sell', 'item', 'falling'], 'Sell an item with a falling price'],
  ['english-auction', 'English Auction', 'utility', ['auction', 'english', 'bid', 'ascending', 'sale'], 'Highest-bid auction'],
  ['lottery', 'Lottery', 'utility', ['lottery', 'raffle', 'random', 'draw', 'prize'], 'Random prize draw among entrants'],
  ['faucet', 'Testnet Faucet', 'utility', ['faucet', 'testnet', 'drip', 'claim', 'free'], 'Dispense small test amounts'],
  ['whitelist-sale', 'Whitelist Sale', 'token', ['whitelist', 'sale', 'presale', 'allowlist', 'ico'], 'Token sale limited to approved buyers'],
  ['bonding-curve', 'Bonding Curve Token', 'token', ['bonding', 'curve', 'price', 'mint', 'amm'], 'Token priced by a bonding curve'],
  ['wrapped-asset', 'Wrapped Asset', 'token', ['wrapped', 'bridge', 'peg', 'deposit', 'redeem'], 'Wrap an external asset 1:1'],
  ['dao-treasury', 'DAO Treasury', 'governance', ['treasury', 'dao', 'funds', 'spend', 'budget'], 'Governed treasury with spend controls'],
  ['delegated-voting', 'Delegated Voting', 'governance', ['delegate', 'voting', 'proxy', 'governance', 'liquid'], 'Delegate voting power to others'],
  ['nft-marketplace', 'NFT Marketplace', 'nft', ['marketplace', 'listing', 'sale', 'nft', 'trade'], 'List and sell NFTs'],
  ['nft-staking', 'NFT Staking', 'nft', ['nft', 'staking', 'rewards', 'lock', 'earn'], 'Stake NFTs to earn rewards'],
  ['revenue-share', 'Revenue Share', 'utility', ['revenue', 'share', 'dividend', 'distribute', 'holders'], 'Distribute revenue to token holders'],
  ['milestone-escrow', 'Milestone Escrow', 'escrow', ['milestone', 'escrow', 'phased', 'release', 'freelance'], 'Release funds per completed milestone'],
  ['recurring-donation', 'Recurring Donation', 'utility', ['donation', 'recurring', 'charity', 'giving', 'nonprofit'], 'Ongoing charitable contributions'],
].map(([id, name, category, tags, useCase]) => ({
  id: id as string,
  name: name as string,
  description: `${name} — work in progress. Discovery-ready stub; constructor and methods to be completed.`,
  category: category as ContractTemplate['category'],
  constructor: [],
  methods: [],
  tags: tags as string[],
  useCases: [useCase as string],
  status: 'wip' as const,
}))

CONTRACT_TEMPLATES.push(...WIP_STUBS)

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getTemplate(id: string): ContractTemplate | undefined {
  return CONTRACT_TEMPLATES.find((t) => t.id === id)
}

export function getTemplatesByCategory(category: ContractTemplate['category']): ContractTemplate[] {
  return CONTRACT_TEMPLATES.filter((t) => t.category === category)
}

export function getAllTemplates(): ContractTemplate[] {
  return CONTRACT_TEMPLATES
}

/** Issue #563: only fully-specified templates (safe to deploy). */
export function getReadyTemplates(): ContractTemplate[] {
  return CONTRACT_TEMPLATES.filter((t) => t.status !== 'wip')
}

/**
 * Build a Rust-like source scaffold for a given template.
 * This is a human-readable preview — not compilable WASM.
 */
export function buildTemplateSource(template: ContractTemplate): string {
  const params = template.constructor
    .map((p) => `    ${p.name}: ${p.type}`)
    .join(',\n')

  const methods = template.methods
    .map((m) => `    pub fn ${m}(env: Env) -> Result<(), Error> {\n        todo!()\n    }`)
    .join('\n\n')

  return `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, String};

#[contract]
pub struct ${template.name.replace(/\s+/g, '')}Contract;

#[contractimpl]
impl ${template.name.replace(/\s+/g, '')}Contract {
    pub fn initialize(
        env: Env,
${params}
    ) {
        // Initialize contract storage
    }

${methods}
}
`
}

/**
 * Generate a one-click deployment config for a template.
 */
export interface DeploymentConfig {
  templateId: string
  templateName: string
  network: string
  sourceAccount: string
  constructorArgs: Record<string, string>
  estimatedFee: number
  steps: string[]
}

export function buildDeploymentConfig(
  template: ContractTemplate,
  network: string,
  sourceAccount: string,
  constructorArgs: Record<string, string> = {}
): DeploymentConfig {
  return {
    templateId: template.id,
    templateName: template.name,
    network,
    sourceAccount,
    constructorArgs,
    estimatedFee: Math.ceil((template.wasmSize || 40_000) / 1000) * 100,
    steps: [
      'Compile contract to WASM',
      'Upload WASM to Soroban RPC',
      `Initialize ${template.name} with provided arguments`,
      'Verify deployment on-chain',
    ],
  }
}