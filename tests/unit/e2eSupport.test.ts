import { describe, it, expect } from 'vitest';
import {
  buildHorizonAccount,
  buildPaymentRecord,
  buildSubmitFailure,
  buildSubmitSuccess,
  buildTransactionRecord,
  horizonPage,
  testKeypair,
  testTxHash,
} from '../e2e/support/dataFactories';
import {
  checkContractId,
  checkShortAddressOf,
  checkStellarAmount,
  checkStellarPublicKey,
  checkTransactionHash,
} from '../e2e/support/stellarAssertions';
import { createSorobanFixtureFactory } from '../__factories__/sorobanContractFixtures';

describe('E2E data factories (#405)', () => {
  it('derives stable, valid keys and hashes from labels', () => {
    expect(testKeypair('alice').publicKey()).toBe(testKeypair('alice').publicKey());
    expect(testKeypair('alice').publicKey()).not.toBe(testKeypair('bob').publicKey());
    expect(checkStellarPublicKey(testKeypair('alice').publicKey()).pass).toBe(true);
    expect(checkTransactionHash(testTxHash('x')).pass).toBe(true);
    expect(() => testKeypair('')).toThrow(/non-empty/);
  });

  it('builds a Horizon account with native and credit balances', () => {
    const issuer = testKeypair('issuer').publicKey();
    const account = buildHorizonAccount({
      seed: 'alice',
      balances: [
        { asset: 'native', balance: '12.5000000' },
        { asset: { code: 'USDC', issuer }, balance: '3.0000000' },
        { asset: { code: 'LONGASSET', issuer }, balance: '1.0000000' },
      ],
    });
    expect(account.account_id).toBe(testKeypair('alice').publicKey());
    expect(account.balances.map((b) => b.asset_type)).toEqual(['native', 'credit_alphanum4', 'credit_alphanum12']);
    expect(account.subentry_count).toBe(2);
    for (const b of account.balances) expect(checkStellarAmount(b.balance).pass).toBe(true);
  });

  it('builds transaction, payment and submit payloads', () => {
    const from = testKeypair('a').publicKey();
    const to = testKeypair('b').publicKey();
    expect(buildTransactionRecord('t1', from).hash).toBe(testTxHash('t1'));
    expect(buildPaymentRecord('t1', from, to)).toMatchObject({ from, to, transaction_hash: testTxHash('t1') });
    expect(horizonPage([1, 2])._embedded.records).toEqual([1, 2]);
    expect(checkTransactionHash(buildSubmitSuccess().hash).pass).toBe(true);
    expect(buildSubmitFailure('op_no_destination').extras.result_codes.operations).toEqual(['op_no_destination']);
  });
});

describe('Stellar assertion predicates (#405)', () => {
  const key = testKeypair('alice').publicKey();

  it('accepts valid and rejects invalid public keys', () => {
    expect(checkStellarPublicKey(key)).toMatchObject({ pass: true });
    // Right shape, broken checksum.
    const tampered = key.slice(0, -1) + (key.endsWith('A') ? 'B' : 'A');
    expect(checkStellarPublicKey(tampered).pass).toBe(false);
    expect(checkStellarPublicKey(42).message).toMatch(/to be a valid Stellar public key/);
  });

  it('validates contract ids', () => {
    expect(checkContractId(createSorobanFixtureFactory().contractId).pass).toBe(true);
    expect(checkContractId(key).pass).toBe(false);
  });

  it.each([
    ['0', true],
    ['1,000.5', true],
    ['0.0000001', true],
    ['922337203685.4775807', true],
    ['922337203685.4775808', false],
    ['1.00000001', false],
    ['-1', false],
    ['abc', false],
  ])('amount %s → %s', (value, pass) => {
    expect(checkStellarAmount(value).pass).toBe(pass);
  });

  it('matches shortened addresses against the full key', () => {
    expect(checkShortAddressOf(`${key.slice(0, 4)}…${key.slice(-4)}`, key).pass).toBe(true);
    expect(checkShortAddressOf(`${key.slice(0, 6)}...${key.slice(-6)}`, key).pass).toBe(true);
    expect(checkShortAddressOf('GAAA…ZZZZ', key).pass).toBe(false);
    expect(checkShortAddressOf(null, key).pass).toBe(false);
  });
});
