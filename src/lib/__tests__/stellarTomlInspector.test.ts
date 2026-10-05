import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  inspectStellarToml,
  validateSep1Fields,
  checkEndpointsAgainstAllowlist,
  crossCheckCurrenciesAgainstHorizon,
  exportInspectionAsJson,
} from '../stellarTomlInspector';
import * as stellarModule from '../stellar';

// Stellar public keys use base32 (A-Z, 2-7 only — no 0189), G-prefixed, 56 chars total.
const VALID_ISSUER = 'G' + 'A'.repeat(20) + 'B'.repeat(20) + 'C'.repeat(15);
const VALID_SIGNING_KEY = 'G' + 'D'.repeat(20) + 'E'.repeat(20) + 'F'.repeat(15);

function buildToml(overrides: Partial<Record<string, string>> = {}): string {
  const lines = [
    `VERSION="2.7.0"`,
    `NETWORK_PASSPHRASE="Test SDF Network ; September 2015"`,
    `SIGNING_KEY="${overrides.SIGNING_KEY ?? VALID_SIGNING_KEY}"`,
    `WEB_AUTH_ENDPOINT="${overrides.WEB_AUTH_ENDPOINT ?? 'https://example.com/auth'}"`,
    `TRANSFER_SERVER="${overrides.TRANSFER_SERVER ?? 'https://example.com/transfer'}"`,
    `[[CURRENCIES]]`,
    `code="USDX"`,
    `issuer="${overrides.CURRENCY_ISSUER ?? VALID_ISSUER}"`,
  ];
  return lines.join('\n');
}

function mockFetchResponse(body: string, options: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) {
  const headers = new Headers(options.headers ?? { 'content-type': 'text/plain' });
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers,
    text: async () => body,
  } as unknown as Response;
}

describe('validateSep1Fields', () => {
  it('reports no errors for a well-formed toml', () => {
    const parsed = { NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015', SIGNING_KEY: VALID_SIGNING_KEY };
    const issues = validateSep1Fields(parsed);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('flags an invalid SIGNING_KEY as an error', () => {
    const parsed = { SIGNING_KEY: 'not-a-real-key' };
    const issues = validateSep1Fields(parsed);
    expect(issues.some((i) => i.field === 'SIGNING_KEY' && i.severity === 'error')).toBe(true);
  });

  it('flags a currency entry missing an issuer', () => {
    const parsed = { CURRENCIES: [{ code: 'USDX' }] };
    const issues = validateSep1Fields(parsed);
    expect(issues.some((i) => i.field === 'CURRENCIES[0].issuer')).toBe(true);
  });
});

describe('checkEndpointsAgainstAllowlist', () => {
  it('allows an endpoint on the home domain', () => {
    const checks = checkEndpointsAgainstAllowlist({ WEB_AUTH_ENDPOINT: 'https://example.com/auth' }, 'example.com');
    expect(checks).toHaveLength(1);
    expect(checks[0].validation.allowed).toBe(true);
  });

  it('flags an endpoint on an unrelated domain (boundary: cross-domain lookalike)', () => {
    const checks = checkEndpointsAgainstAllowlist(
      { WEB_AUTH_ENDPOINT: 'https://example.com.evil.test/auth' },
      'example.com'
    );
    expect(checks[0].validation.allowed).toBe(false);
  });

  it('skips fields that are not present', () => {
    const checks = checkEndpointsAgainstAllowlist({}, 'example.com');
    expect(checks).toHaveLength(0);
  });
});

describe('crossCheckCurrenciesAgainstHorizon', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms a matching issuer and home_domain', async () => {
    vi.spyOn(stellarModule, 'fetchAccount').mockResolvedValue({
      home_domain: 'example.com',
    } as never);

    const results = await crossCheckCurrenciesAgainstHorizon(
      { CURRENCIES: [{ code: 'USDX', issuer: VALID_ISSUER }] },
      'example.com',
      'testnet'
    );
    expect(results).toHaveLength(1);
    expect(results[0].issuerExists).toBe(true);
    expect(results[0].homeDomainMatches).toBe(true);
  });

  it('flags a mismatched home_domain', async () => {
    vi.spyOn(stellarModule, 'fetchAccount').mockResolvedValue({
      home_domain: 'different-domain.example',
    } as never);

    const results = await crossCheckCurrenciesAgainstHorizon(
      { CURRENCIES: [{ code: 'USDX', issuer: VALID_ISSUER }] },
      'example.com',
      'testnet'
    );
    expect(results[0].homeDomainMatches).toBe(false);
    expect(results[0].mismatchReason).toContain('does not match');
  });

  it('reports a not-found issuer as a failure case', async () => {
    vi.spyOn(stellarModule, 'fetchAccount').mockRejectedValue(new Error('Not Found'));

    const results = await crossCheckCurrenciesAgainstHorizon(
      { CURRENCIES: [{ code: 'USDX', issuer: VALID_ISSUER }] },
      'example.com',
      'testnet'
    );
    expect(results[0].issuerExists).toBe(false);
    expect(results[0].mismatchReason).toContain('was not found');
  });
});

describe('inspectStellarToml', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the primary flow end to end for a well-formed toml', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchResponse(buildToml(), { headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } })
    );
    vi.spyOn(stellarModule, 'fetchAccount').mockResolvedValue({ home_domain: 'example.com' } as never);

    const result = await inspectStellarToml('example.com', 'testnet');

    expect(result.domain).toBe('example.com');
    expect(result.transport.https).toBe(true);
    expect(result.transport.corsHeaderPresent).toBe(true);
    expect(result.transport.contentType).toBe('text/plain');
    expect(result.transport.sizeBytes).toBeGreaterThan(0);
    expect(result.isValid).toBe(true);
    expect(result.currencyChecks[0].homeDomainMatches).toBe(true);
  });

  it('marks the result invalid on a boundary case: missing CORS header and bad signing key', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      mockFetchResponse(buildToml({ SIGNING_KEY: 'not-a-key' }), { headers: { 'content-type': 'text/plain' } })
    );
    vi.spyOn(stellarModule, 'fetchAccount').mockResolvedValue({ home_domain: 'example.com' } as never);

    const result = await inspectStellarToml('example.com', 'testnet');

    expect(result.transport.corsHeaderPresent).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.fieldIssues.some((i) => i.field === 'SIGNING_KEY')).toBe(true);
  });

  it('throws a clear error as a failure case when the domain has no stellar.toml (404)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse('', { ok: false, status: 404 }));

    await expect(inspectStellarToml('no-toml.example', 'testnet')).rejects.toThrow(/404/);
  });

  it('rejects an empty domain', async () => {
    await expect(inspectStellarToml('   ', 'testnet')).rejects.toThrow(/home domain is required/i);
  });
});

describe('exportInspectionAsJson', () => {
  it('produces valid JSON without the raw toml body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(buildToml()));
    vi.spyOn(stellarModule, 'fetchAccount').mockResolvedValue({ home_domain: 'example.com' } as never);

    const result = await inspectStellarToml('example.com', 'testnet');
    const json = exportInspectionAsJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.domain).toBe('example.com');
    expect(parsed.raw).toBeUndefined();
  });
});
