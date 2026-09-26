import { describe, expect, it } from 'vitest';
import { classifySensitiveValue, confirmationPromptFor, isSensitiveValue } from '../sensitiveValue';

const SECRET = 'S' + 'A'.repeat(55);
const XDR = 'AAAAAgAAAAB' + 'A'.repeat(120);
const MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('classifySensitiveValue', () => {
  it('flags Stellar secret keys', () => {
    const verdict = classifySensitiveValue(SECRET);
    expect(verdict.sensitive).toBe(true);
    expect(verdict.kind).toBe('secret-key');
  });

  it('flags transaction envelopes (XDR)', () => {
    const verdict = classifySensitiveValue(XDR);
    expect(verdict.sensitive).toBe(true);
    expect(['signed-xdr', 'unsigned-xdr']).toContain(verdict.kind);
  });

  it('flags recovery phrases', () => {
    const verdict = classifySensitiveValue(MNEMONIC);
    expect(verdict.sensitive).toBe(true);
    expect(verdict.kind).toBe('mnemonic');
  });

  it('flags JWT / bearer tokens', () => {
    const verdict = classifySensitiveValue(
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signaturepart'
    );
    expect(verdict.kind).toBe('jwt');
  });
});

describe('classifySensitiveValue — boundary cases', () => {
  it('treats a normal public key as non-sensitive', () => {
    expect(isSensitiveValue('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')).toBe(false);
  });

  it('treats short base64 as non-sensitive', () => {
    expect(isSensitiveValue('AAAA')).toBe(false);
  });

  it('honours an explicit sensitive flag for unknown formats', () => {
    const verdict = classifySensitiveValue('opaque-value', true);
    expect(verdict.sensitive).toBe(true);
  });

  it('never throws on invalid input', () => {
    expect(classifySensitiveValue(null).sensitive).toBe(false);
    expect(classifySensitiveValue(42 as unknown as string).kind).toBe('none');
    expect(classifySensitiveValue('').kind).toBe('none');
  });
});

describe('confirmationPromptFor', () => {
  it('returns a kind-specific warning', () => {
    expect(confirmationPromptFor(classifySensitiveValue(SECRET))).toMatch(/secret key/i);
    expect(confirmationPromptFor({ sensitive: true, kind: 'none', reason: '' })).toMatch(/sensitive/i);
  });
});
