/**
 * Stellar-specific assertion predicates for E2E tests (#405).
 *
 * Pure functions (no Playwright import) so they are unit-tested under Vitest
 * (`tests/unit/e2eSupport.test.ts`) and reused by the custom `expect`
 * matchers in `./fixtures.ts`.
 */

import { StrKey } from '@stellar/stellar-sdk';

export interface AssertionResult {
  pass: boolean;
  message: string;
}

const result = (pass: boolean, what: string, received: unknown): AssertionResult => ({
  pass,
  message: pass
    ? `expected ${JSON.stringify(received)} not to be ${what}`
    : `expected ${JSON.stringify(received)} to be ${what}`,
});

/** G… Ed25519 account id with a valid checksum. */
export function checkStellarPublicKey(value: unknown): AssertionResult {
  return result(typeof value === 'string' && StrKey.isValidEd25519PublicKey(value), 'a valid Stellar public key (G…)', value);
}

/** C… Soroban contract id with a valid checksum. */
export function checkContractId(value: unknown): AssertionResult {
  return result(typeof value === 'string' && StrKey.isValidContract(value), 'a valid Soroban contract id (C…)', value);
}

/** 64-character lowercase hex transaction hash. */
export function checkTransactionHash(value: unknown): AssertionResult {
  return result(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value), 'a transaction hash (64 hex chars)', value);
}

/**
 * Stellar amount as displayed or sent to Horizon: non-negative, at most 7
 * decimal places, and within the int64 stroop range.
 */
export function checkStellarAmount(value: unknown): AssertionResult {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string') return result(false, 'a Stellar amount', value);
  const normalized = text.replace(/,/g, '').trim();
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(normalized);
  if (!match) return result(false, 'a Stellar amount (≤ 7 decimals)', value);
  const stroops = BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  return result(stroops <= 9_223_372_036_854_775_807n, 'a Stellar amount within int64 stroops', value);
}

/**
 * Shortened address as rendered in the UI (e.g. `GABC…WXYZ` or `GABC...WXYZ`)
 * matching the given full address.
 */
export function checkShortAddressOf(value: unknown, fullAddress: string): AssertionResult {
  if (typeof value !== 'string') return result(false, `a shortened form of ${fullAddress}`, value);
  const match = /^([A-Z0-9]{3,12})(?:…|\.{3})([A-Z0-9]{3,12})$/.exec(value.trim());
  const pass = !!match && fullAddress.startsWith(match[1]) && fullAddress.endsWith(match[2]);
  return result(pass, `a shortened form of ${fullAddress}`, value);
}
