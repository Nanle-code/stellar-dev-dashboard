/**
 * Demo mode for first-time visitors (#875).
 *
 * New visitors otherwise land on an empty connect screen, so the first
 * impression shows no value. "Try demo" loads a curated, bundled set of public
 * testnet accounts and contracts with rich history, entirely read-only: no
 * wallet, no secret keys and no network calls are required to render it.
 *
 * The data lives in `src/fixtures/demo-fixtures.generated.json`, which is
 * (re)created by `scripts/seed-demo-fixtures.mjs` after a testnet reset.
 */

import type { Horizon } from '@stellar/stellar-sdk';
import rawFixture from '../fixtures/demo-fixtures.generated.json';

export const DEMO_NETWORK = 'testnet' as const;
export const DEMO_MODE_LABEL = 'Demo mode';
export const DEMO_MODE_BADGE = 'READ-ONLY DEMO';
export const DEMO_FIXTURE_VERSION = 1;

export type DemoErrorCode =
  | 'INVALID_FIXTURE'
  | 'FIXTURE_EMPTY'
  | 'UNSUPPORTED_NETWORK'
  | 'MALFORMED_ACCOUNT'
  | 'READ_ONLY_DEMO';

export class DemoModeError extends Error {
  code: DemoErrorCode;
  details?: Record<string, unknown>;

  constructor(code: DemoErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[DemoMode:${code}] ${message}`);
    this.name = 'DemoModeError';
    this.code = code;
    this.details = details;
  }
}

export interface DemoAccountFixture {
  address: string;
  label: string;
  description: string;
  tags: string[];
  account: Horizon.AccountResponse;
}

export interface DemoContractFixture {
  contractId: string;
  name: string;
  description: string;
  category: string;
  deployedAt: string;
  callCount: number;
  functions: string[];
}

export interface DemoFixture {
  version: number;
  network: typeof DEMO_NETWORK;
  anchor: string;
  generatedBy: string;
  accounts: DemoAccountFixture[];
  contracts: DemoContractFixture[];
  transactions: Horizon.ServerApi.TransactionRecord[];
  operations: Horizon.ServerApi.OperationRecord[];
}

/** Non-throwing fixture summary for render paths that must not crash. */
export function getDemoFixtureSummarySafe(): DemoFixtureSummary | null {
  try {
    return getDemoFixtureSummary();
  } catch {
    return null;
  }
}

export interface DemoFixtureSummary {
  accountCount: number;
  contractCount: number;
  transactionCount: number;
  operationCount: number;
  anchor: string;
}

const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate an unknown value as a demo fixture. Throws {@link DemoModeError} with a
 * machine-readable `code` so callers can distinguish empty data (boundary) from
 * malformed data (failure).
 */
export function validateDemoFixture(data: unknown): asserts data is DemoFixture {
  if (!isPlainObject(data)) {
    throw new DemoModeError('INVALID_FIXTURE', 'Demo fixture must be an object.');
  }

  if (data.version !== DEMO_FIXTURE_VERSION) {
    throw new DemoModeError(
      'INVALID_FIXTURE',
      `Unsupported demo fixture version: ${String(data.version)}. Expected ${DEMO_FIXTURE_VERSION}.`,
      { version: data.version }
    );
  }

  if (data.network !== DEMO_NETWORK) {
    throw new DemoModeError(
      'UNSUPPORTED_NETWORK',
      `Demo fixtures are testnet-only and read-only, got '${String(data.network)}'.`,
      { network: data.network }
    );
  }

  if (!Array.isArray(data.accounts) || data.accounts.length === 0) {
    throw new DemoModeError(
      'FIXTURE_EMPTY',
      'Demo fixture must include at least one account.',
      { accounts: data.accounts }
    );
  }

  data.accounts.forEach((account, index) => {
    if (!isPlainObject(account)) {
      throw new DemoModeError('MALFORMED_ACCOUNT', `Demo account at index ${index} is not an object.`);
    }
    if (typeof account.address !== 'string' || !PUBLIC_KEY_RE.test(account.address)) {
      throw new DemoModeError(
        'MALFORMED_ACCOUNT',
        `Demo account at index ${index} has an invalid public address.`,
        { address: account.address }
      );
    }
    if (!isPlainObject(account.account)) {
      throw new DemoModeError(
        'MALFORMED_ACCOUNT',
        `Demo account ${account.address} is missing its Horizon account payload.`
      );
    }
    const balances = account.account.balances;
    if (!Array.isArray(balances) || balances.length === 0) {
      throw new DemoModeError(
        'MALFORMED_ACCOUNT',
        `Demo account ${account.address} must expose at least one balance.`
      );
    }
  });

  if (!Array.isArray(data.contracts) || data.contracts.length === 0) {
    throw new DemoModeError(
      'FIXTURE_EMPTY',
      'Demo fixture must include at least one contract.',
      { contracts: data.contracts }
    );
  }

  data.contracts.forEach((contract, index) => {
    if (!isPlainObject(contract) || typeof contract.contractId !== 'string' || !CONTRACT_ID_RE.test(contract.contractId)) {
      throw new DemoModeError(
        'INVALID_FIXTURE',
        `Demo contract at index ${index} has an invalid contract id.`
      );
    }
  });

  if (!Array.isArray(data.transactions) || data.transactions.length === 0) {
    throw new DemoModeError('FIXTURE_EMPTY', 'Demo fixture must include transaction history.');
  }

  if (!Array.isArray(data.operations) || data.operations.length === 0) {
    throw new DemoModeError('FIXTURE_EMPTY', 'Demo fixture must include operation history.');
  }
}

/** Non-throwing variant of {@link validateDemoFixture}. */
export function isDemoFixtureValid(data: unknown): boolean {
  try {
    validateDemoFixture(data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the validated bundled fixture. The result is validated once and cached
 * for the lifetime of the module.
 */
export function getDemoFixture(): DemoFixture {
  validateDemoFixture(rawFixture);
  return rawFixture as unknown as DemoFixture;
}

export function getPrimaryDemoAccount(): DemoAccountFixture {
  return getDemoFixture().accounts[0];
}

export function getDemoFixtureSummary(): DemoFixtureSummary {
  const fixture = getDemoFixture();
  return {
    accountCount: fixture.accounts.length,
    contractCount: fixture.contracts.length,
    transactionCount: fixture.transactions.length,
    operationCount: fixture.operations.length,
    anchor: fixture.anchor,
  };
}

/**
 * State slice the store applies when demo mode is entered. Kept as a pure
 * function so the read-only guarantee is unit-testable without a DOM.
 */
export interface DemoStateSlice {
  network: typeof DEMO_NETWORK;
  connectedAddress: string;
  accountData: Horizon.AccountResponse;
  transactions: Horizon.ServerApi.TransactionRecord[];
  operations: Horizon.ServerApi.OperationRecord[];
  accountLoading: boolean;
  accountError: null;
  txLoading: boolean;
  txNextCursor: null;
  txHasMore: boolean;
  opsLoading: boolean;
  opsNextCursor: null;
  opsHasMore: boolean;
  activeTab: 'overview';
}

export function hydrateDemoState(): DemoStateSlice {
  const fixture = getDemoFixture();
  const primary = fixture.accounts[0];

  return {
    network: DEMO_NETWORK,
    connectedAddress: primary.address,
    accountData: primary.account,
    transactions: fixture.transactions,
    operations: fixture.operations,
    accountLoading: false,
    accountError: null,
    txLoading: false,
    txNextCursor: null,
    txHasMore: false,
    opsLoading: false,
    opsNextCursor: null,
    opsHasMore: false,
    activeTab: 'overview',
  };
}

/**
 * Demo mode is read-only by design. Callers that mutate the network (faucet,
 * signing, contract invocation, submission) use this guard to refuse while a
 * demo session is active.
 */
export function isDemoWriteAllowed(isDemoMode: boolean): boolean {
  return !isDemoMode;
}

export function assertDemoWriteAllowed(isDemoMode: boolean, action: string): void {
  if (isDemoMode) {
    throw new DemoModeError(
      'READ_ONLY_DEMO',
      `'${action}' is disabled in demo mode because demo data is read-only.`,
      { action }
    );
  }
}
