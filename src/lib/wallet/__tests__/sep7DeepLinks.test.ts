import { afterEach, describe, expect, it, vi } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';
import { signWithSEP7 } from '../lobstr';
import { signWithSolarSEP7 } from '../solar';
import { parseSep7Uri, validateSep7Uri } from '../../sep7';

const TX_XDR =
  'AAAAAP+yw+ZEuNg533pUmwlYxfrq6/BoMJqiJ8vuQhf6rHWmAAAAZAB8NHAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAYAAAABSFVHAAAAAABAH0wIyY3BJBS2qHdRPAV80M8hF7NBpxRjXyjuT9kEbH//////////AAAAAAAAAAA=';

function stubMobileBrowser(href: string) {
  const location = { href };
  vi.stubGlobal('window', { location });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
  });
  return location;
}

describe.each([
  ['LOBSTR', signWithSEP7],
  ['Solar', signWithSolarSEP7],
])('%s SEP-0007 deep link', (_wallet, sign) => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a spec-valid tx URI with the page as callback', async () => {
    const location = stubMobileBrowser('https://dashboard.example.com/wallet?tab=sign');

    await expect(sign(TX_XDR, 'PUBLIC')).resolves.toBe('SEP7_PENDING');

    expect(validateSep7Uri(location.href).valid).toBe(true);
    const { operation, params } = parseSep7Uri(location.href);
    expect(operation).toBe('tx');
    expect(params.xdr).toBe(TX_XDR);
    expect(params.network_passphrase).toBe(Networks.PUBLIC);
    expect(params.callback).toBe('url:https://dashboard.example.com/wallet?tab=sign');
  });

  it('refuses to send the signed XDR to a plain-http callback', () => {
    stubMobileBrowser('http://dashboard.example.com/wallet');
    expect(() => sign(TX_XDR, 'TESTNET')).toThrow(/callback/);
  });
});
