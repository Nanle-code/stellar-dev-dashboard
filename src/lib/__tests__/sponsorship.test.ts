import { describe, expect, it } from 'vitest';
import {
  BASE_RESERVE_STROOPS,
  analyzeSponsorship,
  formatStroopsAsXlm,
  reserveImpactXlm,
} from '../sponsorship';

const SPONSOR_A = 'G'.repeat(56);
const SPONSOR_B = 'A'.repeat(56);

const FULL_ACCOUNT = {
  account_id: 'GACCOUNT0000000000000000000000000000000000000000000000000',
  subentry_count: 5,
  num_sponsoring: 2, // my entries paid by others
  num_sponsored: 1, // entries I pay for others
  signers: [{ key: 'GSIGNER1', sponsor: SPONSOR_B }],
  balances: [
    { asset_type: 'native' },
    { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'GISSUER', sponsor: SPONSOR_A },
  ],
};

describe('analyzeSponsorship — primary flow', () => {
  it('derives counts, sponsors, entries and reserve impact', () => {
    const analysis = analyzeSponsorship(FULL_ACCOUNT);

    expect(analysis.degraded).toBe(false);
    expect(analysis.sponsoredEntryCount).toBe(2);
    expect(analysis.sponsoringEntryCount).toBe(1);
    expect(analysis.sponsoringAccounts).toEqual([SPONSOR_A, SPONSOR_B].sort());
    expect(analysis.sponsoredEntries.map((e) => e.type).sort()).toEqual(['signer', 'trustline']);

    // (2 base + 5 subentries) * base reserve
    expect(analysis.reserve.grossReserveStroops).toBe(7 * BASE_RESERVE_STROOPS);
    expect(analysis.reserve.reliefStroops).toBe(2 * BASE_RESERVE_STROOPS);
    expect(analysis.reserve.residualReserveStroops).toBe(5 * BASE_RESERVE_STROOPS);
    expect(analysis.reserve.providedReserveStroops).toBe(1 * BASE_RESERVE_STROOPS);
  });

  it('formats stroops and provides an XLM view', () => {
    expect(formatStroopsAsXlm(BASE_RESERVE_STROOPS)).toBe('0.5000000');
    const xlm = reserveImpactXlm(analyzeSponsorship(FULL_ACCOUNT).reserve);
    expect(xlm.residual).toBe(2.5);
    expect(xlm.gross).toBe(3.5);
  });
});

describe('analyzeSponsorship — boundary cases', () => {
  it('caps relief at the gross reserve', () => {
    const analysis = analyzeSponsorship({ account_id: 'GX', num_sponsoring: 100, subentry_count: 0 });
    expect(analysis.reserve.grossReserveStroops).toBe(2 * BASE_RESERVE_STROOPS);
    expect(analysis.reserve.reliefStroops).toBe(2 * BASE_RESERVE_STROOPS);
    expect(analysis.reserve.residualReserveStroops).toBe(0);
  });

  it('treats negative and non-numeric counts as zero', () => {
    const analysis = analyzeSponsorship({
      account_id: 'GX',
      num_sponsoring: -4,
      num_sponsored: 'lots',
      subentry_count: Number.NaN,
    });
    expect(analysis.sponsoredEntryCount).toBe(0);
    expect(analysis.sponsoringEntryCount).toBe(0);
    expect(analysis.reserve.grossReserveStroops).toBe(2 * BASE_RESERVE_STROOPS);
  });

  it('ignores malformed signers/balances and falls back to the default base reserve', () => {
    const analysis = analyzeSponsorship({
      account_id: 'GX',
      num_sponsoring: 1,
      signers: [null, { key: 'GS' }, 'nope'],
      balances: [null, { asset_type: 'native' }],
    });
    expect(analysis.sponsoredEntries).toEqual([]);
    expect(analysis.sponsoringAccounts).toEqual([]);
  });
});

describe('analyzeSponsorship — failure paths', () => {
  it('degrades gracefully for invalid records', () => {
    for (const input of [null, undefined, 42, 'account', []]) {
      const analysis = analyzeSponsorship(input);
      expect(analysis.degraded).toBe(true);
      expect(analysis.warnings.length).toBeGreaterThan(0);
      expect(analysis.reserve.residualReserveStroops).toBe(0);
    }
  });

  it('flags a record with no account_id but still computes reserves', () => {
    const analysis = analyzeSponsorship({ subentry_count: 1 });
    expect(analysis.accountId).toBeNull();
    expect(analysis.degraded).toBe(true);
    expect(analysis.reserve.grossReserveStroops).toBe(3 * BASE_RESERVE_STROOPS);
  });
});
