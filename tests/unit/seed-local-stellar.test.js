import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Tests for scripts/seed-local-stellar.mjs (#1004).
 *
 * The seeder talks to a local Stellar Quickstart instance, which is not
 * available in CI, so every network touchpoint is mocked:
 *
 * - Pure helpers (keypair derivation, offer planning, pool ids, entry
 *   detection) are tested directly.
 * - Readiness waits and friendbot funding run against `global.fetch` stubs.
 * - Horizon/RPC submissions are tested by spying on the SDK server
 *   prototypes (the same classes the seeder instantiates), so no sockets
 *   are ever opened.
 *
 * Response shapes follow what the SDK 12 clients return against a real
 * Quickstart `--local` node.
 */

const seed = await import('../../scripts/seed-local-stellar.mjs');
const {
  Account,
  Keypair,
  Operation,
  Address,
  Horizon,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  xdr,
} = await import('@stellar/stellar-sdk');

const PASSPHRASE = Networks.STANDALONE;
const originalFetch = global.fetch;

function keypairsFixture() {
  return seed.deriveKeypairs();
}

function assetsFixture(keypairs) {
  return seed.buildAssets(keypairs.ISSUER);
}

/** Ledger key for an asset contract instance, built exactly like the seeder does. */
function contractInstanceLedgerKey(asset) {
  const contractId = asset.contractId(PASSPHRASE);
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
}

describe('seed-local-stellar: deterministic identities (#1004)', () => {
  it('derives identical keypairs from the same labels', () => {
    const a = keypairsFixture();
    const b = keypairsFixture();
    expect(a.BUYER.publicKey()).toBe(b.BUYER.publicKey());
    expect(a.ISSUER.publicKey()).toBe(b.ISSUER.publicKey());
    expect(a.OFFER_A.publicKey()).toBe(b.OFFER_A.publicKey());
    expect(a.OFFER_B.publicKey()).toBe(b.OFFER_B.publicKey());
  });

  it('produces valid, distinct ed25519 public keys', () => {
    const keys = Object.values(keypairsFixture()).map((kp) => kp.publicKey());
    for (const key of keys) {
      expect(key).toMatch(/^G[A-Z2-7]{55}$/);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('seed-local-stellar: offer planning (idempotency)', () => {
  const assets = assetsFixture(keypairsFixture());
  const specs = seed.createOfferSpecs(assets);

  it('builds the expected deterministic offer fixtures', () => {
    expect(specs.map((s) => s.offerId)).toEqual([1001, 1002, 1003]);
    expect(specs[0].selling.getCode()).toBe('XDEMO');
    expect(specs[0].buying.getCode()).toBe('XLM');
    expect(specs[1].selling.getCode()).toBe('XLM');
    expect(specs[2].selling.getCode()).toBe('USDC');
  });

  it('plans create for missing offers', () => {
    const plan = seed.planOffers([], specs);
    expect(plan.map((p) => p.action)).toEqual(['create', 'create', 'create']);
  });

  it('plans skip for offers that already match the fixture', () => {
    const existing = [
      { id: '1001', amount: '25000' },
      { id: '1003', amount: '2000' },
    ];
    const plan = seed.planOffers(existing, specs);
    expect(plan.find((p) => p.spec.offerId === 1001).action).toBe('skip');
    expect(plan.find((p) => p.spec.offerId === 1002).action).toBe('create');
    expect(plan.find((p) => p.spec.offerId === 1003).action).toBe('skip');
  });

  it('plans update for offers whose amount drifted', () => {
    const existing = [{ id: '1001', amount: '10' }];
    const plan = seed.planOffers(existing, specs);
    expect(plan.find((p) => p.spec.offerId === 1001).action).toBe('update');
  });

  it('matches offer ids as strings (Horizon returns string ids)', () => {
    const existing = [{ id: 1002, amount: '5000' }];
    const plan = seed.planOffers(existing, specs);
    expect(plan.find((p) => p.spec.offerId === 1002).action).toBe('skip');
  });
});

describe('seed-local-stellar: liquidity pool fixtures', () => {
  it('sorts asset pairs into canonical order consistently', () => {
    const assets = assetsFixture(keypairsFixture());
    const [a, b] = seed.sortPoolAssets(assets.XLM, assets.XDEMO);
    const [a2, b2] = seed.sortPoolAssets(assets.XDEMO, assets.XLM);
    // Both orderings must produce the same canonical pair.
    expect(a.getCode()).toBe(a2.getCode());
    expect(b.getCode()).toBe(b2.getCode());
    expect(a.getCode()).not.toBe(b.getCode());
  });

  it('computes a stable constant-product pool id regardless of argument order', () => {
    const assets = assetsFixture(keypairsFixture());
    const id1 = seed.computeLiquidityPoolId(assets.XLM, assets.XDEMO);
    const id2 = seed.computeLiquidityPoolId(assets.XDEMO, assets.XLM);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds the deposit spec around the same pool id', () => {
    const assets = assetsFixture(keypairsFixture());
    const spec = seed.createPoolDepositSpec(assets);
    expect(spec.liquidityPoolId).toBe(seed.computeLiquidityPoolId(assets.XLM, assets.XDEMO));
    expect(spec.maxAmountA).toBe('5000');
    expect(spec.maxAmountB).toBe('2500');
    expect(spec.minPrice).toBe('0.4');
    expect(spec.maxPrice).toBe('0.6');
  });
});

describe('seed-local-stellar: contract instance detection', () => {
  it('detects contractData keys in the parsed getLedgerEntries shape', () => {
    const assets = assetsFixture(keypairsFixture());
    const entries = [{ key: contractInstanceLedgerKey(assets.XDEMO) }];
    expect(seed.findContractInstance(entries)).toBe(entries[0]);
  });

  it('detects contractData keys in the raw key_xdr shape', () => {
    const assets = assetsFixture(keypairsFixture());
    const key = contractInstanceLedgerKey(assets.XDEMO);
    const entries = [{ key_xdr: key.toXDR('base64') }];
    expect(seed.findContractInstance(entries)).toBe(entries[0]);
  });

  it('ignores account keys, malformed xdr, and missing input', () => {
    const accountKey = xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({ accountId: Keypair.random().rawPublicKey() })
    );
    expect(seed.findContractInstance([{ key: accountKey }])).toBeUndefined();
    expect(seed.findContractInstance([{ key_xdr: 'not-base64!!' }])).toBeUndefined();
    expect(seed.findContractInstance([])).toBeUndefined();
    expect(seed.findContractInstance(null)).toBeNull();
    expect(seed.findContractInstance(undefined)).toBeNull();
  });
});

describe('seed-local-stellar: readiness waits', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('waitForHorizon resolves once Horizon answers with JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ horizon_version: '2.11.0' }),
    });
    const result = await seed.waitForHorizon({ timeoutMs: 1000 });
    expect(result.horizon_version).toBe('2.11.0');
  });

  it('waitForHorizon keeps polling while Horizon answers non-ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });
    global.fetch = fetchMock;
    await expect(seed.waitForHorizon({ timeoutMs: 30 })).rejects.toThrow(/not ready within/);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('waitForHorizon times out with an actionable error when Quickstart is down', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(seed.waitForHorizon({ timeoutMs: 30 })).rejects.toThrow(
      /docker compose --profile local up -d stellar/
    );
  });

  it('waitForRpc resolves once getHealth reports healthy', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: { status: 'healthy' } }),
    });
    const result = await seed.waitForRpc({ timeoutMs: 1000 });
    expect(result.status).toBe('healthy');
  });

  it('waitForRpc keeps polling while the status is not healthy', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: { status: 'starting' } }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ result: { status: 'healthy' } }),
      });
    global.fetch = fetchMock;
    const result = await seed.waitForRpc({ timeoutMs: 3000 });
    expect(result.status).toBe('healthy');
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('waitForRpc times out with an actionable error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(seed.waitForRpc({ timeoutMs: 30 })).rejects.toThrow(
      /docker compose --profile local up -d stellar/
    );
  });
});

describe('seed-local-stellar: friendbot funding', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('funds an account via the local friendbot', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ successful: true, hash: 'a'.repeat(64) }),
    });
    const kp = Keypair.random();
    const result = await seed.fundViaFriendbot(kp.publicKey(), { attempts: 1 });
    expect(result.successful).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`?addr=${kp.publicKey()}`));
  });

  it('retries transient friendbot failures and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ successful: true }) });
    global.fetch = fetchMock;
    const kp = Keypair.random();
    const result = await seed.fundViaFriendbot(kp.publicKey(), { attempts: 3 });
    expect(result.successful).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('fails with a clear error after exhausting attempts', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });
    const kp = Keypair.random();
    await expect(seed.fundViaFriendbot(kp.publicKey(), { attempts: 2 })).rejects.toThrow(
      /Friendbot funding failed for .+: Friendbot responded with status 503/
    );
  }, 10_000);
});

describe('seed-local-stellar: Horizon submission path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits classic operations through Horizon', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    const loadSpy = vi
      .spyOn(Horizon.Server.prototype, 'loadAccount')
      .mockResolvedValue(new Account(keypairs.OFFER_A.publicKey(), '100'));
    const submitSpy = vi
      .spyOn(Horizon.Server.prototype, 'submitTransaction')
      .mockResolvedValue({ hash: 'b'.repeat(64), ledger: 55, successful: true });

    await seed.submitOps(
      keypairs.OFFER_A,
      Operation.changeTrust({ asset: assets.XDEMO, limit: '1000000' })
    );

    expect(loadSpy).toHaveBeenCalledWith(keypairs.OFFER_A.publicKey());
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts a list of operations and scales the fee', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new Account(keypairs.OFFER_A.publicKey(), '100')
    );
    const submitSpy = vi
      .spyOn(Horizon.Server.prototype, 'submitTransaction')
      .mockResolvedValue({ hash: 'b'.repeat(64), ledger: 55, successful: true });

    let capturedFee;
    submitSpy.mockImplementation(async (tx) => {
      capturedFee = tx.fee;
      return { hash: 'b'.repeat(64), ledger: 55, successful: true };
    });

    await seed.submitOps(keypairs.OFFER_A, [
      Operation.changeTrust({ asset: assets.XDEMO, limit: '1000000' }),
      Operation.changeTrust({ asset: assets.USDC, limit: '1000000' }),
    ]);
    // 2 ops × 100 base fee = 200
    expect(capturedFee).toBe('200');
  });

  it('throws when Horizon reports the transaction as unsuccessful', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new Account(keypairs.OFFER_A.publicKey(), '100')
    );
    vi.spyOn(Horizon.Server.prototype, 'submitTransaction').mockResolvedValue({
      hash: 'b'.repeat(64),
      ledger: 55,
      successful: false,
    });

    await expect(
      seed.submitOps(keypairs.OFFER_A, Operation.changeTrust({ asset: assets.XDEMO, limit: '1000000' }))
    ).rejects.toThrow('was not successful');
  });
});

describe('seed-local-stellar: Soroban RPC submission path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepares, signs and polls a host-function operation', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    const op = Operation.createStellarAssetContract({ asset: assets.XDEMO });

    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new Account(keypairs.ISSUER.publicKey(), '100')
    );
    const prepareSpy = vi
      .spyOn(SorobanRpc.Server.prototype, 'prepareTransaction')
      .mockImplementation(async (tx) => tx);
    const sendSpy = vi
      .spyOn(SorobanRpc.Server.prototype, 'sendTransaction')
      .mockResolvedValue({ status: 'PENDING', hash: 'a'.repeat(64) });
    const pollSpy = vi
      .spyOn(SorobanRpc.Server.prototype, 'getTransaction')
      .mockResolvedValue({ status: SorobanRpc.Api.GetTransactionStatus.SUCCESS });

    await seed.submitSorobanOp(keypairs.ISSUER, op);

    expect(prepareSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(pollSpy).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('throws when the RPC rejects the transaction upfront', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    const op = Operation.createStellarAssetContract({ asset: assets.XDEMO });

    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new Account(keypairs.ISSUER.publicKey(), '100')
    );
    vi.spyOn(SorobanRpc.Server.prototype, 'prepareTransaction').mockImplementation(async (tx) => tx);
    vi.spyOn(SorobanRpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      errorResult: { toXDR: () => 'AAAA' },
    });

    await expect(seed.submitSorobanOp(keypairs.ISSUER, op)).rejects.toThrow('Transaction rejected');
  });

  it('throws when the polled transaction reports FAILED', async () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    const op = Operation.createStellarAssetContract({ asset: assets.XDEMO });

    vi.spyOn(Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new Account(keypairs.ISSUER.publicKey(), '100')
    );
    vi.spyOn(SorobanRpc.Server.prototype, 'prepareTransaction').mockImplementation(async (tx) => tx);
    vi.spyOn(SorobanRpc.Server.prototype, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'a'.repeat(64),
    });
    vi.spyOn(SorobanRpc.Server.prototype, 'getTransaction').mockResolvedValue({
      status: SorobanRpc.Api.GetTransactionStatus.FAILED,
      resultXdr: { toXDR: () => 'AAAA' },
    });

    await expect(seed.submitSorobanOp(keypairs.ISSUER, op)).rejects.toThrow('failed');
  });
});

describe('seed-local-stellar: fixture spec sanity', () => {
  it('covers two issued assets', () => {
    expect(seed.ASSET_SPECS).toEqual([
      { code: 'XDEMO', totalIssued: '1000000' },
      { code: 'USDC', totalIssued: '500000' },
    ]);
  });

  it('spreads the three offers across two sellers', () => {
    const assets = assetsFixture(keypairsFixture());
    const specs = seed.createOfferSpecs(assets);
    expect(new Set(specs.map((s) => s.seller))).toEqual(new Set(['OFFER_A', 'OFFER_B']));
  });

  it('derives the same asset contract id the SAC deployment targets', () => {
    const assets = assetsFixture(keypairsFixture());
    // buildAssets uses the ISSUER keypair, so the SAC id must be derived from it.
    const issuer = keypairsFixture().ISSUER;
    expect(assets.XDEMO.getIssuer()).toBe(issuer.publicKey());
    expect(assets.XDEMO.contractId(PASSPHRASE)).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('builds a transaction from the fixtures without any network access', () => {
    const keypairs = keypairsFixture();
    const assets = assetsFixture(keypairs);
    const specs = seed.createOfferSpecs(assets);
    const seller = keypairs[specs[0].seller];
    const account = {
      accountId: () => seller.publicKey(),
      sequenceNumber: () => '100',
      incrementSequenceNumber: () => {},
    };
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: PASSPHRASE })
      .setTimeout(30)
      .addOperation(
        Operation.manageSellOffer({
          selling: specs[0].selling,
          buying: specs[0].buying,
          amount: specs[0].amount,
          price: specs[0].price,
          offerId: specs[0].offerId,
        })
      )
      .build();
    expect(tx.operations).toHaveLength(1);
  });
});
