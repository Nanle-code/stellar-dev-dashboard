import { describe, expect, it, vi } from 'vitest';
import {
  CIRCULAR,
  REDACTED,
  TRUNCATED,
  UNREPRESENTABLE,
  containsSensitiveValue,
  isMnemonic,
  isSignedXdr,
  isSensitiveKey,
  isStellarSecretKey,
  redactError,
  redactString,
  redactUrl,
  redactValue,
  withRedaction,
} from '../redact';

const SECRET_KEY = `S${'A'.repeat(55)}`;
const SHORT_KEY = `S${'A'.repeat(54)}`;
const SIGNED_XDR = `AAAA${'A'.repeat(120)}`;
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const MNEMONIC = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
const BEARER = 'Bearer abcdefghijklmnopqrstuvwxyz';

describe('value-shape detectors', () => {
  it('recognises Stellar secret keys exactly', () => {
    expect(isStellarSecretKey(SECRET_KEY)).toBe(true);
    expect(isStellarSecretKey(SHORT_KEY)).toBe(false);
    expect(isStellarSecretKey(`s${'A'.repeat(55)}`)).toBe(false);
  });

  it('recognises signed XDR envelopes', () => {
    expect(isSignedXdr(SIGNED_XDR)).toBe(true);
    expect(isSignedXdr(`AAAA${'A'.repeat(40)}`)).toBe(false);
    expect(isSignedXdr('not-xdr')).toBe(false);
  });

  it('recognises mnemonics only at valid word counts', () => {
    expect(isMnemonic(MNEMONIC)).toBe(true);
    expect(isMnemonic(MNEMONIC.split(' ').slice(0, 11).join(' '))).toBe(false);
  });
});

describe('key heuristics', () => {
  it('flags camelCase and snake_case credential keys', () => {
    expect(isSensitiveKey('secretKey')).toBe(true);
    expect(isSensitiveKey('access_token')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('Authorization')).toBe(true);
  });

  it('leaves ordinary keys alone', () => {
    expect(isSensitiveKey('contractId')).toBe(false);
    expect(isSensitiveKey('functionName')).toBe(false);
    expect(isSensitiveKey('publicKey')).toBe(false);
  });
});

describe('redactValue — primary flow', () => {
  it('replaces sensitive keys and scrubs nested secrets', () => {
    const input = {
      contractId: 'CCABCD123',
      secretKey: SECRET_KEY,
      signedXdr: SIGNED_XDR,
      recoveryPhrase: MNEMONIC,
      headers: { Authorization: BEARER },
      nested: { note: `key is ${SECRET_KEY}`, jwt: JWT },
    };

    const out = redactValue<Record<string, unknown>>(input);

    expect(out.contractId).toBe('CCABCD123');
    expect(out.secretKey).toBe(REDACTED);
    expect(out.signedXdr).toBe(REDACTED);
    expect(out.recoveryPhrase).toBe(REDACTED);
    expect((out.headers as Record<string, unknown>).Authorization).toBe(REDACTED);
    expect((out.nested as Record<string, unknown>).note).not.toContain(SECRET_KEY);
    expect((out.nested as Record<string, unknown>).jwt).not.toContain(JWT);
    expect(JSON.stringify(out)).not.toContain(SECRET_KEY);
    expect(JSON.stringify(out)).not.toContain(SIGNED_XDR);
  });

  it('scrubs provider API keys by value shape', () => {
    const out = redactValue<Record<string, string>>({
      a: `sk_live_${'a'.repeat(24)}`,
      b: `ghp_${'B'.repeat(30)}`,
      c: `github_pat_${'C'.repeat(30)}`,
    });
    expect(out.a).toBe(REDACTED);
    expect(out.b).toBe(REDACTED);
    expect(out.c).toBe(REDACTED);
  });
});

describe('redactValue — boundary cases', () => {
  it('keeps non-sensitive values and near-miss strings intact', () => {
    const out = redactValue<Record<string, unknown>>({
      short: SHORT_KEY,
      shortXdr: `AAAA${'A'.repeat(40)}`,
      elevenWords: MNEMONIC.split(' ').slice(0, 11).join(' '),
      count: 42,
      ok: true,
      nothing: null,
    });
    expect(out.short).toBe(SHORT_KEY);
    expect(out.shortXdr).toBe(`AAAA${'A'.repeat(40)}`);
    expect(out.elevenWords).toBe(MNEMONIC.split(' ').slice(0, 11).join(' '));
    expect(out.count).toBe(42);
    expect(out.ok).toBe(true);
    expect(out.nothing).toBeNull();
  });

  it('truncates at maxDepth instead of recursing forever', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let i = 0; i < 12; i++) deep = { child: deep };
    const out = redactValue<Record<string, unknown>>(deep, { maxDepth: 3 });
    expect(JSON.stringify(out)).toContain(TRUNCATED);
  });

  it('truncates very long strings', () => {
    const out = redactValue<string>('x'.repeat(500), { maxStringLength: 50 });
    expect(out.length).toBe(50 + TRUNCATED.length);
    expect(out.endsWith(TRUNCATED)).toBe(true);
  });

  it('replaces credential query params in URLs without touching the rest', () => {
    const out = redactUrl('https://api.example.com/cb?token=abc123&network=testnet');
    expect(out).not.toContain('abc123');
    expect(out).toContain('network=testnet');
    expect(redactUrl('not a url')).toBe('not a url');
  });

  it('scrubs embedded secrets in free-form strings', () => {
    expect(redactString(`boom ${SECRET_KEY} tail`)).toBe(`boom ${REDACTED} tail`);
    expect(redactString('nothing to see')).toBe('nothing to see');
  });
});

describe('redactValue — failure paths', () => {
  it('replaces circular references', () => {
    const obj: Record<string, unknown> = { id: 1 };
    obj.self = obj;
    expect(redactValue<Record<string, unknown>>(obj).self).toBe(CIRCULAR);
  });

  it('redacts error messages and stacks', () => {
    const err = new Error(`leaked ${SECRET_KEY}`);
    err.stack = `Error: leaked ${SECRET_KEY}\n    at thing`;
    const out = redactError(err);
    expect(out.message).not.toContain(SECRET_KEY);
    expect(out.stack).not.toContain(SECRET_KEY);
    expect(out.name).toBe('Error');
  });

  it('never throws on malformed or hostile input', () => {
    expect(redactValue(null)).toBeNull();
    expect(redactValue(undefined)).toBeUndefined();
    expect(redactValue(() => undefined)).toBe(UNREPRESENTABLE);
    expect(redactValue(Symbol('x'))).toBe(UNREPRESENTABLE);

    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'boom', {
      enumerable: true,
      get() {
        throw new Error('getter exploded');
      },
    });
    expect(() => redactValue(hostile)).not.toThrow();
  });

  it('reports whether a payload still contains secrets', () => {
    expect(containsSensitiveValue({ a: SECRET_KEY })).toBe(true);
    expect(containsSensitiveValue({ a: 'safe' })).toBe(false);
  });
});

describe('withRedaction', () => {
  it('redacts context and errors before delegating to the logger', () => {
    const base = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const logger = withRedaction(base);

    logger.error(`failed ${SECRET_KEY}`, { secretKey: SECRET_KEY, contractId: 'CC1' }, new Error(`bad ${SIGNED_XDR}`));

    const [msg, ctx, err] = base.error.mock.calls[0];
    expect(String(msg)).not.toContain(SECRET_KEY);
    expect(ctx).toEqual({ secretKey: REDACTED, contractId: 'CC1' });
    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).not.toContain('AAAA');
  });
});
