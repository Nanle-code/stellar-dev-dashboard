/**
 * templateManager.ts — Issue #148
 * Manages Soroban smart contract templates: listing, loading, deploying.
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
  },
]

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
