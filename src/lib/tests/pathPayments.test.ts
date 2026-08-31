import { afterEach, describe, expect, it, vi } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  fetchPaymentPaths,
  type PaymentPathRecord,
} from '../stellar';

const issuer = StellarSdk.Keypair.random().publicKey();
const creditAsset = { type: 'credit' as const, code: 'USDC', issuer };

function record(sourceAmount: string, destinationAmount: string): PaymentPathRecord {
  return {
    source_asset_type: 'native',
    source_amount: sourceAmount,
    destination_asset_type: 'credit_alphanum4',
    destination_asset_code: 'USDC',
    destination_asset_issuer: issuer,
    destination_amount: destinationAmount,
    path: [],
  };
}

afterEach(() => vi.restoreAllMocks());

describe('fetchPaymentPaths quote modes', () => {
  it('quotes strict-send and ranks the largest destination amount first', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      _embedded: { records: [record('10', '8'), record('10', '9')] },
    }), { status: 200 }));

    const quotes = await fetchPaymentPaths({
      sourceAsset: { type: 'native', code: 'XLM' },
      destAsset: creditAsset,
      amount: '10',
      mode: 'strict-send',
      network: 'testnet',
    });

    expect(fetchMock.mock.calls[0][0]).toContain('/paths/strict-send?');
    expect(quotes.map((quote) => quote.destination_amount)).toEqual(['9', '8']);
    expect(quotes[0].slippagePct).toBe('0.00');
  });

  it('quotes strict-receive and ranks the smallest source amount first', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      _embedded: { records: [record('12', '10'), record('11', '10')] },
    }), { status: 200 }));

    const quotes = await fetchPaymentPaths({
      sourceAsset: { type: 'native', code: 'XLM' },
      destAsset: creditAsset,
      amount: '10.0000000',
      mode: 'strict-receive',
      network: 'mainnet',
    });

    expect(quotes.map((quote) => quote.source_amount)).toEqual(['11', '12']);
    expect(quotes[1].slippagePct).toBe('9.09');
  });

  it('rejects invalid amounts and issuers before contacting Horizon', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(fetchPaymentPaths({
      sourceAsset: { type: 'native', code: 'XLM' },
      destAsset: { type: 'credit', code: 'USDC', issuer: 'invalid' },
      amount: '0',
      mode: 'strict-send',
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a stable failure when Horizon is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    await expect(fetchPaymentPaths({
      sourceAsset: { type: 'native', code: 'XLM' },
      destAsset: creditAsset,
      amount: '1',
      mode: 'strict-send',
    })).rejects.toEqual(expect.objectContaining({
      code: 'REQUEST_FAILED',
    }));
  });
});
