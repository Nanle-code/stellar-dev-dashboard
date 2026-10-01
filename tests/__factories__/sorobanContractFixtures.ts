/**
 * Soroban contract fixture factory (#896).
 *
 * Builds deterministic `simulateTransaction` JSON-RPC responses for the three
 * cases most Soroban tests need — simulation success, auth failure and
 * resource exhaustion — plus archived-state and transport-error variants.
 *
 * Every XDR field is real, SDK-encoded XDR, so the fixtures round-trip through
 * `rpc.parseRawSimulation` exactly like a live RPC response would. Two
 * factories created with the same options always produce byte-identical
 * output, which keeps snapshot and visual tests stable.
 *
 * Usage:
 *   const soroban = createSorobanFixtureFactory({ seed: 'counter' });
 *   server.use(http.post(RPC_URL, () => HttpResponse.json(soroban.authFailure())));
 *   // or, in Playwright:
 *   await page.route('**\/soroban/rpc', (r) => r.fulfill({ json: soroban.handle(r.request().postDataJSON(), 'success') }));
 */

import { Networks, SorobanDataBuilder, StrKey, hash, nativeToScVal } from '@stellar/stellar-sdk';

export type SorobanFixtureNetwork = 'testnet' | 'futurenet' | 'standalone';

export type SorobanFixtureScenario =
  | 'success'
  | 'auth_failure'
  | 'resource_exhaustion'
  | 'restore_required'
  | 'rpc_error';

export const SOROBAN_FIXTURE_SCENARIOS: readonly SorobanFixtureScenario[] = Object.freeze([
  'success',
  'auth_failure',
  'resource_exhaustion',
  'restore_required',
  'rpc_error',
]);

const NETWORK_PASSPHRASES: Record<SorobanFixtureNetwork, string> = {
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  standalone: Networks.STANDALONE,
};

/** Networks fixtures must never pretend to be (tests should not model mainnet state). */
const UNSUPPORTED_NETWORKS = new Set(['public', 'mainnet', 'pubnet']);

/** Fixture default limits; keep in sync with DEFAULT_SOROBAN_RESOURCE_LIMITS. */
export const FIXTURE_RESOURCE_LIMITS = Object.freeze({
  cpuInstructions: 100_000_000,
  memoryBytes: 41_943_040,
});

export interface SorobanFixtureOptions {
  /** Any non-empty string; drives the contract id and account addresses. */
  seed?: string;
  network?: SorobanFixtureNetwork;
  /** Ledger sequence reported by the first response. */
  startLedger?: number;
}

export interface SuccessOverrides {
  /** Native JS value encoded as the contract's return ScVal. */
  returnValue?: unknown;
  cpuInsns?: number;
  memBytes?: number;
  minResourceFee?: number;
  id?: number | string;
}

export interface AuthFailureOverrides {
  reason?: 'missing_signature' | 'invalid_signature';
  /** Address whose authorization failed; defaults to the fixture account. */
  address?: string;
  id?: number | string;
}

export interface ResourceExhaustionOverrides {
  resource?: 'cpu' | 'memory';
  id?: number | string;
}

export interface RpcErrorOverrides {
  code?: number;
  message?: string;
  id?: number | string;
}

export class SorobanFixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SorobanFixtureError';
  }
}

function assertNonNegativeInteger(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new SorobanFixtureError(`${name} must be a non-negative integer, received ${String(value)}`);
  }
  return value;
}

function seededBytes(seed: string, label: string): Buffer {
  // A plain Uint8Array (not a Buffer) passes noble-hashes' type check in every realm, including jsdom.
  return Buffer.from(hash(Uint8Array.from(Buffer.from(`${seed}:${label}`, 'utf8')) as Buffer));
}

function transactionDataXdr(cpuInsns: number, readBytes: number, writeBytes: number, fee: number): string {
  return new SorobanDataBuilder()
    .setResources(cpuInsns, readBytes, writeBytes)
    .setResourceFee(fee)
    .build()
    .toXDR('base64');
}

export function createSorobanFixtureFactory(options: SorobanFixtureOptions = {}) {
  const seed = options.seed ?? 'stellar-dev-dashboard';
  if (typeof seed !== 'string' || seed.trim() === '') {
    throw new SorobanFixtureError('seed must be a non-empty string');
  }

  const network = (options.network ?? 'testnet') as string;
  if (UNSUPPORTED_NETWORKS.has(network)) {
    throw new SorobanFixtureError(
      `Soroban fixtures are not supported for "${network}"; use testnet, futurenet or standalone.`
    );
  }
  if (!(network in NETWORK_PASSPHRASES)) {
    throw new SorobanFixtureError(`Unknown fixture network "${network}"`);
  }

  const startLedger = assertNonNegativeInteger('startLedger', options.startLedger ?? 1000);

  const contractId = StrKey.encodeContract(seededBytes(seed, 'contract'));
  const accountId = StrKey.encodeEd25519PublicKey(seededBytes(seed, 'account'));
  const networkPassphrase = NETWORK_PASSPHRASES[network as SorobanFixtureNetwork];

  let ledger = startLedger;
  let nextId = 1;

  /** Each response advances the ledger so ordering is observable but reproducible. */
  const envelope = (id: number | string | undefined, body: Record<string, unknown>) => {
    const resolvedId = id ?? nextId;
    nextId += 1;
    ledger += 1;
    return { jsonrpc: '2.0' as const, id: resolvedId, ...body };
  };

  const hostError = (error: string, data: string) =>
    `HostError: ${error}\n\nEvent log (newest first):\n` +
    `   0: [Diagnostic Event] contract:${contractId}, topics:[error, ${error}], data:${data}`;

  function simulationSuccess(overrides: SuccessOverrides = {}) {
    const cpuInsns = assertNonNegativeInteger('cpuInsns', overrides.cpuInsns ?? 1_250_000);
    const memBytes = assertNonNegativeInteger('memBytes', overrides.memBytes ?? 524_288);
    const minResourceFee = assertNonNegativeInteger('minResourceFee', overrides.minResourceFee ?? 45_000);
    const returnValue = 'returnValue' in overrides ? overrides.returnValue : 42;

    return envelope(overrides.id, {
      result: {
        transactionData: transactionDataXdr(cpuInsns, 1_024, 512, minResourceFee),
        minResourceFee: String(minResourceFee),
        events: [],
        results: [{ auth: [], xdr: nativeToScVal(returnValue).toXDR('base64') }],
        cost: { cpuInsns: String(cpuInsns), memBytes: String(memBytes) },
        latestLedger: ledger + 1,
      },
    });
  }

  function authFailure(overrides: AuthFailureOverrides = {}) {
    const address = overrides.address ?? accountId;
    const detail =
      (overrides.reason ?? 'missing_signature') === 'invalid_signature'
        ? `["failed account authentication with error", ${address}, Error(Crypto, InvalidInput)]`
        : `["require_auth: address not authorized", ${address}]`;
    return envelope(overrides.id, {
      result: {
        error: hostError('Error(Auth, InvalidAction)', detail),
        events: [],
        latestLedger: ledger + 1,
      },
    });
  }

  function resourceExhaustion(overrides: ResourceExhaustionOverrides = {}) {
    const resource = overrides.resource ?? 'cpu';
    if (resource !== 'cpu' && resource !== 'memory') {
      throw new SorobanFixtureError(`resource must be "cpu" or "memory", received ${String(resource)}`);
    }
    const detail = resource === 'cpu' ? '"cpu instructions limit exceeded"' : '"mem bytes limit exceeded"';
    return envelope(overrides.id, {
      result: {
        error: hostError('Error(Budget, ExceededLimit)', detail),
        events: [],
        latestLedger: ledger + 1,
      },
    });
  }

  function restoreRequired(overrides: { id?: number | string } = {}) {
    return envelope(overrides.id, {
      result: {
        transactionData: transactionDataXdr(1_250_000, 1_024, 512, 45_000),
        minResourceFee: '45000',
        events: [],
        results: [{ auth: [], xdr: nativeToScVal(null).toXDR('base64') }],
        cost: { cpuInsns: '1250000', memBytes: '524288' },
        restorePreamble: {
          transactionData: transactionDataXdr(0, 2_048, 2_048, 90_000),
          minResourceFee: '90000',
        },
        latestLedger: ledger + 1,
      },
    });
  }

  function rpcError(overrides: RpcErrorOverrides = {}) {
    return envelope(overrides.id, {
      error: { code: overrides.code ?? -32602, message: overrides.message ?? 'invalid parameters' },
    });
  }

  /**
   * Answer a JSON-RPC request body with the given scenario. Methods other than
   * `simulateTransaction` get quiet, deterministic defaults so a whole page
   * can be pointed at the handler.
   */
  function handle(body: unknown, scenario: SorobanFixtureScenario = 'success') {
    if (!SOROBAN_FIXTURE_SCENARIOS.includes(scenario)) {
      throw new SorobanFixtureError(`Unknown Soroban fixture scenario "${String(scenario)}"`);
    }
    const request = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const id = typeof request.id === 'number' || typeof request.id === 'string' ? request.id : undefined;
    const method = typeof request.method === 'string' ? request.method : '';

    switch (method) {
      case 'simulateTransaction':
        if (scenario === 'auth_failure') return authFailure({ id });
        if (scenario === 'resource_exhaustion') return resourceExhaustion({ id });
        if (scenario === 'restore_required') return restoreRequired({ id });
        if (scenario === 'rpc_error') return rpcError({ id });
        return simulationSuccess({ id });
      case 'getNetwork':
        return envelope(id, { result: { passphrase: networkPassphrase, protocolVersion: 22 } });
      case 'getLatestLedger':
        return envelope(id, { result: { id: seededBytes(seed, `ledger:${ledger}`).toString('hex'), sequence: ledger, protocolVersion: 22 } });
      case 'getHealth':
        return envelope(id, { result: { status: 'healthy', latestLedger: ledger, oldestLedger: startLedger } });
      case '':
        return rpcError({ id, code: -32600, message: 'invalid request: missing method' });
      default:
        return rpcError({ id, code: -32601, message: `method not found: ${method}` });
    }
  }

  /** Restore the ledger/id counters so a test can replay the same sequence. */
  function reset() {
    ledger = startLedger;
    nextId = 1;
  }

  return {
    seed,
    network: network as SorobanFixtureNetwork,
    networkPassphrase,
    contractId,
    accountId,
    get currentLedger() {
      return ledger;
    },
    simulationSuccess,
    authFailure,
    resourceExhaustion,
    restoreRequired,
    rpcError,
    handle,
    reset,
  };
}

export type SorobanFixtureFactory = ReturnType<typeof createSorobanFixtureFactory>;
