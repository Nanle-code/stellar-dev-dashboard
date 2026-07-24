import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isValidPublicKey,
  validateThresholds,
  parseAccountSigners,
  checkThresholdMet,
  buildSetSignersTransaction,
  addSignatureToXdr,
  getSignersFromXdr,
  createSession,
  loadSessions,
  updateSession,
  deleteSession,
  addSignatureToSession,
  SESSION_STATUS,
} from '../../../src/lib/multisig';
import { buildAccountFixture, buildPaymentTransaction } from '../../__factories__';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KEYPAIR_A = StellarSdk.Keypair.random();
const KEYPAIR_B = StellarSdk.Keypair.random();
const KEYPAIR_C = StellarSdk.Keypair.random();

const mockAccountData = buildAccountFixture({
  id: KEYPAIR_A.publicKey(),
  account_id: KEYPAIR_A.publicKey(),
  signers: [
    { key: KEYPAIR_A.publicKey(), weight: 1, type: 'ed25519_public_key' },
    { key: KEYPAIR_B.publicKey(), weight: 2, type: 'ed25519_public_key' },
  ],
  thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
});

// ─── isValidPublicKey ─────────────────────────────────────────────────────────

describe('isValidPublicKey', () => {
  it('returns true for a valid Stellar public key', () => {
    expect(isValidPublicKey(KEYPAIR_A.publicKey())).toBe(true);
  });

  it('returns false for a garbage string', () => {
    expect(isValidPublicKey('not-a-key')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isValidPublicKey('')).toBe(false);
  });

  it('returns false for a secret key', () => {
    expect(isValidPublicKey(KEYPAIR_A.secret())).toBe(false);
  });
});

// ─── validateThresholds ───────────────────────────────────────────────────────

describe('validateThresholds', () => {
  const signers = [
    { key: KEYPAIR_A.publicKey(), weight: 2 },
    { key: KEYPAIR_B.publicKey(), weight: 2 },
  ];

  it('passes valid thresholds', () => {
    const { valid, errors } = validateThresholds({ low: 1, medium: 2, high: 3 }, signers);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('fails when high > total weight', () => {
    const { valid, errors } = validateThresholds({ low: 1, medium: 2, high: 10 }, signers);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('total signer weight'))).toBe(true);
  });

  it('fails when medium < low', () => {
    const { valid, errors } = validateThresholds({ low: 3, medium: 1, high: 4 }, signers);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Medium threshold'))).toBe(true);
  });

  it('fails when high < medium', () => {
    const { valid, errors } = validateThresholds({ low: 1, medium: 3, high: 2 }, signers);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('High threshold should be'))).toBe(true);
  });

  it('fails for out-of-range values', () => {
    const { valid, errors } = validateThresholds({ low: -1, medium: 0, high: 0 }, signers);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Low threshold'))).toBe(true);
  });
});

// ─── parseAccountSigners ──────────────────────────────────────────────────────

describe('parseAccountSigners', () => {
  it('parses signers and thresholds from account data', () => {
    const { signers, thresholds, masterWeight } = parseAccountSigners(mockAccountData);
    expect(signers).toHaveLength(2);
    expect(thresholds).toEqual({ low: 1, medium: 2, high: 3 });
    expect(masterWeight).toBe(1);
  });

  it('marks the master key correctly', () => {
    const { signers } = parseAccountSigners(mockAccountData);
    const master = signers.find((s) => s.key === KEYPAIR_A.publicKey());
    expect(master.isMaster).toBe(true);
  });

  it('returns safe defaults for null input', () => {
    const { signers, thresholds, masterWeight } = parseAccountSigners(null);
    expect(signers).toHaveLength(0);
    expect(thresholds).toEqual({ low: 0, medium: 0, high: 0 });
    expect(masterWeight).toBe(1);
  });
});

// ─── checkThresholdMet ────────────────────────────────────────────────────────

describe('checkThresholdMet', () => {
  const allSigners = [
    { key: KEYPAIR_A.publicKey(), weight: 2 },
    { key: KEYPAIR_B.publicKey(), weight: 3 },
  ];

  it('returns met=true when weight equals threshold', () => {
    const result = checkThresholdMet([KEYPAIR_A.publicKey()], allSigners, 2);
    expect(result.met).toBe(true);
    expect(result.currentWeight).toBe(2);
    expect(result.needed).toBe(0);
  });

  it('returns met=false when weight is below threshold', () => {
    const result = checkThresholdMet([KEYPAIR_A.publicKey()], allSigners, 4);
    expect(result.met).toBe(false);
    expect(result.needed).toBe(2);
  });

  it('returns met=true when all signers have signed', () => {
    const result = checkThresholdMet([KEYPAIR_A.publicKey(), KEYPAIR_B.publicKey()], allSigners, 5);
    expect(result.met).toBe(true);
  });

  it('ignores keys not in allSigners', () => {
    const result = checkThresholdMet([KEYPAIR_C.publicKey()], allSigners, 2);
    expect(result.currentWeight).toBe(0);
    expect(result.met).toBe(false);
  });
});

// ─── buildSetSignersTransaction ───────────────────────────────────────────────

describe('buildSetSignersTransaction', () => {
  it('builds a transaction with setOptions operations', () => {
    const sourceAccount = new StellarSdk.Account(KEYPAIR_A.publicKey(), '100');

    const tx = buildSetSignersTransaction(
      sourceAccount,
      {
        signers: [
          { key: KEYPAIR_A.publicKey(), weight: 1, isMaster: true },
          { key: KEYPAIR_B.publicKey(), weight: 2, isMaster: false },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
        masterWeight: 1,
      },
      'testnet'
    );

    expect(tx).toBeDefined();
    expect(tx.operations.length).toBeGreaterThanOrEqual(1);
    expect(tx.operations[0].type).toBe('setOptions');
  });
});

// ─── XDR signing ─────────────────────────────────────────────────────────────

describe('addSignatureToXdr / getSignersFromXdr', () => {
  let txXdr;

  beforeEach(() => {
    txXdr = buildPaymentTransaction({
      sourceKeypair: KEYPAIR_A,
      destination: KEYPAIR_B.publicKey(),
      amount: '10',
      network: StellarSdk.Networks.TESTNET,
      timeout: 300,
    }).toXDR();
  });

  it('adds a signature and returns new XDR', () => {
    const signed = addSignatureToXdr(txXdr, KEYPAIR_A.secret(), 'testnet');
    expect(signed).not.toBe(txXdr);
    expect(typeof signed).toBe('string');
  });

  it('getSignersFromXdr returns hint list after signing', () => {
    const signed = addSignatureToXdr(txXdr, KEYPAIR_A.secret(), 'testnet');
    const hints = getSignersFromXdr(signed, 'testnet');
    expect(hints).toHaveLength(1);
  });

  it('accumulates multiple signatures', () => {
    const signed1 = addSignatureToXdr(txXdr, KEYPAIR_A.secret(), 'testnet');
    const signed2 = addSignatureToXdr(signed1, KEYPAIR_B.secret(), 'testnet');
    const hints = getSignersFromXdr(signed2, 'testnet');
    expect(hints).toHaveLength(2);
  });
});

// ─── Session CRUD ─────────────────────────────────────────────────────────────

describe('Session management', () => {
  beforeEach(() => localStorage.clear());

  const baseSession = () => ({
    txXdr: 'AAAA',
    sourceAddress: KEYPAIR_A.publicKey(),
    description: 'Test session',
    requiredSigners: [
      { key: KEYPAIR_A.publicKey(), weight: 1 },
      { key: KEYPAIR_B.publicKey(), weight: 1 },
    ],
    threshold: 2,
    network: 'testnet',
  });

  it('createSession persists to localStorage', () => {
    const session = createSession(baseSession());
    expect(session.id).toMatch(/^msig-/);
    expect(loadSessions()).toHaveLength(1);
  });

  it('createSession sets status to pending', () => {
    const session = createSession(baseSession());
    expect(session.status).toBe(SESSION_STATUS.PENDING);
  });

  it('updateSession modifies fields', () => {
    const session = createSession(baseSession());
    const updated = updateSession(session.id, { description: 'Updated' });
    expect(updated.description).toBe('Updated');
    expect(loadSessions()[0].description).toBe('Updated');
  });

  it('deleteSession removes from storage', () => {
    const session = createSession(baseSession());
    deleteSession(session.id);
    expect(loadSessions()).toHaveLength(0);
  });

  it('addSignatureToSession adds signature and updates XDR', () => {
    const session = createSession(baseSession());
    const updated = addSignatureToSession(session.id, KEYPAIR_A.publicKey(), 'SIGNED_XDR_1');
    expect(updated.collectedSignatures).toHaveLength(1);
    expect(updated.txXdr).toBe('SIGNED_XDR_1');
    expect(updated.status).toBe(SESSION_STATUS.COLLECTING);
  });

  it('addSignatureToSession sets status to ready when threshold met', () => {
    const session = createSession(baseSession());
    addSignatureToSession(session.id, KEYPAIR_A.publicKey(), 'XDR_1');
    const updated = addSignatureToSession(session.id, KEYPAIR_B.publicKey(), 'XDR_2');
    expect(updated.status).toBe(SESSION_STATUS.READY);
  });

  it('addSignatureToSession ignores duplicate signers', () => {
    const session = createSession(baseSession());
    addSignatureToSession(session.id, KEYPAIR_A.publicKey(), 'XDR_1');
    const updated = addSignatureToSession(session.id, KEYPAIR_A.publicKey(), 'XDR_DUPE');
    expect(updated.collectedSignatures).toHaveLength(1);
  });

  it('multiple sessions are stored in order (newest first)', () => {
    createSession({ ...baseSession(), description: 'First' });
    createSession({ ...baseSession(), description: 'Second' });
    const sessions = loadSessions();
    expect(sessions[0].description).toBe('Second');
    expect(sessions[1].description).toBe('First');
  });
});
