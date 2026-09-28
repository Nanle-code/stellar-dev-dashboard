import { describe, it, expect } from 'vitest';
import * as Sdk from '@stellar/stellar-sdk';

import {
  RISK_RULES,
  RULE_SEVERITIES,
  SEVERITIES,
  SEVERITY_RANK,
  SEVERITY_LABELS,
  LARGE_PAYMENT_THRESHOLD_XLM,
  LARGE_PAYMENT_BALANCE_RATIO,
  LARGE_PAYMENT_HARD_CAP_XLM,
  MAX_TRUST_LIMIT,
  normaliseAllowlist,
  isKnownContract,
  isUnlimitedTrustLimit,
  changeTrustAsset,
  describeAsset,
  shortAddress,
  resolveHostFunctionTarget,
  toHorizonOperationType,
  evaluateOperation,
} from '../../../src/lib/riskRules';

/**
 * These tests deliberately exercise the rules against *parsed* operations.
 *
 * That is not incidental: `Sdk.Operation.payment()` and friends return builder
 * descriptors with no `type` and no `amount`, and the rules never see those.
 * They only ever see the parsed form produced by `TransactionBuilder.build()`
 * or `TransactionBuilder.fromXdr()` — which is exactly what the pre-sign review
 * feeds them when a user pastes an envelope.
 */

const KP_A = Sdk.Keypair.random();
const KP_B = Sdk.Keypair.random();
const A = KP_A.publicKey();
const B = KP_B.publicKey();
const USDC = new Sdk.Asset('USDC', KP_A.publicKey());
const NATIVE = Sdk.Asset.native();

const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

/** Build a transaction and return its parsed operations. */
const parseOps = (descriptors) => {
  const builder = new Sdk.TransactionBuilder(new Sdk.Account(A, '100'), {
    fee: Sdk.BASE_FEE,
    networkPassphrase: Sdk.Networks.TESTNET,
  });
  for (const descriptor of descriptors) builder.addOperation(descriptor);
  return builder.setTimeout(300).build().operations;
};

/** A Horizon-shaped account snapshot carrying a native balance. */
const accountWith = (balance) => ({
  account_id: A,
  balances: [{ asset_type: 'native', balance }],
});

/**
 * `Contract.call()` returns an operation *descriptor*; only the round trip
 * through the builder yields the parsed operation whose `func` is the xdr
 * `HostFunction` union the rules inspect.
 */
const parsedInvoke = (id = CONTRACT_ID) =>
  parseOps([new Sdk.Contract(id).call('transfer', Sdk.nativeToScVal(1n, { type: 'i128' }))])[0];

/** Ids of every rule that matched, for terse assertions. */
const matchedIds = (operation, context = {}) =>
  evaluateOperation(operation, context).map((rule) => rule.id);

describe('riskRules — rule table integrity', () => {
  it('gives every rule a unique id, a known severity and a summary builder', () => {
    const ids = RISK_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of RISK_RULES) {
      expect(Object.values(SEVERITIES)).toContain(rule.severity);
      expect(typeof rule.requiresAcknowledgement).toBe('boolean');
      expect(typeof rule.summary).toBe('function');
      expect(typeof rule.matches).toBe('function');
    }
  });

  it('records each rule in RULE_SEVERITIES and resolves it by id', () => {
    for (const rule of RISK_RULES) {
      expect(RULE_SEVERITIES[rule.id]).toBe(rule.severity);
    }
  });

  it('orders severities so high outranks medium outranks info', () => {
    expect(SEVERITY_RANK[SEVERITIES.HIGH]).toBeGreaterThan(SEVERITY_RANK[SEVERITIES.MEDIUM]);
    expect(SEVERITY_RANK[SEVERITIES.MEDIUM]).toBeGreaterThan(SEVERITY_RANK[SEVERITIES.INFO]);
    expect(SEVERITY_LABELS[SEVERITIES.HIGH]).toMatch(/high/i);
    expect(SEVERITY_LABELS[SEVERITIES.INFO]).toBeTruthy();
  });

  it('never asks for acknowledgement on a rule that flags no real risk', () => {
    for (const rule of RISK_RULES) {
      if (rule.requiresAcknowledgement) {
        expect(rule.severity).not.toBe(SEVERITIES.INFO);
      }
    }
  });

  it('asks for acknowledgement on exactly the documented high-risk set', () => {
    const gating = RISK_RULES.filter((r) => r.requiresAcknowledgement)
      .map((r) => r.id)
      .sort();
    expect(gating).toEqual(
      [
        'account-merge',
        'change-trust-removal',
        'change-trust-unlimited',
        'invoke-unknown-contract',
        'large-payment-major-share',
        'set-options-master-weight-disabled',
        'set-options-signer-change',
        'set-options-threshold-change',
      ].sort()
    );
  });
});

describe('riskRules — helpers', () => {
  it('normalises allowlist input from arrays and Sets, case-insensitively', () => {
    expect(normaliseAllowlist([A.toLowerCase()]).has(A)).toBe(true);
    expect(normaliseAllowlist(new Set([B])).has(B)).toBe(true);
    expect(normaliseAllowlist(undefined).size).toBe(0);
    expect(normaliseAllowlist(['', '   ', 42, null]).size).toBe(0);
  });

  it('matches known contracts case-insensitively and rejects unknown ones', () => {
    expect(isKnownContract(CONTRACT_ID, { knownContracts: [CONTRACT_ID.toLowerCase()] })).toBe(
      true
    );
    expect(isKnownContract(CONTRACT_ID, { knownContracts: [] })).toBe(false);
    expect(isKnownContract(null, { knownContracts: [CONTRACT_ID] })).toBe(false);
  });

  it('reads the asset from `line` for changeTrust, per SDK 12.3.0', () => {
    const [op] = parseOps([Sdk.Operation.changeTrust({ asset: USDC, limit: '100' })]);
    expect(op.line).toBeDefined();
    expect(op.asset).toBeUndefined();
    expect(changeTrustAsset(op)?.code).toBe('USDC');
  });

  it('recognises the maximum trust limit and a zero limit', () => {
    expect(isUnlimitedTrustLimit(MAX_TRUST_LIMIT)).toBe(true);
    expect(isUnlimitedTrustLimit('100')).toBe(false);
    expect(isUnlimitedTrustLimit('0')).toBe(false);
  });

  it('describes native and credit assets in plain language', () => {
    expect(describeAsset(NATIVE)).toMatch(/XLM/);
    expect(describeAsset(USDC)).toMatch(/USDC/);
    expect(describeAsset(undefined)).toBeTruthy();
  });

  it('shortens long addresses and leaves short ones intact', () => {
    expect(shortAddress(A)).toContain('…');
    expect(shortAddress('GABC')).toBe('GABC');
  });

  it('maps SDK camelCase operation types to Horizon names', () => {
    expect(toHorizonOperationType('setTrustLineFlags')).toBe('set_trust_line_flags');
    expect(toHorizonOperationType('invokeHostFunction')).toBe('invoke_host_function');
    expect(toHorizonOperationType('notAType')).toBe('not_a_type');
  });

  it('reports no target for an operation that invokes nothing', () => {
    const [op] = parseOps([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount: '1' })]);
    expect(resolveHostFunctionTarget(op)).toMatchObject({
      kind: 'unknown',
      contractId: null,
      functionName: null,
    });
  });

  it('never throws on a malformed operation, whatever the rules try to read', () => {
    // A rule reading a field that is absent must not take the signing flow
    // down; the user still needs to see and sign the transaction.
    for (const malformed of [undefined, null, {}, { type: 'setOptions' }, { type: 'payment' }]) {
      expect(() => evaluateOperation(malformed, {})).not.toThrow();
    }
  });

  it('reports a fallback description when a rule cannot describe its match', () => {
    // `allowTrust` with no `assetCode` or `trustor` exercises the branches that
    // would throw if a field were read unguarded.
    const op = { type: 'allowTrust' };
    const rule = evaluateOperation(op).find((r) => r.id === 'allow-trust-authorization');
    expect(rule.summary).toMatch(/unspecified/i);
  });
});

describe('riskRules — setOptions', () => {
  it('flags disabling the master key as high risk requiring acknowledgement', () => {
    const [op] = parseOps([Sdk.Operation.setOptions({ masterWeight: 0 })]);
    expect(matchedIds(op)).toContain('set-options-master-weight-disabled');
    const rule = evaluateOperation(op).find((r) => r.id === 'set-options-master-weight-disabled');
    expect(rule.severity).toBe(SEVERITIES.HIGH);
    expect(rule.requiresAcknowledgement).toBe(true);
  });

  it('does not flag a master key that keeps weight', () => {
    const [op] = parseOps([Sdk.Operation.setOptions({ masterWeight: 1 })]);
    expect(matchedIds(op)).not.toContain('set-options-master-weight-disabled');
  });

  it('flags adding a signer and names it', () => {
    const [op] = parseOps([
      Sdk.Operation.setOptions({ signer: { ed25519PublicKey: B, weight: 1 } }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'set-options-signer-change');
    expect(rule).toBeDefined();
    expect(rule.summary).toContain(shortAddress(B));
  });

  it('flags a threshold change even when the previous value is unknown', () => {
    const [op] = parseOps([
      Sdk.Operation.setOptions({ lowThreshold: 2, medThreshold: 2, highThreshold: 2 }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'set-options-threshold-change');
    expect(rule).toBeDefined();
    expect(rule.summary).toMatch(/unknown\s*->\s*2/);
  });

  it('uses a known previous threshold when the account snapshot has one', () => {
    const [op] = parseOps([Sdk.Operation.setOptions({ lowThreshold: 3 })]);
    const rule = evaluateOperation(op, {
      account: { thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 } },
    }).find((r) => r.id === 'set-options-threshold-change');
    expect(rule.summary).toMatch(/1\s*->\s*3/);
  });
});

describe('riskRules — trustlines', () => {
  it('flags removing a trustline and explains the balance is surrendered', () => {
    const [op] = parseOps([Sdk.Operation.changeTrust({ asset: USDC, limit: '0.0000000' })]);
    const rule = evaluateOperation(op).find((r) => r.id === 'change-trust-removal');
    expect(rule).toBeDefined();
    expect(rule.summary).toMatch(/cannot be undone|returned to the issuer/i);
  });

  it('flags an unlimited trustline', () => {
    const [op] = parseOps([Sdk.Operation.changeTrust({ asset: USDC, limit: MAX_TRUST_LIMIT })]);
    expect(matchedIds(op)).toContain('change-trust-unlimited');
  });

  it('does not flag a bounded trustline', () => {
    const [op] = parseOps([Sdk.Operation.changeTrust({ asset: USDC, limit: '100' })]);
    expect(matchedIds(op)).not.toContain('change-trust-unlimited');
  });

  it('flags legacy allowTrust authorization', () => {
    const [op] = parseOps([
      Sdk.Operation.allowTrust({ trustor: B, assetCode: 'USDC', authorize: true }),
    ]);
    expect(matchedIds(op)).toContain('allow-trust-authorization');
  });

  it('explains an allowTrust revocation differently from a grant', () => {
    const [op] = parseOps([
      Sdk.Operation.allowTrust({ trustor: B, assetCode: 'USDC', authorize: false }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'allow-trust-authorization');
    expect(rule).toBeDefined();
    expect(rule.summary).toMatch(/UNAUTHORIZED/);
  });

  it('describes the maintain-liabilities authorization state', () => {
    const [op] = parseOps([
      Sdk.Operation.allowTrust({ trustor: B, assetCode: 'USDC', authorize: 2 }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'allow-trust-authorization');
    expect(rule.summary).toMatch(/AUTHORIZED_TO_MAINTAIN_LIABILITIES/);
  });

  it('flags setTrustLineFlags and explains a revoked authorization', () => {
    const [op] = parseOps([
      Sdk.Operation.setTrustLineFlags({
        trustor: B,
        asset: USDC,
        flags: { authorized: false },
      }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'set-trustline-flags');
    expect(rule).toBeDefined();
    expect(rule.summary).toMatch(/clears authorized/);
    expect(rule.summary).toMatch(/issuer/i);
  });

  it('notes that clawbackEnabled can only ever be cleared', () => {
    const [op] = parseOps([
      Sdk.Operation.setTrustLineFlags({
        trustor: B,
        asset: USDC,
        flags: { clawbackEnabled: false },
      }),
    ]);
    const rule = evaluateOperation(op).find((r) => r.id === 'set-trustline-flags');
    expect(rule.summary).toMatch(/only ever be cleared/i);
  });
});

describe('riskRules — account merge', () => {
  it('flags accountMerge as high risk requiring acknowledgement', () => {
    const [op] = parseOps([Sdk.Operation.accountMerge({ destination: B })]);
    const rule = evaluateOperation(op).find((r) => r.id === 'account-merge');
    expect(rule.requiresAcknowledgement).toBe(true);
    expect(rule.summary).toMatch(/permanently deleted/i);
  });
});

describe('riskRules — payment thresholds', () => {
  const parsedPayment = (amount) =>
    parseOps([Sdk.Operation.payment({ destination: B, asset: NATIVE, amount })])[0];

  it('flags a payment at the 10,000 XLM threshold as medium without acknowledgement', () => {
    const rule = evaluateOperation(parsedPayment(String(LARGE_PAYMENT_THRESHOLD_XLM))).find(
      (r) => r.id === 'large-payment'
    );
    expect(rule).toBeDefined();
    expect(rule.severity).toBe(SEVERITIES.MEDIUM);
    expect(rule.requiresAcknowledgement).toBe(false);
  });

  it('does not flag a payment just below the absolute threshold', () => {
    expect(matchedIds(parsedPayment('9999.9999999'))).not.toContain('large-payment');
  });

  it('flags a payment of 50% or more of a known balance as high risk', () => {
    const rule = evaluateOperation(parsedPayment('50'), { account: accountWith('100') }).find(
      (r) => r.id === 'large-payment-major-share'
    );
    expect(rule).toBeDefined();
    expect(rule.requiresAcknowledgement).toBe(true);
  });

  it('does not flag a payment below the share threshold', () => {
    expect(matchedIds(parsedPayment('49.99'), { account: accountWith('100') })).not.toContain(
      'large-payment-major-share'
    );
  });

  it('flags a payment that exceeds a small known balance outright', () => {
    expect(matchedIds(parsedPayment('5000'), { account: accountWith('10') })).toContain(
      'large-payment-major-share'
    );
  });

  it('falls back to a 100,000 XLM threshold when the balance is unknown', () => {
    expect(matchedIds(parsedPayment(String(LARGE_PAYMENT_HARD_CAP_XLM)))).toContain(
      'large-payment-major-share'
    );
  });

  it('does not flag small payments', () => {
    expect(evaluateOperation(parsedPayment('1'))).toHaveLength(0);
  });

  it('exports the share threshold the rules use', () => {
    expect(LARGE_PAYMENT_BALANCE_RATIO).toBe(0.5);
  });

  it('honours per-context threshold overrides', () => {
    const op = parsedPayment('100');
    expect(matchedIds(op, { account: accountWith('1000') })).not.toContain('large-payment');
    expect(matchedIds(op, { thresholds: { largePaymentXlm: 50 } })).toContain('large-payment');
  });

  it('ignores credit-asset payments for the XLM thresholds', () => {
    const op = parseOps([
      Sdk.Operation.payment({ destination: B, asset: USDC, amount: '500000' }),
    ])[0];
    const ids = matchedIds(op, { account: accountWith('100') });
    expect(ids).not.toContain('large-payment');
    expect(ids).not.toContain('large-payment-major-share');
  });
});

describe('riskRules — Soroban contract calls', () => {
  it('resolves the contract id, kind and function of a parsed invocation', () => {
    const target = resolveHostFunctionTarget(parsedInvoke());
    expect(target.kind).toBe('invoke');
    expect(target.contractId).toBe(CONTRACT_ID);
    expect(target.functionName).toBe('transfer');
  });

  it('flags an unknown contract as high risk requiring acknowledgement', () => {
    const rule = evaluateOperation(parsedInvoke(), { knownContracts: [] }).find(
      (r) => r.id === 'invoke-unknown-contract'
    );
    expect(rule).toBeDefined();
    expect(rule.requiresAcknowledgement).toBe(true);
    expect(rule.summary).toContain(CONTRACT_ID);
  });

  it('does not flag an allowlisted contract', () => {
    expect(matchedIds(parsedInvoke(), { knownContracts: [CONTRACT_ID] })).not.toContain(
      'invoke-unknown-contract'
    );
  });

  it('treats an allowlist with a different case as a match', () => {
    expect(
      matchedIds(parsedInvoke(), { knownContracts: [CONTRACT_ID.toLowerCase()] })
    ).not.toContain('invoke-unknown-contract');
  });

  it('still flags a contract create, which has no prior id to allowlist', () => {
    // `createContract().address()` is an ScVal wrapping the ScAddress; a null
    // address stands in for the un-decodable case the rule must still describe.
    const createOp = {
      type: 'invokeHostFunction',
      func: {
        switch: () => ({ name: 'hostFunctionTypeCreateContract' }),
        createContract: () => ({ address: () => null }),
      },
    };
    const rule = evaluateOperation(createOp, { knownContracts: [] }).find(
      (r) => r.id === 'invoke-unknown-contract'
    );
    expect(rule).toBeDefined();
    expect(rule.summary).toMatch(/deploy/i);
  });

  it('describes a wasm upload, which has no contract id yet', () => {
    const uploadOp = {
      type: 'invokeHostFunction',
      func: { switch: () => ({ name: 'hostFunctionTypeUploadContractWasm' }) },
    };
    const target = resolveHostFunctionTarget(uploadOp);
    expect(target.kind).toBe('upload');
    expect(target.contractId).toBeNull();
  });

  it('explains a host function it cannot decode instead of staying silent', () => {
    const opaque = {
      type: 'invokeHostFunction',
      func: { switch: () => ({ name: 'hostFunctionTypeSomethingNew' }) },
    };
    const rule = evaluateOperation(opaque, { knownContracts: [] }).find(
      (r) => r.id === 'invoke-unknown-contract'
    );
    expect(rule.summary).toMatch(/could not decode|block explorer/i);
  });
});
