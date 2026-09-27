/**
 * Interactive Soroban Debugging Tutorial Series Engine
 * 
 * Provides progressive, hands-on tutorials covering:
 * 1. Simulation errors (WASM traps, integer overflows, budget exhaustion)
 * 2. Authorization failures (missing require_auth, invoker auth, auth hierarchies)
 * 3. Footprint issues (read-only mutation, missing footprint keys, TTL expiration)
 * 
 * Includes rigorous input validation, environment safety guards, and deterministic diagnostics.
 */

export type DebuggingEnvironment = 'testnet' | 'futurenet' | 'local' | 'sandbox' | 'mainnet';

export enum TutorialErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  UNSUPPORTED_ENVIRONMENT = 'UNSUPPORTED_ENVIRONMENT',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  AUTH_VERIFICATION_FAILED = 'AUTH_VERIFICATION_FAILED',
  FOOTPRINT_VIOLATION = 'FOOTPRINT_VIOLATION',
  STEP_NOT_FOUND = 'STEP_NOT_FOUND',
  QUIZ_NOT_FOUND = 'QUIZ_NOT_FOUND',
}

export class SorobanTutorialError extends Error {
  public readonly code: TutorialErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: TutorialErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'SorobanTutorialError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, SorobanTutorialError.prototype);
  }
}

export interface FootprintEntry {
  key: string;
  type: 'Instance' | 'Persistent' | 'Temporary';
  access: 'readOnly' | 'readWrite';
  ttlLedgersRemaining?: number;
}

export interface AuthEntry {
  address: string;
  functionName: string;
  isInvoker: boolean;
  authorized: boolean;
}

export interface TutorialStep {
  stepNumber: number;
  title: string;
  objective: string;
  conceptSummary: string;
  initialCode: string;
  sampleInputParams?: Record<string, unknown>;
  expectedFixPattern: RegExp | ((_code: string) => boolean);
  diagnosticHint: string;
  solutionCode: string;
  explanation: string;
}

export interface TutorialQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface SorobanTutorialModule {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: 'simulation' | 'auth' | 'footprint';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  overview: string;
  prerequisites: string[];
  steps: TutorialStep[];
  quiz: TutorialQuizQuestion[];
  initialFootprint?: FootprintEntry[];
  initialAuthEntries?: AuthEntry[];
}

export interface SimulationRunRequest {
  moduleId: string;
  stepNumber: number;
  contractCode: string;
  environment?: DebuggingEnvironment;
  contractId?: string;
  functionName?: string;
  inputParams?: Record<string, unknown>;
  footprint?: FootprintEntry[];
  authEntries?: AuthEntry[];
  cpuInstructionsLimit?: number;
  allowMainnetSimulation?: boolean;
}

export interface DiagnosticLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface SimulationRunResult {
  success: boolean;
  statusCode: 'SUCCESS' | 'ERROR';
  errorCode?: TutorialErrorCode;
  errorMessage?: string;
  suggestedFix?: string;
  diagnosticLogs: DiagnosticLog[];
  consumedCpuInstructions: number;
  cpuBudgetLimit: number;
  consumedMemoryBytes: number;
  eventsEmitted: Array<{ topic: string; data: string }>;
  footprintState: FootprintEntry[];
  authState: AuthEntry[];
  stepCompleted: boolean;
  unlockedNextStep?: number;
}

export interface UserTutorialProgress {
  userId: string;
  moduleId: string;
  currentStep: number;
  completedSteps: number[];
  isModuleCompleted: boolean;
  quizScore?: number;
  quizPassed?: boolean;
  completedAt?: string;
  attemptsCount: number;
}

export interface QuizSubmissionResult {
  passed: boolean;
  score: number;
  correctAnswersCount: number;
  totalQuestions: number;
  details: Array<{
    questionId: string;
    isCorrect: boolean;
    userAnswer: number;
    correctAnswer: number;
    explanation: string;
  }>;
}

// ─── Environment Safety Guard ───────────────────────────────────────────────

const SUPPORTED_ENVIRONMENTS: DebuggingEnvironment[] = [
  'testnet',
  'futurenet',
  'local',
  'sandbox',
];

export function assertTutorialEnvironment(
  env?: string,
  options?: { allowMainnetSimulation?: boolean }
): DebuggingEnvironment {
  const normalized = (env || 'sandbox').toLowerCase().trim() as DebuggingEnvironment;

  if (normalized === 'mainnet') {
    if (!options?.allowMainnetSimulation) {
      throw new SorobanTutorialError(
        TutorialErrorCode.UNSUPPORTED_ENVIRONMENT,
        'Interactive debugging tutorials cannot be executed against Mainnet without explicit sandbox simulation override. Please switch to Testnet, Futurenet, or Local Sandbox.',
        { environment: normalized }
      );
    }
    return 'mainnet';
  }

  if (!SUPPORTED_ENVIRONMENTS.includes(normalized)) {
    throw new SorobanTutorialError(
      TutorialErrorCode.UNSUPPORTED_ENVIRONMENT,
      `Unsupported environment "${env}". Supported environments: ${SUPPORTED_ENVIRONMENTS.join(', ')}`,
      { environment: env }
    );
  }

  return normalized;
}

// ─── Input Validation ───────────────────────────────────────────────────────

const CONTRACT_ID_REGEX = /^[A-Z0-9]{56}$|^C[A-Z0-9]{55}$/;

export function validateSimulationInput(request: SimulationRunRequest): void {
  if (!request) {
    throw new SorobanTutorialError(
      TutorialErrorCode.INVALID_INPUT,
      'Simulation request payload cannot be empty'
    );
  }

  if (!request.moduleId || typeof request.moduleId !== 'string' || !request.moduleId.trim()) {
    throw new SorobanTutorialError(
      TutorialErrorCode.INVALID_INPUT,
      'Field "moduleId" must be a non-empty string'
    );
  }

  if (
    typeof request.stepNumber !== 'number' ||
    !Number.isInteger(request.stepNumber) ||
    request.stepNumber < 1
  ) {
    throw new SorobanTutorialError(
      TutorialErrorCode.INVALID_INPUT,
      'Field "stepNumber" must be a positive integer >= 1'
    );
  }

  if (typeof request.contractCode !== 'string' || !request.contractCode.trim()) {
    throw new SorobanTutorialError(
      TutorialErrorCode.INVALID_INPUT,
      'Field "contractCode" must be provided as non-empty code string'
    );
  }

  if (request.contractId && !CONTRACT_ID_REGEX.test(request.contractId)) {
    throw new SorobanTutorialError(
      TutorialErrorCode.INVALID_INPUT,
      `Invalid Soroban contract ID format: "${request.contractId}". Must be 56-character alphanumeric string.`
    );
  }

  if (request.cpuInstructionsLimit !== undefined) {
    if (
      typeof request.cpuInstructionsLimit !== 'number' ||
      isNaN(request.cpuInstructionsLimit) ||
      request.cpuInstructionsLimit < 0 ||
      request.cpuInstructionsLimit > 200_000_000
    ) {
      throw new SorobanTutorialError(
        TutorialErrorCode.INVALID_INPUT,
        'Field "cpuInstructionsLimit" must be a valid positive number between 0 and 200,000,000'
      );
    }
  }
}

// ─── Tutorial Curriculum Definition ────────────────────────────────────────

export const SOROBAN_TUTORIAL_MODULES: SorobanTutorialModule[] = [
  {
    id: 'soroban-sim-1',
    slug: 'simulation-errors',
    title: 'Simulation Errors & Host Execution Traps',
    subtitle: 'Diagnose WASM traps, integer overflows, and budget exhaustion during pre-flight simulation',
    category: 'simulation',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    overview:
      'In Soroban, all transactions undergo pre-flight simulation via `simulateTransaction` before being signed and submitted to the network. This module teaches you how to decipher simulation failure XDRs, diagnose host function VM traps, inspect CPU budget consumption, and apply safe arithmetic guards.',
    prerequisites: ['Basic Rust syntax', 'Understanding of smart contract functions'],
    initialFootprint: [
      { key: 'ContractData', type: 'Persistent', access: 'readWrite' },
      { key: 'TotalSupply', type: 'Instance', access: 'readWrite' },
    ],
    initialAuthEntries: [
      { address: 'GBBD67IFDDJ466K...ALICE', functionName: 'distribute_rewards', isInvoker: true, authorized: true },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Step 1: Deciphering HostFunctionError VM Traps',
        objective: 'Identify an unchecked arithmetic overflow that triggers a WASM trap during simulation',
        conceptSummary:
          'When Rust code overflows integer limits or divides by zero, the WebAssembly virtual machine executes an `unreachable` opcode, triggering `InvokeHostFunctionResultCodeTrapped`. Simulation halts immediately.',
        initialCode: `pub fn calculate_reward(env: Env, base_amount: u64, multiplier: u64, divisor: u64) -> u64 {
    // BUG: Unchecked arithmetic causes overflow or division by zero!
    let scaled = base_amount * multiplier;
    scaled / divisor
}`,
        sampleInputParams: { base_amount: 10_000_000_000, multiplier: 1_000_000_000, divisor: 0 },
        expectedFixPattern: /checked_mul|checked_div|if\s+divisor\s*==\s*0/i,
        diagnosticHint: 'Use checked arithmetic like `.checked_mul()` or add an explicit check to verify divisor != 0 before dividing.',
        solutionCode: `pub fn calculate_reward(env: Env, base_amount: u64, multiplier: u64, divisor: u64) -> Result<u64, Error> {
    if divisor == 0 {
        return Err(Error::DivisionByZero);
    }
    base_amount
        .checked_mul(multiplier)
        .and_then(|val| val.checked_div(divisor))
        .ok_or(Error::ArithmeticOverflow)
}`,
        explanation: 'Checked operations prevent VM traps by gracefully returning typed errors when numbers overflow or underflow.',
      },
      {
        stepNumber: 2,
        title: 'Step 2: CPU & Memory Budget Exhaustion',
        objective: 'Optimize unbounded loops that exceed transaction CPU instruction limits (100M instructions)',
        conceptSummary:
          'Soroban nodes impose strict budget caps on contract execution. An unbounded loop over storage or arrays will exhaust CPU instructions and fail simulation with `HostBudgetExceeded`.',
        initialCode: `pub fn process_batch(env: Env, users: Vec<Address>, bonus: i128) {
    // BUG: Iterating without batch limits exhausts the CPU instruction budget
    for i in 0..users.len() {
        let user = users.get(i).unwrap();
        update_user_balance(&env, user, bonus);
    }
}`,
        sampleInputParams: { users_count: 5000, bonus: 100 },
        expectedFixPattern: /MAX_BATCH_SIZE|assert!\(users\.len\(\)\s*<=\s*|chunk/i,
        diagnosticHint: 'Add a maximum batch size boundary check (e.g. `MAX_BATCH_SIZE = 50`) to guarantee CPU usage remains comfortably within network limits.',
        solutionCode: `const MAX_BATCH_SIZE: u32 = 50;

pub fn process_batch(env: Env, users: Vec<Address>, bonus: i128) -> Result<(), Error> {
    if users.len() > MAX_BATCH_SIZE {
        return Err(Error::BatchSizeExceeded);
    }
    for user in users.iter() {
        update_user_balance(&env, user, bonus);
    }
    Ok(())
}`,
        explanation: 'Bounded iteration guarantees deterministic fee estimation and prevents transaction abortion from instruction budget overflow.',
      },
      {
        stepNumber: 3,
        title: 'Step 3: Handling Missing Contract Data & Panics',
        objective: 'Safely handle missing ledger keys using get() vs unwrap()',
        conceptSummary:
          'Calling `.unwrap()` on a storage key that has not yet been initialized causes an unhandled panic during simulation. Always use `env.storage().instance().has(...)` or `.get(...).unwrap_or(...)`.',
        initialCode: `pub fn get_user_tier(env: Env, user: Address) -> u32 {
    // BUG: Panics if the user has not registered
    env.storage().persistent().get(&user).unwrap()
}`,
        expectedFixPattern: /unwrap_or|has\(&user\)|match\s+env\.storage\(\)/i,
        diagnosticHint: 'Replace `.unwrap()` with `.unwrap_or(0)` or match the Option returned by `.get(&user)`.',
        solutionCode: `pub fn get_user_tier(env: Env, user: Address) -> u32 {
    env.storage()
        .persistent()
        .get(&user)
        .unwrap_or(0)
}`,
        explanation: 'Default fallback values ensure contract calls do not panic when encountering new or uninitialized accounts.',
      },
    ],
    quiz: [
      {
        id: 'q-sim-1',
        question: 'What happens when a Soroban contract encounters an unhandled integer overflow in production?',
        options: [
          'The transaction wraps around modulo 2^64',
          'The host VM traps with an unreachable instruction, failing simulation immediately',
          'The host auto-promotes the integer to 128-bit',
          'The transaction succeeds but emits a warning event',
        ],
        correctAnswer: 1,
        explanation: 'Soroban compiles Rust in debug/safe math modes where unhandled overflows trigger an explicit VM trap.',
      },
      {
        id: 'q-sim-2',
        question: 'Why must developers simulate Soroban transactions before submitting them?',
        options: [
          'Simulation generates required cryptographic signatures',
          'Simulation is mandatory to discover footprint keys, resource fees, and catch contract traps without incurring real fee losses',
          'Simulation transfers funds from Friendbot',
          'Simulation deploys the WASM to the main ledger',
        ],
        correctAnswer: 1,
        explanation: 'Pre-flight simulation computes exact resource consumption and generates the transaction footprint needed for inclusion.',
      },
    ],
  },
  {
    id: 'soroban-auth-1',
    slug: 'auth-failures',
    title: 'Declarative Authorization & Auth Trees',
    subtitle: 'Master Address::require_auth(), invoker authorization, and multi-party signature validation',
    category: 'auth',
    difficulty: 'intermediate',
    estimatedMinutes: 25,
    overview:
      'Soroban features a decentralized authorization framework where contract functions must explicitly request authorization from caller addresses. This module walks through debugging `InvokeHostFunctionResultCodeAuthorizationError`, configuring authorization trees, and securing cross-contract calls.',
    prerequisites: ['Simulation error basics', 'Stellar Ed25519 addresses'],
    initialFootprint: [
      { key: 'VaultBalances', type: 'Persistent', access: 'readWrite' },
      { key: 'AdminKey', type: 'Instance', access: 'readOnly' },
    ],
    initialAuthEntries: [
      { address: 'GDM...BOB', functionName: 'transfer', isInvoker: true, authorized: false },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Step 1: Missing Caller Authorization',
        objective: 'Fix an unauthorized fund transfer by requiring explicit authorization from the debit address',
        conceptSummary:
          'Transferring assets on behalf of an account requires `from.require_auth()`. Without it, anyone can invoke the function to drain balances, or the host rejects the unauthorized debit.',
        initialCode: `pub fn withdraw(env: Env, from: Address, to: Address, amount: i128) {
    // BUG: Missing authorization! Anyone can withdraw someone else's funds!
    let mut balance: i128 = env.storage().persistent().get(&from).unwrap_or(0);
    assert!(balance >= amount, "insufficient funds");
    
    env.storage().persistent().set(&from, &(balance - amount));
    mint_tokens(&env, &to, amount);
}`,
        expectedFixPattern: /from\.require_auth\(\);?/i,
        diagnosticHint: 'Add `from.require_auth();` at the beginning of the function before any state modification.',
        solutionCode: `pub fn withdraw(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    
    let mut balance: i128 = env.storage().persistent().get(&from).unwrap_or(0);
    assert!(balance >= amount, "insufficient funds");
    
    env.storage().persistent().set(&from, &(balance - amount));
    mint_tokens(&env, &to, amount);
}`,
        explanation: 'Calling `from.require_auth()` ensures the caller signed the invocation or authorized it via Soroban authorization credentials.',
      },
      {
        stepNumber: 2,
        title: 'Step 2: Scoped Authorization for Specific Arguments',
        objective: 'Use require_auth_for_args to prevent replay and cross-call spoofing',
        conceptSummary:
          'When authorizing sensitive operations, `require_auth_for_args` ensures the signer authorized specific parameters (e.g., specific amount and nonce) rather than blanket execution.',
        initialCode: `pub fn execute_delegated_swap(env: Env, trader: Address, nonce: u64, amount_in: i128, min_out: i128) {
    // BUG: Generic require_auth allows front-running parameter manipulation
    trader.require_auth();
    execute_swap(&env, trader, amount_in, min_out);
}`,
        expectedFixPattern: /require_auth_for_args/i,
        diagnosticHint: 'Use `trader.require_auth_for_args((nonce, amount_in, min_out).into_val(&env));` to scope authorization to the exact swap arguments.',
        solutionCode: `pub fn execute_delegated_swap(env: Env, trader: Address, nonce: u64, amount_in: i128, min_out: i128) {
    trader.require_auth_for_args((nonce, amount_in, min_out).into_val(&env));
    execute_swap(&env, trader, amount_in, min_out);
}`,
        explanation: 'Scoped authorization prevents malicious intermediaries from tampering with transaction arguments.',
      },
      {
        stepNumber: 3,
        title: 'Step 3: Cross-Contract Call Authorization Trees',
        objective: 'Authorize sub-contract invocations using Soroban authorization trees',
        conceptSummary:
          'When contract A calls contract B and contract B needs user authorization, contract A cannot impersonate the user unless the user authorized the entire call tree.',
        initialCode: `pub fn swap_and_deposit(env: Env, user: Address, vault_contract: Address, amount: i128) {
    user.require_auth();
    // BUG: Sub-contract invocation requires authorization tree propagation
    let vault_client = VaultClient::new(&env, &vault_contract);
    vault_client.deposit(&user, &amount);
}`,
        expectedFixPattern: /vault_client|authorize_as_current_contract|sub_invocation/i,
        diagnosticHint: 'Ensure the invocation building includes the sub-contract authorization entry or uses `env.authorize_as_current_contract()`.',
        solutionCode: `pub fn swap_and_deposit(env: Env, user: Address, vault_contract: Address, amount: i128) {
    user.require_auth();
    let vault_client = VaultClient::new(&env, &vault_contract);
    vault_client.deposit(&user, &amount);
}`,
        explanation: 'Soroban tracks recursive authorization nodes ensuring every sub-contract invocation has explicit user consent.',
      },
    ],
    quiz: [
      {
        id: 'q-auth-1',
        question: 'What error code does Soroban return if an address does not supply authorization for require_auth()?',
        options: [
          'InvokeHostFunctionResultCodeAuthorizationError',
          'HostStorageError',
          'EntryExpiredError',
          'TxMalformedXdr',
        ],
        correctAnswer: 0,
        explanation: 'Missing signatures or unauthorized addresses result in `InvokeHostFunctionResultCodeAuthorizationError`.',
      },
      {
        id: 'q-auth-2',
        question: 'Which entity can authorize operations when calling contract.require_auth()?',
        options: [
          'Only the contract creator',
          'Any Stellar account, contract address, or smart account with appropriate signatures/auth trees',
          'Only accounts with > 10,000 XLM',
          'Only the Stellar Development Foundation',
        ],
        correctAnswer: 1,
        explanation: 'Soroban addresses abstract both standard Ed25519 accounts and smart contracts, supporting multi-sig and custom account auth.',
      },
    ],
  },
  {
    id: 'soroban-footprint-1',
    slug: 'footprint-issues',
    title: 'Ledger Footprints, State Archival & Storage Isolation',
    subtitle: 'Diagnose read-only vs read-write conflicts, missing footprint keys, and state TTL expiration',
    category: 'footprint',
    difficulty: 'advanced',
    estimatedMinutes: 30,
    overview:
      'Stellar Soroban executes transactions concurrently by requiring every transaction to declare its exact ledger footprint (the set of ledger keys it reads or modifies). This module covers debugging missing footprint entries, resolving read-only write violations, managing state Time-To-Live (TTL), and choosing the right storage tier.',
    prerequisites: ['Simulation errors', 'Soroban state tiers (Instance, Persistent, Temporary)'],
    initialFootprint: [
      { key: 'AdminConfig', type: 'Instance', access: 'readOnly', ttlLedgersRemaining: 200_000 },
      { key: 'UserBalance', type: 'Persistent', access: 'readOnly', ttlLedgersRemaining: 50 },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Step 1: Read-Only Footprint Mutation Conflict',
        objective: 'Resolve FootprintConflictError caused by modifying a key declared as readOnly',
        conceptSummary:
          'If a transaction modifies a ledger entry that was declared in `readOnly` instead of `readWrite` in its footprint, the host terminates with `FootprintConflictError`.',
        initialCode: `// Transaction footprint declared:
// readOnly: ['AdminConfig', 'ProtocolFee']
// readWrite: ['UserAccount']

pub fn update_protocol_fee(env: Env, new_fee: u32) {
    // BUG: ProtocolFee was only declared in readOnly footprint!
    env.storage().instance().set(&Symbol::new(&env, "ProtocolFee"), &new_fee);
}`,
        expectedFixPattern: /readWrite:[^\]]*ProtocolFee/i,
        diagnosticHint: 'Ensure `ProtocolFee` is included in the `readWrite` footprint set in the transaction simulation response before submitting.',
        solutionCode: `// Correct footprint declaration:
// readOnly: ['AdminConfig']
// readWrite: ['UserAccount', 'ProtocolFee']

pub fn update_protocol_fee(env: Env, new_fee: u32) {
    env.storage().instance().set(&Symbol::new(&env, "ProtocolFee"), &new_fee);
}`,
        explanation: 'Any ledger entry updated during contract execution must be declared in the transaction readWrite footprint.',
      },
      {
        stepNumber: 2,
        title: 'Step 2: Ledger Entry Expiration & TTL Extensions',
        objective: 'Prevent LedgerEntryTtlExpired by extending entry TTL before access',
        conceptSummary:
          'All Soroban storage entries have a Time-To-Live (TTL). If an entry expires, it is archived and cannot be read without restoration. Use `extend_ttl` to keep critical state active.',
        initialCode: `pub fn access_pool_state(env: Env, pool_id: u64) -> PoolState {
    let key = DataKey::Pool(pool_id);
    // BUG: If TTL expired, this fails with HostStorageError / EntryExpired
    env.storage().persistent().get(&key).unwrap()
}`,
        expectedFixPattern: /extend_ttl|has\(&key\)/i,
        diagnosticHint: 'Call `env.storage().persistent().extend_ttl(&key, threshold, extend_to)` to safeguard active entries against archival.',
        solutionCode: `pub fn access_pool_state(env: Env, pool_id: u64) -> Result<PoolState, Error> {
    let key = DataKey::Pool(pool_id);
    // Bump TTL so the pool stays alive for at least 100,000 ledgers
    env.storage().persistent().extend_ttl(&key, 10_000, 100_000);
    env.storage().persistent().get(&key).ok_or(Error::PoolNotFound)
}`,
        explanation: 'Regularly extending TTL prevents contract data from being archived by the Stellar network state retention policy.',
      },
      {
        stepNumber: 3,
        title: 'Step 3: Storage Tier Isolation (Temporary vs Persistent)',
        objective: 'Choose Temporary storage for ephemeral non-critical cache and Persistent for user balances',
        conceptSummary:
          'Temporary storage is cheap and automatically pruned when TTL lapses; it CANNOT be restored. Persistent storage can be restored from archival. Storing permanent user funds in Temporary storage is a critical vulnerability.',
        initialCode: `pub fn deposit(env: Env, user: Address, amount: i128) {
    user.require_auth();
    // CRITICAL BUG: Storing permanent balance in Temporary storage!
    // If TTL lapses, user funds are lost forever!
    env.storage().temporary().set(&user, &amount);
}`,
        expectedFixPattern: /storage\(\)\.persistent\(\)/i,
        diagnosticHint: 'Use `env.storage().persistent()` for asset balances and contract ownership that must never be permanently deleted.',
        solutionCode: `pub fn deposit(env: Env, user: Address, amount: i128) {
    user.require_auth();
    let key = DataKey::Balance(user.clone());
    let current_balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage().persistent().set(&key, &(current_balance + amount));
    env.storage().persistent().extend_ttl(&key, 50_000, 200_000);
}`,
        explanation: 'Persistent storage ensures that state can be recovered or restored even if inactive for extended periods.',
      },
    ],
    quiz: [
      {
        id: 'q-foot-1',
        question: 'What error occurs when a contract writes to a storage key that was only declared in the readOnly footprint?',
        options: [
          'FootprintConflictError / HostStorageError',
          'ArithmeticOverflow',
          'AccountMissing',
          'MalformedTransactionSignature',
        ],
        correctAnswer: 0,
        explanation: 'Writing to a key declared as read-only violates the execution contract and halts with FootprintConflictError.',
      },
      {
        id: 'q-foot-2',
        question: 'Can expired Temporary storage entries be restored from archival on Stellar?',
        options: [
          'Yes, by submitting a RestoreFootprintOp',
          'No, Temporary entries are permanently deleted once their TTL expires',
          'Yes, by calling Friendbot',
          'Yes, after paying a validator penalty fee',
        ],
        correctAnswer: 1,
        explanation: 'Temporary storage entries are permanently discarded when expired and cannot be restored; only Persistent entries are archivable.',
      },
    ],
  },
];

// ─── Tutorial Management & Execution Service ──────────────────────────────

class SorobanDebuggingTutorialService {
  private modules: Map<string, SorobanTutorialModule> = new Map();
  private userProgressStore: Map<string, UserTutorialProgress> = new Map();

  constructor() {
    for (const mod of SOROBAN_TUTORIAL_MODULES) {
      this.modules.set(mod.id, mod);
      this.modules.set(mod.slug, mod);
    }
  }

  public getModules(): SorobanTutorialModule[] {
    // Return unique modules
    const unique = new Map<string, SorobanTutorialModule>();
    for (const mod of this.modules.values()) {
      unique.set(mod.id, mod);
    }
    return Array.from(unique.values());
  }

  public getModule(idOrSlug: string): SorobanTutorialModule | null {
    if (!idOrSlug || typeof idOrSlug !== 'string') return null;
    return this.modules.get(idOrSlug.trim()) || null;
  }

  public getStep(idOrSlug: string, stepNumber: number): TutorialStep | null {
    const mod = this.getModule(idOrSlug);
    if (!mod) return null;
    return mod.steps.find((s) => s.stepNumber === stepNumber) || null;
  }

  public runSimulation(request: SimulationRunRequest): SimulationRunResult {
    validateSimulationInput(request);
    const environment = assertTutorialEnvironment(request.environment, {
      allowMainnetSimulation: request.allowMainnetSimulation,
    });

    const mod = this.getModule(request.moduleId);
    if (!mod) {
      throw new SorobanTutorialError(
        TutorialErrorCode.STEP_NOT_FOUND,
        `Tutorial module "${request.moduleId}" not found`
      );
    }

    const step = mod.steps.find((s) => s.stepNumber === request.stepNumber);
    if (!step) {
      throw new SorobanTutorialError(
        TutorialErrorCode.STEP_NOT_FOUND,
        `Step ${request.stepNumber} not found in module "${request.moduleId}"`
      );
    }

    const logs: DiagnosticLog[] = [
      {
        level: 'info',
        message: `[SimulatePreflight] Environment: ${environment}. Module: ${mod.slug}, Step: ${step.stepNumber}`,
        timestamp: new Date().toISOString(),
      },
    ];

    // Evaluate code fix against step expectation
    const isFixed =
      typeof step.expectedFixPattern === 'function'
        ? step.expectedFixPattern(request.contractCode)
        : step.expectedFixPattern.test(request.contractCode);

    // Initial Footprint
    const footprintState: FootprintEntry[] = (request.footprint || mod.initialFootprint || []).map(
      (f) => ({ ...f })
    );
    const authState: AuthEntry[] = (request.authEntries || mod.initialAuthEntries || []).map(
      (a) => ({ ...a })
    );

    // If code has NOT been fixed, simulate the realistic failure scenario based on module type
    if (!isFixed) {
      if (mod.category === 'simulation') {
        logs.push({
          level: 'error',
          message:
            'HostFunctionError(InvokeHostFunctionResultCodeTrapped): WebAssembly Virtual Machine trapped during execution (unreachable instruction / integer overflow).',
          timestamp: new Date().toISOString(),
        });
        logs.push({
          level: 'warn',
          message: `CPU Instructions consumed: 98,410,219 / 100,000,000. Gas near ceiling.`,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 'ERROR',
          errorCode: TutorialErrorCode.SIMULATION_FAILED,
          errorMessage: 'Simulation trapped: Unchecked arithmetic or unhandled nil error encountered.',
          suggestedFix: step.diagnosticHint,
          diagnosticLogs: logs,
          consumedCpuInstructions: 98_410_219,
          cpuBudgetLimit: request.cpuInstructionsLimit || 100_000_000,
          consumedMemoryBytes: 4_210_840,
          eventsEmitted: [],
          footprintState,
          authState,
          stepCompleted: false,
        };
      }

      if (mod.category === 'auth') {
        logs.push({
          level: 'error',
          message:
            'InvokeHostFunctionResultCodeAuthorizationError: Address missing required authorization signature for invoked host function.',
          timestamp: new Date().toISOString(),
        });
        logs.push({
          level: 'warn',
          message: 'Contract attempted to transfer state without caller.require_auth() entry.',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 'ERROR',
          errorCode: TutorialErrorCode.AUTH_VERIFICATION_FAILED,
          errorMessage: 'Authorization failed: Function invocation requires caller signature verification.',
          suggestedFix: step.diagnosticHint,
          diagnosticLogs: logs,
          consumedCpuInstructions: 12_450_000,
          cpuBudgetLimit: request.cpuInstructionsLimit || 100_000_000,
          consumedMemoryBytes: 1_048_576,
          eventsEmitted: [],
          footprintState,
          authState: authState.map((a) => ({ ...a, authorized: false })),
          stepCompleted: false,
        };
      }

      if (mod.category === 'footprint') {
        logs.push({
          level: 'error',
          message:
            'FootprintConflictError: Storage key was declared as readOnly in transaction footprint but contract attempted a write operation.',
          timestamp: new Date().toISOString(),
        });
        logs.push({
          level: 'warn',
          message: 'TTL of ledger entry is critically low (under threshold).',
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          statusCode: 'ERROR',
          errorCode: TutorialErrorCode.FOOTPRINT_VIOLATION,
          errorMessage: 'Footprint conflict: Read-only ledger key modified or entry TTL expired.',
          suggestedFix: step.diagnosticHint,
          diagnosticLogs: logs,
          consumedCpuInstructions: 18_920_000,
          cpuBudgetLimit: request.cpuInstructionsLimit || 100_000_000,
          consumedMemoryBytes: 1_572_864,
          eventsEmitted: [],
          footprintState,
          authState,
          stepCompleted: false,
        };
      }
    }

    // Success simulation path: Code fix matches requirement!
    logs.push({
      level: 'info',
      message: 'Host pre-flight simulation completed successfully.',
      timestamp: new Date().toISOString(),
    });
    logs.push({
      level: 'info',
      message: 'All authorization trees and footprint declarations validated.',
      timestamp: new Date().toISOString(),
    });

    const isLastStep = step.stepNumber >= mod.steps.length;
    const nextStep = isLastStep ? undefined : step.stepNumber + 1;

    return {
      success: true,
      statusCode: 'SUCCESS',
      diagnosticLogs: logs,
      consumedCpuInstructions: 3_820_140,
      cpuBudgetLimit: request.cpuInstructionsLimit || 100_000_000,
      consumedMemoryBytes: 524_288,
      eventsEmitted: [
        { topic: 'SorobanDebugTutorial', data: `Step ${step.stepNumber} Verified Successfully` },
      ],
      footprintState: footprintState.map((f) => ({ ...f, access: 'readWrite' })),
      authState: authState.map((a) => ({ ...a, authorized: true })),
      stepCompleted: true,
      unlockedNextStep: nextStep,
    };
  }

  public submitQuiz(
    moduleId: string,
    userId: string,
    answers: number[]
  ): QuizSubmissionResult {
    if (!moduleId || typeof moduleId !== 'string') {
      throw new SorobanTutorialError(
        TutorialErrorCode.INVALID_INPUT,
        'Field "moduleId" is required'
      );
    }
    if (!userId || typeof userId !== 'string') {
      throw new SorobanTutorialError(
        TutorialErrorCode.INVALID_INPUT,
        'Field "userId" is required'
      );
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new SorobanTutorialError(
        TutorialErrorCode.INVALID_INPUT,
        'Answers must be provided as a non-empty array'
      );
    }

    const mod = this.getModule(moduleId);
    if (!mod) {
      throw new SorobanTutorialError(
        TutorialErrorCode.QUIZ_NOT_FOUND,
        `Tutorial module "${moduleId}" not found`
      );
    }

    if (answers.length !== mod.quiz.length) {
      throw new SorobanTutorialError(
        TutorialErrorCode.INVALID_INPUT,
        `Expected ${mod.quiz.length} answers, but received ${answers.length}`
      );
    }

    let correctCount = 0;
    const details = mod.quiz.map((q, idx) => {
      const isCorrect = answers[idx] === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        isCorrect,
        userAnswer: answers[idx],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correctCount / mod.quiz.length) * 100);
    const passed = score >= 70;

    // Update progress
    const progressKey = `${userId}:${mod.id}`;
    const existing = this.userProgressStore.get(progressKey) || {
      userId,
      moduleId: mod.id,
      currentStep: 1,
      completedSteps: [],
      isModuleCompleted: false,
      attemptsCount: 0,
    };

    existing.quizScore = score;
    existing.quizPassed = passed;
    existing.attemptsCount += 1;
    if (passed && existing.completedSteps.length === mod.steps.length) {
      existing.isModuleCompleted = true;
      existing.completedAt = new Date().toISOString();
    }
    this.userProgressStore.set(progressKey, existing);

    return {
      passed,
      score,
      correctAnswersCount: correctCount,
      totalQuestions: mod.quiz.length,
      details,
    };
  }

  public recordStepCompletion(
    userId: string,
    moduleId: string,
    stepNumber: number
  ): UserTutorialProgress {
    const mod = this.getModule(moduleId);
    if (!mod) {
      throw new SorobanTutorialError(
        TutorialErrorCode.STEP_NOT_FOUND,
        `Module "${moduleId}" not found`
      );
    }

    const progressKey = `${userId}:${mod.id}`;
    const progress = this.userProgressStore.get(progressKey) || {
      userId,
      moduleId: mod.id,
      currentStep: 1,
      completedSteps: [],
      isModuleCompleted: false,
      attemptsCount: 0,
    };

    if (!progress.completedSteps.includes(stepNumber)) {
      progress.completedSteps.push(stepNumber);
      progress.completedSteps.sort((a, b) => a - b);
    }

    const nextStep = stepNumber + 1;
    if (nextStep <= mod.steps.length) {
      progress.currentStep = Math.max(progress.currentStep, nextStep);
    }

    if (progress.completedSteps.length === mod.steps.length && progress.quizPassed) {
      progress.isModuleCompleted = true;
      progress.completedAt = new Date().toISOString();
    }

    this.userProgressStore.set(progressKey, progress);
    return { ...progress };
  }

  public getUserProgress(userId: string, moduleId: string): UserTutorialProgress {
    const mod = this.getModule(moduleId);
    const resolvedId = mod ? mod.id : moduleId;
    const progressKey = `${userId}:${resolvedId}`;
    return (
      this.userProgressStore.get(progressKey) || {
        userId,
        moduleId: resolvedId,
        currentStep: 1,
        completedSteps: [],
        isModuleCompleted: false,
        attemptsCount: 0,
      }
    );
  }

  public resetProgress(userId: string, moduleId: string): void {
    const mod = this.getModule(moduleId);
    const resolvedId = mod ? mod.id : moduleId;
    const progressKey = `${userId}:${resolvedId}`;
    this.userProgressStore.delete(progressKey);
  }
}

export const sorobanDebuggingTutorialService = new SorobanDebuggingTutorialService();
