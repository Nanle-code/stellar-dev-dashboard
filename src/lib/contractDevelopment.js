const CONTRACT_TEMPLATES = [
  {
    id: 'token',
    name: 'Fungible Token',
    description: 'ERC20-style Soroban token with mint and transfer flows.',
    tags: ['token', 'payments', 'utility'],
    entrypoint: 'transfer',
    source: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, Symbol};

#[contract]
pub struct Token;

#[contractimpl]
impl Token {
    pub fn initialize(_env: Env, _admin: Address, _name: Symbol, _symbol: Symbol, _decimals: u32) {
        // TODO: initialize token metadata
    }

    pub fn mint(_env: Env, _to: Address, _amount: i128) {
        // TODO: enforce admin auth and increase balance
    }

    pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {
        // TODO: check auth and move balances
    }
}`,
  },
  {
    id: 'escrow',
    name: 'Milestone Escrow',
    description: 'Release funds on milestone confirmations with dispute timeout.',
    tags: ['escrow', 'marketplace', 'defi'],
    entrypoint: 'release',
    source: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, BytesN};

#[contract]
pub struct MilestoneEscrow;

#[contractimpl]
impl MilestoneEscrow {
    pub fn initialize(_env: Env, _payer: Address, _payee: Address, _arbiter: Address, _id: BytesN<32>) {
        // TODO: store escrow participants and status
    }

    pub fn fund(_env: Env, _amount: i128) {
        // TODO: accept escrow funding
    }

    pub fn approve_milestone(_env: Env, _milestone_id: u32) {
        // TODO: approve specific milestone
    }

    pub fn release(_env: Env) {
        // TODO: transfer escrowed amount to payee
    }
}`,
  },
  {
    id: 'oracle',
    name: 'Price Oracle',
    description: 'On-chain oracle feed with signer set and staleness checks.',
    tags: ['oracle', 'defi', 'pricing'],
    entrypoint: 'latest_price',
    source: `#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Address, Vec};

#[contract]
pub struct PriceOracle;

#[contractimpl]
impl PriceOracle {
    pub fn initialize(_env: Env, _admin: Address, _signers: Vec<Address>) {
        // TODO: set signer quorum
    }

    pub fn submit_price(_env: Env, _pair: u32, _price: i128, _timestamp: u64) {
        // TODO: require signer auth and store latest price
    }

    pub fn latest_price(_env: Env, _pair: u32) -> i128 {
        // TODO: load and return cached price
        0
    }
}`,
  },
]

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`
}

export function getContractTemplates() {
  return CONTRACT_TEMPLATES
}

export function getContractTemplateById(templateId) {
  return CONTRACT_TEMPLATES.find((template) => template.id === templateId) || null
}

export function buildContractWorkspace(templateId, options = {}) {
  const template = getContractTemplateById(templateId)
  if (!template) throw new Error('Template not found')

  const contractName = (options.contractName || template.name).replace(/\s+/g, '')
  const packageName = contractName.toLowerCase()

  const tests = `use soroban_sdk::{Env, Address};

#[test]
fn test_${template.entrypoint}_flow() {
    let env = Env::default();
    let user_a = Address::generate(&env);
    let user_b = Address::generate(&env);

    // TODO: instantiate contract and seed state
    assert!(user_a != user_b);
}`

  return {
    ...template,
    workspaceId: randomId('workspace'),
    contractName,
    packageName,
    source: template.source,
    tests,
    deployCommand: `soroban contract deploy --wasm target/wasm32-unknown-unknown/release/${packageName}.wasm --source-account <SOURCE> --network <NETWORK_ALIAS>`,
  }
}

export function simulateSorobanTests(sourceCode, testCode, settings = {}) {
  const issues = []

  if (!sourceCode || sourceCode.length < 80) {
    issues.push('Source code is incomplete.')
  }

  if (!/#[\s]*contractimpl/.test(sourceCode)) {
    issues.push('Missing #[contractimpl] block.')
  }

  if (!/fn\s+[a-zA-Z0-9_]+\s*\(/.test(sourceCode)) {
    issues.push('No callable contract function found.')
  }

  if (!testCode || !/#[\s]*test/.test(testCode)) {
    issues.push('No #[test] function found.')
  }

  const lintHints = []
  if (!/panic!/.test(sourceCode)) {
    lintHints.push('No explicit panic path found. Consider adding guarded failure tests.')
  }
  if (!/Address/.test(sourceCode)) {
    lintHints.push('Contract does not currently handle account authorization inputs.')
  }

  const passed = issues.length === 0

  return {
    passed,
    durationMs: 450 + Math.floor(Math.random() * 500),
    executed: passed ? 3 : 1,
    failed: passed ? 0 : 1,
    issues,
    lintHints,
    profile: settings.profile || 'testnet-debug',
  }
}

export function generateDeploymentPlan(config = {}) {
  const network = config.network || 'testnet'
  const sourceAccount = config.sourceAccount || '<SOURCE_ACCOUNT>'
  const wasmPath = config.wasmPath || 'target/wasm32-unknown-unknown/release/contract.wasm'
  const contractSalt = config.contractSalt || randomId('salt')

  const command = [
    'soroban',
    'contract',
    'deploy',
    `--wasm ${wasmPath}`,
    `--source-account ${sourceAccount}`,
    `--network ${network}`,
    `--salt ${contractSalt}`,
  ].join(' ')

  return {
    network,
    sourceAccount,
    wasmPath,
    contractSalt,
    command,
    checklist: [
      'Build contract artifact with `cargo build --target wasm32-unknown-unknown --release`.',
      'Run unit tests and snapshot tests before deployment.',
      'Verify source account has enough XLM for fees.',
      'Record deployed contract ID and ABI in dashboard metadata.',
    ],
  }
}
/**
 * Generate a deterministic WASM hash placeholder for local dev.
 * Real builds produce actual hashes; this stub allows UI testing.
 */
export function generateWasmHash(templateId) {
  const base = `stellar-dev-${templateId}-wasm-${Date.now()}`
  let hash = ''
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16)
  }
  return { hash, placeholder: true, generatedAt: new Date().toISOString() }
}

/**
 * Export a starter contract specification (JSON) for a given template.
 * Includes ABI-like method signatures and constructor args.
 */
export function exportContractSpec(templateId) {
  const template = getContractTemplateById(templateId)
  if (!template) throw new Error('Template not found')

  const methods = template.source
    .match(/pub fn \w+/g)
    ?.map((m) => m.replace('pub fn ', '')) || []

  return {
    specVersion: '0.1.0',
    contract: {
      name: template.name,
      id: templateId,
      description: template.description,
      entrypoint: template.entrypoint,
    },
    methods: methods.map((name) => ({
      name,
      kind: 'function',
      inputs: [],
      outputs: [],
    })),
    wasmHash: generateWasmHash(templateId),
    docs: 'https://developers.stellar.org/docs/smart-contracts',
  }
}

/**
 * Build a downloadable README scaffold for a contract template.
 */
export function generateContractReadme(templateId) {
  const template = getContractTemplateById(templateId)
  if (!template) throw new Error('Template not found')

  return `# ${template.name}

> Generated by Stellar Dev Dashboard — Scaffold Template

## Description
${template.description}

## Tags
${template.tags.join(', ')}

## Entrypoint
\`${template.entrypoint}\`

## Getting Started

### Prerequisites
- Rust 1.70+
- Soroban CLI: \`cargo install soroban-cli\`
- Target: \`rustup target add wasm32-unknown-unknown\`

### Build
\`\`\`bash
cargo build --target wasm32-unknown-unknown --release
\`\`\`

### Deploy
\`\`\`bash
soroban contract deploy \\
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \\
  --source-account <SOURCE> \\
  --network testnet
\`\`\`

### Test
\`\`\`bash
cargo test
\`\`\`

## Resources
- [Stellar Smart Contracts Documentation](https://developers.stellar.org/docs/smart-contracts)
- [Soroban SDK Reference](https://docs.rs/soroban-sdk)
- [Stellar Testnet Faucet](https://laboratory.stellar.org/#faucet)
`
}

/**
 * Download a starter scaffold bundle (spec JSON + README + source) for a template.
 * Triggers a browser download of a zip-like JSON bundle.
 */
export function downloadScaffold(templateId) {
  const spec = exportContractSpec(templateId)
  const readme = generateContractReadme(templateId)
  const source = getContractTemplateById(templateId)?.source || ''

  const bundle = {
    scaffold: templateId,
    generatedAt: new Date().toISOString(),
    spec,
    readme,
    source,
    links: {
      stellarDocs: 'https://developers.stellar.org/docs/smart-contracts',
      sorobanCli: 'https://docs.rs/soroban-sdk',
      testnetFaucet: 'https://laboratory.stellar.org/#faucet',
    },
  }

  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${templateId}-scaffold.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return bundle
}

/**
 * Initialize a simulated debugging session for a contract.
 */
export function initDebugSession(sourceCode, entrypoint, args = []) {
  const lines = sourceCode.split('\n')
  const executableLines = []
  
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    // Heuristic for executable lines in Rust/Soroban
    if (
      trimmed &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('use') &&
      !trimmed.startsWith('pub struct') &&
      !trimmed.startsWith('impl') &&
      !trimmed.endsWith('{') &&
      !trimmed.endsWith('}') &&
      trimmed !== 'let env = Env::default();'
    ) {
      executableLines.push(index + 1)
    }
  })

  // Find the entrypoint function to start the stack
  const entrypointLine = lines.findIndex(l => l.includes(`fn ${entrypoint}`)) + 1

  return {
    sessionId: randomId('debug'),
    currentLine: executableLines.find(l => l > entrypointLine) || executableLines[0] || 1,
    executableLines,
    breakpoints: [],
    callStack: [
      { function: entrypoint, line: entrypointLine || 1 }
    ],
    state: {
      env: 'Env::default()',
      storage: {},
      variables: args.reduce((acc, arg) => ({ ...acc, [arg.name]: arg.value }), {})
    },
    status: 'paused',
    logs: [`Debug session started for entrypoint: ${entrypoint}`]
  }
}

/**
 * Step through the contract execution in a simulated session.
 */
export function stepDebugSession(session, sourceCode) {
  if (session.status === 'finished') return session

  const { currentLine, executableLines } = session
  const currentIndex = executableLines.indexOf(currentLine)
  
  if (currentIndex === -1 || currentIndex === executableLines.length - 1) {
    return {
      ...session,
      status: 'finished',
      logs: [...session.logs, 'Execution finished.']
    }
  }

  const nextLine = executableLines[currentIndex + 1]
  const lines = sourceCode.split('\n')
  const lineContent = lines[currentLine - 1] || ''
  
  const newState = { 
    ...session.state,
    variables: { ...session.state.variables }
  }

  // Simulated state updates based on common patterns
  if (lineContent.includes('let ')) {
    const varMatch = lineContent.match(/let\s+(?:mut\s+)?([a-zA-Z0-9_]+)/)
    if (varMatch) {
      const varName = varMatch[1]
      // Deterministic simulation values
      newState.variables[varName] = `Val(${currentLine})`
    }
  }

  if (lineContent.includes('storage().set')) {
    const keyMatch = lineContent.match(/Symbol::short\("([a-zA-Z0-9_]+)"\)/)
    if (keyMatch) {
      newState.storage[keyMatch[1]] = `StoredVal(${currentLine})`
    }
  }

  return {
    ...session,
    currentLine: nextLine,
    state: newState,
    callStack: session.callStack.map((frame, i) => i === 0 ? { ...frame, line: nextLine } : frame),
    logs: [...session.logs, `Stepped to line ${nextLine}: ${lines[nextLine - 1]?.trim()}`]
  }
}

/**
 * Toggle a breakpoint for a specific line.
 */
export function toggleBreakpoint(session, line) {
  const breakpoints = session.breakpoints.includes(line)
    ? session.breakpoints.filter(b => b !== line)
    : [...session.breakpoints, line]
  
  return { ...session, breakpoints }
}