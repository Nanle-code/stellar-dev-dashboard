/**
 * Deterministic network fixtures for the contract-interaction visual suite
 * (#894). Kept free of Playwright imports so the pure logic is unit-testable
 * (see `tests/unit/visual/contractFormFixtures.test.ts`).
 */

export interface MockOptions {
  /** Return a JSON-RPC error for `simulateTransaction` (failure path). */
  simulateError?: boolean;
}

export type EndpointKind = 'app' | 'soroban' | 'horizon' | 'other';

/**
 * Classify a request URL so the harness can decide whether to serve a fixture,
 * let the app's own assets through, or fall back to the real network.
 */
export function classifyEndpoint(rawUrl: string, appOrigins: string[]): EndpointKind {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'other';
  }

  if (appOrigins.includes(url.origin)) return 'app';
  if (/soroban/i.test(url.hostname) || /soroban/i.test(url.pathname) || /\/rpc$/i.test(url.pathname)) {
    return 'soroban';
  }
  if (/horizon/i.test(url.hostname)) return 'horizon';
  return 'other';
}

/** JSON-RPC response for a Soroban request body. */
export function sorobanResponse(body: Record<string, unknown> | null, options: MockOptions = {}): unknown {
  const id = body?.id ?? 1;
  const method = String(body?.method ?? '');

  if (method === 'simulateTransaction') {
    if (options.simulateError) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: 'HostError: contract trapped during simulation' },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        results: [{ xdr: `AAAA${'A'.repeat(120)}`, auth: [] }],
        events: [],
        latestLedger: 1234,
        cost: { cpuInsns: '1000', memBytes: '100' },
      },
    };
  }

  if (method === 'getLatestLedger') {
    return { jsonrpc: '2.0', id, result: { id: 'abcdef', sequence: 1234, protocolVersion: 22, closeTime: 0 } };
  }

  if (method === 'getNetwork') {
    return { jsonrpc: '2.0', id, result: { passphrase: 'Test SDF Network ; September 2015', friendbotUrl: null } };
  }

  return { jsonrpc: '2.0', id, result: { entries: [], latestLedger: 1234 } };
}

/** Minimal Horizon payloads (no accounts/transactions) for a quiet UI. */
export function horizonResponse(_pathname: string): unknown {
  return { _embedded: { records: [] }, _links: {} };
}
