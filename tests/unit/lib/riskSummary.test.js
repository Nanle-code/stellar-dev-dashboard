import { describe, it, expect } from 'vitest';
import * as Sdk from '@stellar/stellar-sdk';

import {
  computeRiskSummary,
  resolveTransactionShape,
  deriveBalanceChanges,
  normaliseSimulation,
  highestSeverityOf,
} from '../../../src/lib/riskSummary';

/**
 * `computeRiskSummary` is the engine behind the pre-sign panel. It must stay
 * synchronous, pure, and impossible to crash: a user must never be prevented
 * from signing because a rule or a simulation hiccuped.
 */

const KP_A = Sdk.Keypair.random();
const KP_B = Sdk.Keypair.random();
const A = KP_A.publicKey();
const B = KP_B.publicKey();
const NATIVE = Sdk.Asset.native();
const USDC = new Sdk.Asset('USDC', KP_A.publicKey());

const buildTx = (descriptors) => {
  const builder = new Sdk.TransactionBuilder(new Sdk.Account(A, '100'), {
    fee: Sdk.BASE_FEE,
    networkPassphrase: Sdk.Networks.TESTNET,
  });
  for (const descriptor of descriptors) builder.addOperation(descriptor);
  return builder.setTimeout(300).build();
};

const buildFeeBump = (inner) =>
  Sdk.TransactionBuilder.buildFeeBumpTransaction(B, Sdk.BASE_FEE, inner, Sdk.Networks.TESTNET);

const accountWith = (balance) => ({
  account_id: A,
  balances: [{ asset_type: 'native', balance }],
});

describe('resolveTransactionShape', () => {
  it('reads operations and source from a plain transaction', () => {
    const tx = buildTx([Sdk.Operation.accountMerge({ destination: B })]);
    const shape = resolveTransactionShape(tx);
    expect(shape.operations).toHaveLength(1);
    expect(shape.sourceAccount).toBe(A);
    expect(shape.feeBumpSource).toBeNull();
  });

  it('reads through a fee bump to the inner operations and attributes the source correctly', () => {
    const inner = buildTx([Sdk.Operation.accountMerge({ destination: B })]);
    const shape = resolveTransactionShape(buildFeeBump(inner));
    expect(shape.operations).toHaveLength(1);
    // The operations belong to the inner source; the fee bump source only pays.
    expect(shape.sourceAccount).toBe(A);
    expect(shape.feeBumpSource).toBe(B);
  });

  it('survives a missing transaction', () => {
    expect(resolveTransactionShape(null)).toMatchObject({ operations: [], sourceAccount: null });
  });
});

describe('deriveBalanceChanges', () => {
  it('describes both sides of an outgoing native payment', () => {
    const [op] = buildTx([
      Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '25' }),
    ]).operations;
    const changes = deriveBalanceChanges(op, 0, { sourceAccount: A });
    const debit = changes.find((c) => c.direction === 'debit');
    const credit = changes.find((c) => c.direction === 'credit');
    expect(debit.account).toBe(A);
    // The SDK preserves seven-decimal stroop precision.
    expect(debit.amount).toBe('25.0000000');
    expect(credit.account).toBe(B);
    expect(credit.amount).toBe('25.0000000');
  });

  it('describes an outgoing native payment as a debit', () => {
    const [op] = buildTx([
      Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '25' }),
    ]).operations;
    const changes = deriveBalanceChanges(op, 0, { sourceAccount: A });
    const debit = changes.find((c) => c.account === A);
    expect(debit.direction).toBe('debit');
    expect(debit.kind).toBe('payment');
  });

  it('describes an account merge as a transfer of everything to the destination', () => {
    const [op] = buildTx([Sdk.Operation.accountMerge({ destination: B })]).operations;
    const changes = deriveBalanceChanges(op, 0, { sourceAccount: A });
    expect(changes.some((c) => c.kind === 'account-merge')).toBe(true);
    expect(changes.every((c) => c.account === B || c.kind === 'account-merge')).toBe(true);
  });

  it('describes a trustline removal as returning the holding to the issuer', () => {
    const [op] = buildTx([
      Sdk.Operation.changeTrust({ asset: USDC, limit: '0.0000000' }),
    ]).operations;
    const [change] = deriveBalanceChanges(op, 0, {});
    expect(change.kind).toBe('trustline-removal');
    expect(change.note).toMatch(/returned to the issuer|deleted/i);
  });

  it('describes a new trustline as a creation', () => {
    const [op] = buildTx([Sdk.Operation.changeTrust({ asset: USDC, limit: '100' })]).operations;
    const [change] = deriveBalanceChanges(op, 0, {});
    expect(change.kind).toBe('trustline-creation');
  });

  it('describes a clawback as a debit for the holder', () => {
    const [op] = buildTx([
      Sdk.Operation.clawback({ asset: USDC, from: B, amount: '10' }),
    ]).operations;
    const changes = deriveBalanceChanges(op, 0, {});
    expect(changes.some((c) => c.kind === 'clawback')).toBe(true);
  });

  it('says so explicitly when the balance effect is not modelled', () => {
    const [op] = buildTx([Sdk.Operation.setOptions({ masterWeight: 1 })]).operations;
    const [change] = deriveBalanceChanges(op, 0, {});
    // An unmodelled operation must not be presented as a known balance move.
    expect(change.kind).toBe('unspecified');
    expect(change.note).toMatch(/not modelled/i);
  });
});

describe('normaliseSimulation', () => {
  it('reports no simulation when none was attempted', () => {
    expect(normaliseSimulation(null)).toMatchObject({ available: false, error: null });
  });

  it('surfaces an error string when simulation failed', () => {
    expect(normaliseSimulation({ error: 'node unreachable' })).toMatchObject({
      available: false,
      error: 'node unreachable',
    });
  });

  it('extracts the resource fee and entry counts from a Soroban-RPC response', () => {
    const result = normaliseSimulation({
      error: null,
      transactionData: '<xdr>',
      minResourceFee: '2500',
      events: [],
      result: { transactionData: '<xdr>' },
    });
    expect(result.available).toBe(true);
    expect(result.minResourceFee).toBe('2500');
  });

  it('never throws on a malformed simulation payload', () => {
    expect(() => normaliseSimulation({ minResourceFee: 42 })).not.toThrow();
  });
});

describe('computeRiskSummary', () => {
  it('describes a benign payment as info with no acknowledgement required', () => {
    const summary = computeRiskSummary(
      buildTx([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' })]),
      {}
    );
    expect(summary.overallSeverity).toBe('info');
    expect(summary.requiresAcknowledgement).toBe(false);
    expect(summary.operations[0].label).toBeTruthy();
    expect(summary.sourceAccount).toBe(A);
  });

  it('aggregates the highest severity across every operation', () => {
    const summary = computeRiskSummary(
      buildTx([
        Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
        Sdk.Operation.accountMerge({ destination: B }),
      ]),
      {}
    );
    expect(summary.operations[1].severity).toBe('high');
    expect(summary.overallSeverity).toBe('high');
    expect(summary.requiresAcknowledgement).toBe(true);
  });

  it('keeps per-operation severities independent', () => {
    const summary = computeRiskSummary(
      buildTx([
        Sdk.Operation.accountMerge({ destination: B }),
        Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
      ]),
      {}
    );
    expect(summary.operations[0].severity).toBe('high');
    expect(summary.operations[1].severity).toBe('info');
    expect(summary.operations[1].appliedRules).toHaveLength(0);
  });

  it('exposes the contract ids behind unknown-contract flags structurally', () => {
    const contractId = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
    const tx = buildTx([
      new Sdk.Contract(contractId).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' })),
    ]);
    const summary = computeRiskSummary(tx, { knownContracts: [] });
    expect(summary.flaggedContracts).toEqual([contractId]);
  });

  it('reports no flagged contracts when none were flagged', () => {
    const summary = computeRiskSummary(
      buildTx([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' })]),
      {}
    );
    expect(summary.flaggedContracts).toEqual([]);
  });

  it('explains a fee bump: inner source for the operations, separate fee payer', () => {
    const inner = buildTx([Sdk.Operation.accountMerge({ destination: B })]);
    const summary = computeRiskSummary(buildFeeBump(inner), {});
    expect(summary.sourceAccount).toBe(A);
    expect(summary.feeBumpSource).toBe(B);
    expect(summary.operations).toHaveLength(1);
    expect(summary.notes.join(' ')).toMatch(/fee-bump/i);
  });

  it('applies balance-relative thresholds using the supplied snapshot', () => {
    const tx = buildTx([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '60' })]);
    const withSnapshot = computeRiskSummary(tx, { account: accountWith('100') });
    const withoutSnapshot = computeRiskSummary(tx, {});
    expect(withSnapshot.requiresAcknowledgement).toBe(true);
    expect(withoutSnapshot.requiresAcknowledgement).toBe(false);
  });

  it('notes when no account snapshot was available', () => {
    const summary = computeRiskSummary(
      buildTx([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' })]),
      {}
    );
    expect(summary.notes.join(' ')).toMatch(/No account snapshot/i);
  });

  it('notes when simulation was attempted but failed, and still summarises', () => {
    const summary = computeRiskSummary(buildTx([Sdk.Operation.accountMerge({ destination: B })]), {
      simulation: { error: 'node unreachable' },
    });
    expect(summary.simulation.available).toBe(false);
    expect(summary.notes.join(' ')).toMatch(/did not complete/i);
    expect(summary.overallSeverity).toBe('high');
  });

  it('does not add a simulation note when no simulation was attempted', () => {
    const summary = computeRiskSummary(
      buildTx([Sdk.Operation.accountMerge({ destination: B })]),
      {}
    );
    expect(summary.notes.join(' ')).not.toMatch(/did not complete/i);
  });

  it('handles a transaction with no operations without throwing', () => {
    const empty = buildTx([
      Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' }),
    ]).operations.slice(0, 0);
    expect(() => computeRiskSummary({ operations: empty, source: A }, {})).not.toThrow();
  });

  it('honours threshold overrides from the context', () => {
    const tx = buildTx([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '100' })]);
    expect(computeRiskSummary(tx, {}).overallSeverity).toBe('info');
    const lowered = computeRiskSummary(tx, { thresholds: { largePaymentXlm: 50 } });
    expect(lowered.overallSeverity).toBe('medium');
  });

  it('tolerates a null transaction', () => {
    expect(() => computeRiskSummary(null, {})).not.toThrow();
    expect(computeRiskSummary(null, {}).operations).toEqual([]);
  });

  it('tolerates a null context', () => {
    const summary = computeRiskSummary(
      buildTx([Sdk.Operation.accountMerge({ destination: B })]),
      null
    );
    expect(summary.overallSeverity).toBe('high');
  });
});

describe('highestSeverityOf', () => {
  it('returns info for an empty list and the max otherwise', () => {
    expect(highestSeverityOf([])).toBe('info');
    expect(highestSeverityOf(['info', 'medium'])).toBe('medium');
    expect(highestSeverityOf(['medium', 'high'])).toBe('high');
    expect(highestSeverityOf(['high', 'info'])).toBe('high');
  });
});
