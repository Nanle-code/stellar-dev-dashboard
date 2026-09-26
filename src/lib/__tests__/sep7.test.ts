import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  SEP7_MAX_CHAIN_DEPTH,
  Sep7Error,
  buildSep7PayUri,
  buildSep7TxUri,
  openSep7Uri,
  parseSep7Uri,
  signSep7Uri,
  validateSep7Uri,
  verifySep7Signature,
} from '../sep7';

// Fixtures taken from the SEP-0007 spec examples.
const TX_XDR =
  'AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAYAAAABSFVHAAAAAABAH0wIyY3BJBS2qHdRPAV80M8hF7NBpxRjXyjuT9kEbH//////////AAAAAAAAAAA=';
const DESTINATION = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
const ISSUER = 'GCRCUE2C5TBNIPYHMEP7NK5RWTT2WBSZ75CMARH7GDOHDDCQH3XANFOB';
const SPEC_SIGNER = Keypair.fromSecret('SBPOVRVKTTV7W3IOX2FJPSMPCJ5L2WU2YKTP3HCLYPXNI5MDIGREVNYC');
const SPEC_UNSIGNED_URI =
  'web+stellar:pay?destination=GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO&amount=120.1234567&memo=skdjfasf&memo_type=MEMO_TEXT&msg=pay%20me%20with%20lumens&origin_domain=someDomain.com';
const SPEC_SIGNATURE =
  'tbsLtlK%2FfouvRWk2UWFP47yHYeI1g1NEC%2FfEQvuXG6V8P%2BbeLxplYbOVtTk1g94Wp97cHZ3pVJy%2FtZNYobl3Cw%3D%3D';

function issueParams(uri: string): Array<string | undefined> {
  return validateSep7Uri(uri).issues.map((issue) => issue.param);
}

describe('buildSep7PayUri', () => {
  it('matches the spec example for a lumens payment request', () => {
    const uri = buildSep7PayUri({
      destination: DESTINATION,
      amount: '120.1234567',
      memo: 'skdjfasf',
      memoType: 'MEMO_TEXT',
      msg: 'pay me with lumens',
    });

    expect(uri).toBe(
      'web+stellar:pay?destination=GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO&amount=120.1234567&memo=skdjfasf&memo_type=MEMO_TEXT&msg=pay%20me%20with%20lumens'
    );
  });

  it('matches the spec example for an asset payment with callback', () => {
    const uri = buildSep7PayUri({
      destination: DESTINATION,
      amount: '120.123',
      assetCode: 'USD',
      assetIssuer: ISSUER,
      memo: 'hasysda987fs',
      memoType: 'MEMO_TEXT',
      callback: 'https://someSigningService.com/hasysda987fs?asset=USD',
    });

    expect(uri).toBe(
      'web+stellar:pay?destination=GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO&amount=120.123&asset_code=USD&asset_issuer=GCRCUE2C5TBNIPYHMEP7NK5RWTT2WBSZ75CMARH7GDOHDDCQH3XANFOB&memo=hasysda987fs&memo_type=MEMO_TEXT&callback=url%3Ahttps%3A%2F%2FsomeSigningService.com%2Fhasysda987fs%3Fasset%3DUSD'
    );
  });

  it('defaults memo_type to MEMO_TEXT and omits empty optional fields', () => {
    const uri = buildSep7PayUri({ destination: DESTINATION, memo: 'order 42', amount: '' });
    expect(uri).toBe(
      `web+stellar:pay?destination=${DESTINATION}&memo=order%2042&memo_type=MEMO_TEXT`
    );
  });

  it('accepts the largest representable amount and rejects one stroop more', () => {
    expect(() =>
      buildSep7PayUri({ destination: DESTINATION, amount: '922337203685.4775807' })
    ).not.toThrow();
    expect(() =>
      buildSep7PayUri({ destination: DESTINATION, amount: '922337203685.4775808' })
    ).toThrow(Sep7Error);
  });

  it('accepts a 300 character msg and rejects 301', () => {
    expect(() => buildSep7PayUri({ destination: DESTINATION, msg: 'm'.repeat(300) })).not.toThrow();
    expect(() => buildSep7PayUri({ destination: DESTINATION, msg: 'm'.repeat(301) })).toThrow(
      /at most 300/
    );
  });

  it('rejects an invalid destination with a coded error', () => {
    try {
      buildSep7PayUri({ destination: 'GNOTAKEY', amount: '10' });
      throw new Error('expected build to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Sep7Error);
      expect((error as Sep7Error).code).toBe('INVALID_PARAM');
      expect((error as Sep7Error).issues[0].param).toBe('destination');
    }
  });

  it('accepts muxed and federation destinations', () => {
    const muxed = 'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ';
    expect(() => buildSep7PayUri({ destination: muxed })).not.toThrow();
    expect(() => buildSep7PayUri({ destination: 'alice*example.com' })).not.toThrow();
    expect(() => buildSep7PayUri({ destination: 'alice*localhost' })).toThrow(Sep7Error);
  });

  it('requires an issuer for non-native assets', () => {
    expect(() => buildSep7PayUri({ destination: DESTINATION, assetCode: 'USD' })).toThrow(
      /asset_issuer/
    );
    expect(() => buildSep7PayUri({ destination: DESTINATION, assetCode: 'XLM' })).not.toThrow();
    expect(() => buildSep7PayUri({ destination: DESTINATION, assetIssuer: ISSUER })).toThrow(
      /asset_code/
    );
  });

  it('checks memo values against their memo_type', () => {
    const hash = btoa(String.fromCharCode(...new Array(32).fill(7)));
    expect(() =>
      buildSep7PayUri({ destination: DESTINATION, memo: hash, memoType: 'MEMO_HASH' })
    ).not.toThrow();
    expect(() =>
      buildSep7PayUri({ destination: DESTINATION, memo: 'abc', memoType: 'MEMO_HASH' })
    ).toThrow(/32 bytes/);
    expect(() =>
      buildSep7PayUri({
        destination: DESTINATION,
        memo: '18446744073709551615',
        memoType: 'MEMO_ID',
      })
    ).not.toThrow();
    expect(() =>
      buildSep7PayUri({
        destination: DESTINATION,
        memo: '18446744073709551616',
        memoType: 'MEMO_ID',
      })
    ).toThrow(/64-bit/);
    expect(() => buildSep7PayUri({ destination: DESTINATION, memo: 'x'.repeat(29) })).toThrow(
      /28 bytes/
    );
  });
});

describe('buildSep7TxUri', () => {
  it('matches the spec example for a tx request with callback, pubkey and msg', () => {
    const uri = buildSep7TxUri({
      xdr: TX_XDR,
      callback: 'url:https://someSigningService.com/a8f7asdfkjha',
      pubkey: 'GAU2ZSYYEYO5S5ZQSMMUENJ2TANY4FPXYGGIMU6GMGKTNVDG5QYFW6JS',
      msg: 'order number 24',
    });

    expect(uri).toBe(
      'web+stellar:tx?xdr=AAAAAP%2Byw%2BZEuNg533pUmwlYxfrq6%2FBoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAYAAAABSFVHAAAAAABAH0wIyY3BJBS2qHdRPAV80M8hF7NBpxRjXyjuT9kEbH%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FAAAAAAAAAAA%3D&callback=url%3Ahttps%3A%2F%2FsomeSigningService.com%2Fa8f7asdfkjha&pubkey=GAU2ZSYYEYO5S5ZQSMMUENJ2TANY4FPXYGGIMU6GMGKTNVDG5QYFW6JS&msg=order%20number%2024'
    );
  });

  it('matches the spec example for a replace request', () => {
    const uri = buildSep7TxUri({
      xdr: TX_XDR,
      replace: 'sourceAccount:X;X:account on which to create the trustline',
    });
    expect(uri).toContain(
      '&replace=sourceAccount%3AX%3BX%3Aaccount%20on%20which%20to%20create%20the%20trustline'
    );
  });

  it('rejects unbalanced replace identifiers', () => {
    expect(() => buildSep7TxUri({ xdr: TX_XDR, replace: 'sourceAccount:X;Y:The account' })).toThrow(
      /replace/
    );
  });

  it('rejects xdr that is not a transaction envelope', () => {
    expect(() => buildSep7TxUri({ xdr: 'bm90IHhkcg==' })).toThrow(/TransactionEnvelope/);
  });

  it('rejects non-https callbacks except on localhost', () => {
    expect(() => buildSep7TxUri({ xdr: TX_XDR, callback: 'http://evil.example.com/cb' })).toThrow(
      /callback/
    );
    expect(() => buildSep7TxUri({ xdr: TX_XDR, callback: 'javascript:alert(1)' })).toThrow(
      /callback/
    );
    expect(() =>
      buildSep7TxUri({ xdr: TX_XDR, callback: 'http://localhost:5173/wallet' })
    ).not.toThrow();
  });

  it('validates a nested chain request', () => {
    const inner = buildSep7TxUri({ xdr: TX_XDR });
    expect(() => buildSep7TxUri({ xdr: TX_XDR, chain: inner })).not.toThrow();
    expect(() => buildSep7TxUri({ xdr: TX_XDR, chain: 'https://example.com' })).toThrow(/chain/);
  });

  it(`rejects chains nested deeper than ${SEP7_MAX_CHAIN_DEPTH} levels`, () => {
    let uri = buildSep7TxUri({ xdr: TX_XDR });
    for (let level = 1; level <= SEP7_MAX_CHAIN_DEPTH; level += 1) {
      uri = buildSep7TxUri({ xdr: TX_XDR, chain: uri });
    }
    expect(() => buildSep7TxUri({ xdr: TX_XDR, chain: uri })).toThrow(/nested/);
  });

  it('round-trips through the parser with + and / intact', () => {
    const uri = buildSep7TxUri({
      xdr: TX_XDR,
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    const parsed = parseSep7Uri(uri);
    expect(parsed.operation).toBe('tx');
    expect(parsed.params.xdr).toBe(TX_XDR);
    expect(parsed.params.network_passphrase).toBe('Test SDF Network ; September 2015');
  });
});

describe('parseSep7Uri', () => {
  it('rejects other schemes and unsupported operations', () => {
    expect(() => parseSep7Uri('stellar:pay?destination=x')).toThrow(/web\+stellar:/);
    expect(() => parseSep7Uri('web+stellar:swap?x=1')).toThrow(Sep7Error);
  });

  it('rejects duplicate params and broken percent-encoding', () => {
    expect(() =>
      parseSep7Uri(`web+stellar:pay?destination=${DESTINATION}&destination=${ISSUER}`)
    ).toThrow(/more than once/);
    expect(() => parseSep7Uri('web+stellar:pay?destination=%E0%A4%A')).toThrow(/URL encoding/);
  });

  it('reports params the spec does not define', () => {
    const parsed = parseSep7Uri(`web+stellar:pay?destination=${DESTINATION}&foo=bar`);
    expect(parsed.unknownParams).toEqual(['foo']);
  });

  it('stores a __proto__ key as a plain param', () => {
    const parsed = parseSep7Uri(`web+stellar:pay?destination=${DESTINATION}&__proto__=x`);
    expect(parsed.params.__proto__).toBe('x');
    expect(parsed.unknownParams).toEqual(['__proto__']);
  });
});

describe('validateSep7Uri', () => {
  it('returns every issue instead of throwing', () => {
    const result = validateSep7Uri('web+stellar:pay?amount=-1&memo_type=MEMO_FOO');
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.param)).toEqual([
      'destination',
      'amount',
      'memo_type',
    ]);
  });

  it('reports a structural error without a parsed request', () => {
    const result = validateSep7Uri('https://example.com');
    expect(result.valid).toBe(false);
    expect(result.request).toBeNull();
    expect(result.issues[0].code).toBe('INVALID_SCHEME');
  });

  it('requires a signature whenever origin_domain is present', () => {
    expect(issueParams(SPEC_UNSIGNED_URI)).toEqual(['signature']);
  });

  it('rejects a signature that is not the last param', () => {
    const uri = `web+stellar:pay?destination=${DESTINATION}&origin_domain=someDomain.com&signature=${SPEC_SIGNATURE}&msg=hi`;
    expect(issueParams(uri)).toContain('signature');
  });

  it('rejects an invalid origin_domain', () => {
    const uri = `web+stellar:pay?destination=${DESTINATION}&origin_domain=not_a_domain&signature=${SPEC_SIGNATURE}`;
    expect(issueParams(uri)).toContain('origin_domain');
  });
});

describe('request signing', () => {
  it('reproduces the spec signature for the spec example', () => {
    expect(signSep7Uri(SPEC_UNSIGNED_URI, SPEC_SIGNER)).toBe(
      `${SPEC_UNSIGNED_URI}&signature=${SPEC_SIGNATURE}`
    );
  });

  it('verifies a signed URI and rejects tampering', () => {
    const signed = `${SPEC_UNSIGNED_URI}&signature=${SPEC_SIGNATURE}`;
    expect(validateSep7Uri(signed).valid).toBe(true);
    expect(verifySep7Signature(signed, SPEC_SIGNER.publicKey())).toBe(true);
    expect(verifySep7Signature(signed.replace('120.1234567', '999'), SPEC_SIGNER.publicKey())).toBe(
      false
    );
    expect(verifySep7Signature(signed, Keypair.random().publicKey())).toBe(false);
  });

  it('returns false for unsigned or malformed input instead of throwing', () => {
    expect(verifySep7Signature(SPEC_UNSIGNED_URI, SPEC_SIGNER.publicKey())).toBe(false);
    expect(verifySep7Signature(`${SPEC_UNSIGNED_URI}&signature=%%%`, SPEC_SIGNER.publicKey())).toBe(
      false
    );
    expect(
      verifySep7Signature(`${SPEC_UNSIGNED_URI}&signature=${SPEC_SIGNATURE}`, 'not-a-key')
    ).toBe(false);
  });

  it('refuses to sign without origin_domain, twice, or with a public-only keypair', () => {
    const unsignedNoOrigin = buildSep7PayUri({ destination: DESTINATION });
    expect(() => signSep7Uri(unsignedNoOrigin, SPEC_SIGNER)).toThrow(/origin_domain/);
    const signed = signSep7Uri(SPEC_UNSIGNED_URI, SPEC_SIGNER);
    expect(() => signSep7Uri(signed, SPEC_SIGNER)).toThrow(/already signed/);
    expect(() =>
      signSep7Uri(SPEC_UNSIGNED_URI, Keypair.fromPublicKey(SPEC_SIGNER.publicKey()))
    ).toThrow(/no secret key/);
  });

  it('signs a URI built with originDomain', () => {
    const uri = buildSep7PayUri({
      destination: DESTINATION,
      amount: '5',
      originDomain: 'someDomain.com',
    });
    const signed = signSep7Uri(uri, SPEC_SIGNER);
    expect(validateSep7Uri(signed).valid).toBe(true);
    expect(verifySep7Signature(signed, SPEC_SIGNER.publicKey())).toBe(true);
  });
});

describe('openSep7Uri', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigates to a valid URI', () => {
    const location = { href: 'http://localhost/' };
    vi.stubGlobal('window', { location });
    const uri = buildSep7PayUri({ destination: DESTINATION, amount: '1' });

    openSep7Uri(uri);

    expect(location.href).toBe(uri);
  });

  it('refuses to open an invalid URI', () => {
    const location = { href: 'http://localhost/' };
    vi.stubGlobal('window', { location });

    expect(() => openSep7Uri(SPEC_UNSIGNED_URI)).toThrow(Sep7Error);
    expect(location.href).toBe('http://localhost/');
  });

  it('throws UNSUPPORTED_ENVIRONMENT outside a browser', () => {
    vi.stubGlobal('window', undefined);
    try {
      openSep7Uri(buildSep7PayUri({ destination: DESTINATION }));
      throw new Error('expected open to fail');
    } catch (error) {
      expect((error as Sep7Error).code).toBe('UNSUPPORTED_ENVIRONMENT');
    }
  });
});
