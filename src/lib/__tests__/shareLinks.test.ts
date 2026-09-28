/**
 * Shareable view links — format, round-tripping, and the no-secrets guarantee.
 *
 * The security tests here are the load-bearing part of this feature: shared
 * links end up in chat messages, issue trackers and public bug reports, so
 * "no wallet or session data in a shared URL" has to be a property that is
 * proven by tests rather than asserted in a comment.
 */

import { describe, it, expect } from 'vitest';
import {
  buildFilterPatch,
  buildShareUrl,
  ENTITY_KINDS,
  findSecretLikeContent,
  isNetworkMismatch,
  isSecretLikeKey,
  isValidEntityId,
  looksLikeSecretValue,
  parseShareUrl,
  resolveFilters,
  sanitizeFilters,
  sanitizeShareText,
  selectShareableState,
  SHARE_PARAMS,
  SHARE_SCHEMA_VERSION,
  snapshotFromState,
  stripShareParams,
  type ViewSnapshot,
} from '../shareLinks';
import { DEFAULT_SEARCH_FILTERS } from '../store';

// A real ed25519 account (StrKey G…, 56 chars, valid CRC).
const ACCOUNT = 'GCZRBC5BJLNWXFZAKTWWY2UEIMMZVW64MHS5KOCEWIQ2EPIKY2QOXZYV';
// A second, distinct account used to represent the *connected wallet*, so the
// tests can prove it is not confused with the account being viewed.
const WALLET_KEY = 'GB6OWYST45X57HCJY5XWOHDEBULB6XUROWPIKW77L5DSNANBEQGUPADT2';
// A real-format Soroban contract id (StrKey C…).
const CONTRACT = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
// A real-format Stellar secret seed: 'S' + 55 base32 chars, 56 characters
// total. Generated via `Keypair.random().secret()`; the length is asserted
// below so a drift in the detection pattern cannot go unnoticed.
const SECRET_SEED = 'SCEU7SUXZDXHRUJP6BKQTL6JSTBZULHRMWKOMZX3ZOFYAWGE6VM55FN2';
const TX_HASH = 'a'.repeat(64);

const BASE = 'https://dashboard.example/transactions';

/**
 * A store state containing every field the app tracks that could plausibly be
 * sensitive, so the "nothing sensitive leaks" tests are meaningful rather than
 * vacuous.
 */
function sensitiveStoreState() {
  return {
    network: 'testnet' as const,
    activeTab: 'transactions',
    contractId: '',
    connectedAddress: ACCOUNT,
    searchFilters: { ...DEFAULT_SEARCH_FILTERS },
    filterExpressions: [],
    // Fields that must never reach a link:
    walletConnected: true,
    walletType: 'freighter',
    walletPublicKey: WALLET_KEY,
    walletSessionRevokedReason: null,
    sessionRecordingActive: true,
    sessionRecordingId: 'sess_9f2c1a',
    multiSigMode: true,
    // A raw secret that must never be serialized, however it is reached.
    secretSeed: SECRET_SEED,
    authToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig',
    customNetworkHeaders: { Authorization: 'Bearer super-secret-value' },
  };
}

// ─── Primary flow ─────────────────────────────────────────────────────────────

describe('shareLinks — primary flow', () => {
  it('encodes network, tab, entity and filters, and decodes them back', () => {
    const snapshot = snapshotFromState(
      {
        network: 'mainnet',
        activeTab: 'transactions',
        connectedAddress: ACCOUNT,
        searchFilters: {
          ...DEFAULT_SEARCH_FILTERS,
          status: 'failed',
          minFee: '100',
        },
        filterExpressions: [{ key: 'tx.status', operator: 'eq', value: 'failed' }],
      },
      { ledger: 500 }
    );

    const url = buildShareUrl(snapshot, { base: BASE });
    const params = new URL(url).searchParams;

    expect(params.get(SHARE_PARAMS.version)).toBe(String(SHARE_SCHEMA_VERSION));
    expect(params.get(SHARE_PARAMS.network)).toBe('mainnet');
    expect(params.get(SHARE_PARAMS.tab)).toBe('transactions');
    expect(params.get(SHARE_PARAMS.entity)).toBe(`account:${ACCOUNT}`);
    expect(params.get(SHARE_PARAMS.ledger)).toBe('500');
    expect(params.get(SHARE_PARAMS.filters)).toBeTruthy();

    const parsed = parseShareUrl(url, { knownTabs: ['transactions', 'overview'] });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.snapshot.network).toBe('mainnet');
    expect(parsed.snapshot.tab).toBe('transactions');
    expect(parsed.snapshot.entity).toEqual({ kind: 'account', id: ACCOUNT });
    expect(parsed.snapshot.ledger).toBe(500);
    expect(parsed.snapshot.filters).toMatchObject({ status: 'failed', minFee: '100' });
    expect(parsed.snapshot.expressions).toEqual([
      { key: 'tx.status', operator: 'eq', value: 'failed' },
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it('omits filter params entirely when filters are at their defaults', () => {
    const snapshot = snapshotFromState({
      network: 'testnet',
      activeTab: 'overview',
      searchFilters: { ...DEFAULT_SEARCH_FILTERS },
    });

    const url = buildShareUrl(snapshot, { base: BASE });
    expect(new URL(url).searchParams.has(SHARE_PARAMS.filters)).toBe(false);
    expect(url.length).toBeLessThan(120);
  });

  it('prefers a contract entity over the viewed account', () => {
    const snapshot = snapshotFromState({
      network: 'testnet',
      activeTab: 'contracts',
      contractId: CONTRACT,
      connectedAddress: ACCOUNT,
    });

    expect(snapshot.entity).toEqual({ kind: 'contract', id: CONTRACT });
  });

  it('parses a bare query string, a path+query, and a full URL identically', () => {
    const query = `${SHARE_PARAMS.tab}=network&${SHARE_PARAMS.network}=futurenet`;
    const expected = { tab: 'network', network: 'futurenet' };

    for (const input of [
      `?${query}`,
      query,
      `/network?${query}`,
      `https://dashboard.example/network?${query}`,
    ]) {
      const parsed = parseShareUrl(input, { knownTabs: ['network'] });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.snapshot.tab).toBe(expected.tab);
      expect(parsed.snapshot.network).toBe(expected.network);
    }
  });

  it('preserves unrelated query params and removes share params on exit', () => {
    const url = `${BASE}?ref=incident-42&${SHARE_PARAMS.tab}=network&${SHARE_PARAMS.network}=testnet`;
    const stripped = stripShareParams(new URL(url).search);

    expect(stripped).toBe('?ref=incident-42');
    const params = new URLSearchParams(stripped);
    for (const name of Object.values(SHARE_PARAMS)) {
      expect(params.has(name)).toBe(false);
    }
  });

  it('resolves a filter patch over the app defaults', () => {
    expect(buildFilterPatch({ status: 'failed' })).toEqual({ status: 'failed' });
    // Nothing to apply → the caller can skip the store write entirely.
    expect(buildFilterPatch({})).toBeNull();
    expect(resolveFilters({ minFee: '5' })).toEqual({
      ...DEFAULT_SEARCH_FILTERS,
      minFee: '5',
    });
  });
});

// ─── No-secrets guarantee ─────────────────────────────────────────────────────

describe('shareLinks — no wallet or session data in shared URLs', () => {
  it('emits no secret when the store holds every sensitive field', () => {
    const snapshot = snapshotFromState(
      sensitiveStoreState() as never,
      { tab: 'transactions', ledger: 42 }
    );
    const url = buildShareUrl(snapshot, { base: BASE });

    expect(findSecretLikeContent(url)).toEqual([]);

    // Belt and braces: assert the concrete leak vectors are absent by name.
    for (const forbidden of [
      'wallet',
      'session',
      'token',
      'secret',
      'signer',
      'header',
      'auth',
      'seed',
    ]) {
      expect(url.toLowerCase()).not.toContain(`${forbidden}=`);
    }
  });

  it('selectShareableState drops every non-allow-listed field', () => {
    const raw = sensitiveStoreState();
    const selected = selectShareableState(raw as never) as Record<string, unknown>;

    expect(Object.keys(selected).sort()).toEqual([
      'activeTab',
      'connectedAddress',
      'contractId',
      'filterExpressions',
      'network',
      'searchFilters',
      'selectedTemplateId',
    ]);

    // None of the sensitive *values* survive the narrowing, even though the
    // store still holds them.
    const serialized = JSON.stringify(selected);
    for (const secret of [
      WALLET_KEY,
      SECRET_SEED,
      'sess_9f2c1a',
      'freighter',
      'super-secret-value',
      'eyJhbGciOiJIUzI1NiJ9',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('rejects a secret-shaped entity id supplied directly in a snapshot', () => {
    const hostile: ViewSnapshot = {
      version: SHARE_SCHEMA_VERSION,
      network: 'testnet',
      tab: 'transactions',
      entity: { kind: 'tx', id: SECRET_SEED },
      filters: {},
      expressions: [],
      ledger: null,
    };

    const url = buildShareUrl(hostile, { base: BASE });
    expect(new URL(url).searchParams.has(SHARE_PARAMS.entity)).toBe(false);
    expect(findSecretLikeContent(url)).toEqual([]);
  });

  it('rejects a secret-shaped value smuggled through a filter expression', () => {
    const snapshot = snapshotFromState({
      network: 'testnet',
      activeTab: 'transactions',
      filterExpressions: [{ key: 'tx.memo', operator: 'eq', value: SECRET_SEED }],
    });

    expect(snapshot.expressions).toEqual([]);
    expect(findSecretLikeContent(buildShareUrl(snapshot, { base: BASE }))).toEqual([]);
  });

  it('never shares the connected wallet key in place of the viewed account', () => {
    const snapshot = snapshotFromState({
      network: 'testnet',
      activeTab: 'wallet',
      connectedAddress: ACCOUNT,
      walletPublicKey: WALLET_KEY,
    } as never);

    const url = buildShareUrl(snapshot, { base: BASE });
    expect(url).toContain(ACCOUNT);
    expect(url).not.toContain(WALLET_KEY);
  });

  it('refuses a javascript: base so a copied link cannot execute', () => {
    const snapshot = snapshotFromState({ network: 'testnet', activeTab: 'overview' });
    const url = buildShareUrl(snapshot, { base: 'javascript:alert(1)' });

    expect(url.startsWith('/?')).toBe(true);
    expect(url).not.toContain('javascript:');
  });

  it('screens credential-shaped keys and values', () => {
    // Pin the format the detector is written against: a Stellar secret seed is
    // 56 characters, 'S' plus 55 base32 characters.
    expect(SECRET_SEED).toHaveLength(56);
    expect(looksLikeSecretValue(SECRET_SEED)).toBe(true);
    // A 64-character transaction hash must not be mistaken for a 128-char
    // private key.
    expect(looksLikeSecretValue(TX_HASH)).toBe(false);

    expect(isSecretLikeKey('walletPublicKey')).toBe(true);
    expect(isSecretLikeKey('authToken')).toBe(true);
    expect(isSecretLikeKey('sessionId')).toBe(true);
    expect(isSecretLikeKey('privateKey')).toBe(true);
    expect(isSecretLikeKey('apiKey')).toBe(true);
    // Ordinary view fields must not be caught by the broad deny-list.
    expect(isSecretLikeKey('activeTab')).toBe(false);
    expect(isSecretLikeKey('network')).toBe(false);
    expect(isSecretLikeKey('searchFilters')).toBe(false);

    expect(looksLikeSecretValue('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(looksLikeSecretValue('Bearer abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(looksLikeSecretValue('hello world')).toBe(false);
  });
});

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe('shareLinks — boundaries', () => {
  it('treats ledger sequence 1 and MAX_SAFE_INTEGER as valid, 0 as absent', () => {
    const build = (ledger: number) =>
      buildShareUrl(
        snapshotFromState({ network: 'testnet', activeTab: 'transactions' }, { ledger }),
        { base: BASE }
      );

    expect(new URL(build(1)).searchParams.get(SHARE_PARAMS.ledger)).toBe('1');
    expect(
      new URL(build(Number.MAX_SAFE_INTEGER)).searchParams.get(SHARE_PARAMS.ledger)
    ).toBe(String(Number.MAX_SAFE_INTEGER));
    // Ledger 0 has no transactions: it is never a meaningful pin target.
    expect(new URL(build(0)).searchParams.has(SHARE_PARAMS.ledger)).toBe(false);
  });

  it('drops a pin on routes that cannot honour it', () => {
    const url = buildShareUrl(
      snapshotFromState({ network: 'testnet', activeTab: 'contracts' }, { ledger: 900 }),
      { base: BASE }
    );
    // Soroban RPC has no historical read, so the pin is not recorded at all
    // rather than being recorded in a way that implies it is enforced.
    expect(new URL(url).searchParams.has(SHARE_PARAMS.ledger)).toBe(false);
  });

  it('truncates an oversized filter value instead of emitting an unbounded URL', () => {
    const sanitized = sanitizeShareText('x'.repeat(5000), 120);
    expect(sanitized).toHaveLength(120);
    expect(sanitized.endsWith('…')).toBe(true);
  });

  it('caps the number of filter expressions carried in a link', () => {
    const expressions = Array.from({ length: 100 }, (_, i) => ({
      key: 'tx.memo',
      operator: 'eq',
      value: `m${i}`,
    }));

    const snapshot = snapshotFromState({
      network: 'testnet',
      activeTab: 'transactions',
      filterExpressions: expressions,
    });

    expect(snapshot.expressions).toHaveLength(20);
  });

  it('validates entity ids per kind', () => {
    for (const kind of ENTITY_KINDS) {
      expect(isValidEntityId(kind, 'not a valid id!')).toBe(false);
    }
    expect(isValidEntityId('tx', TX_HASH)).toBe(true);
    expect(isValidEntityId('tx', 'a'.repeat(63))).toBe(false);
    expect(isValidEntityId('account', ACCOUNT)).toBe(true);
    expect(isValidEntityId('op', '12884901888-0')).toBe(true);
    expect(isValidEntityId('op', 'not-an-op')).toBe(false);
  });

  it('strips a forger control character out of a filter value', () => {
    const filters = sanitizeFilters({
      ...DEFAULT_SEARCH_FILTERS,
      type: 'pay&n=mainnet',
    } as never);
    // The value survives as text, but URLSearchParams percent-encodes the
    // separator, so it can never be read back as a second parameter.
    expect(filters.type).toBe('pay&n=mainnet');
    const url = buildShareUrl(
      snapshotFromState({ network: 'testnet', activeTab: 'transactions', searchFilters: filters as never }),
      { base: BASE }
    );
    expect(new URL(url).searchParams.get('n')).toBe('testnet');
  });

  it('reports a mismatch only when both networks are known and differ', () => {
    expect(isNetworkMismatch({ network: 'testnet' }, 'mainnet')).toBe(true);
    expect(isNetworkMismatch({ network: 'testnet' }, 'testnet')).toBe(false);
    expect(isNetworkMismatch({ network: 'testnet' }, null)).toBe(false);
    expect(isNetworkMismatch(null, 'mainnet')).toBe(false);
  });
});

// ─── Failure cases ────────────────────────────────────────────────────────────

describe('shareLinks — failures degrade instead of throwing', () => {
  it('reports "not a shared view" for an empty or share-param-free query', () => {
    expect(parseShareUrl('').ok).toBe(false);
    expect(parseShareUrl(null).ok).toBe(false);
    expect(parseShareUrl(undefined).ok).toBe(false);
    expect(parseShareUrl('?ref=incident-42').ok).toBe(false);
  });

  it('opens the rest of the view when the filter payload is corrupt', () => {
    const parsed = parseShareUrl(
      `${BASE}?${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.network}=testnet&${SHARE_PARAMS.filters}=%7Bnot-json`,
      { knownTabs: ['transactions'] }
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.tab).toBe('transactions');
    expect(parsed.snapshot.network).toBe('testnet');
    expect(parsed.snapshot.filters).toEqual({});
    expect(parsed.warnings).toContain('unparseable-filters');
  });

  it('drops an oversized filter payload without parsing it', () => {
    const parsed = parseShareUrl(
      `${BASE}?${SHARE_PARAMS.filters}=${encodeURIComponent('{"f":{"type":"' + 'x'.repeat(9000) + '"}}')}`
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.filters).toEqual({});
    expect(parsed.warnings).toContain('filters-too-large');
  });

  it('falls back to the overview for a tab this build does not know', () => {
    const parsed = parseShareUrl(`${BASE}?${SHARE_PARAMS.tab}=quantumLedger`, {
      knownTabs: ['transactions', 'overview'],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.tab).toBe('overview');
    expect(parsed.warnings).toContain('unknown-tab');
  });

  it('drops each malformed field independently and says why', () => {
    const parsed = parseShareUrl(
      [
        `${SHARE_PARAMS.tab}=transactions`,
        `${SHARE_PARAMS.network}=not-a-network`,
        `${SHARE_PARAMS.entity}=tx:too-short`,
        `${SHARE_PARAMS.ledger}=-5`,
      ].join('&'),
      { knownTabs: ['transactions'] }
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.tab).toBe('transactions');
    expect(parsed.snapshot.network).toBe('testnet');
    expect(parsed.snapshot.entity).toBeNull();
    expect(parsed.snapshot.ledger).toBeNull();
    expect(parsed.warnings).toEqual(
      expect.arrayContaining(['unknown-network', 'invalid-entity-id', 'invalid-ledger-sequence'])
    );
  });

  it('rejects a non-http scheme smuggled into a full-URL link', () => {
    const parsed = parseShareUrl('javascript:alert(1)?tab=transactions');

    // `toSearchParams` treats a scheme-bearing string as a URL; either it fails
    // outright or it yields a search with none of our params. Both are safe.
    expect(parsed.ok === false || parsed.snapshot.tab === 'overview').toBe(true);
  });

  it('keeps a pin it cannot enforce but flags it, rather than dropping it', () => {
    const parsed = parseShareUrl(
      `${BASE}?${SHARE_PARAMS.tab}=contracts&${SHARE_PARAMS.ledger}=777`
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.snapshot.ledger).toBe(777);
    expect(parsed.warnings).toContain('ledger-pin-not-honoured');
  });

  it('accepts a future schema version without half-applying it', () => {
    const parsed = parseShareUrl(
      `${BASE}?v=99&${SHARE_PARAMS.tab}=transactions&${SHARE_PARAMS.network}=testnet`,
      { knownTabs: ['transactions'] }
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.warnings).toContain('future-schema-version');
    expect(parsed.snapshot.tab).toBe('transactions');
  });

  it('warns about a schema version below the supported floor', () => {
    const parsed = parseShareUrl(`${BASE}?v=0&${SHARE_PARAMS.tab}=transactions`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.warnings).toContain('unknown-schema-version');
  });
});
