#!/usr/bin/env node
/**
 * Seed the local Stellar Quickstart network with deterministic fixtures (#1004).
 *
 * Intended for the `local` profile in docker-compose.yml but usable directly:
 *
 *   node scripts/seed-local-stellar.mjs            # against http://localhost:8000
 *   STELLAR_SEED_HORIZON_URL=http://stellar:8000 node scripts/seed-local-stellar.mjs
 *   node scripts/seed-local-stellar.mjs --timeout 180
 *
 * What it seeds (idempotent — safe to rerun, it skips work that already exists):
 *   1. Waits for Horizon (GET /) and Soroban RPC (getHealth) to be ready.
 *   2. Funds deterministic dev accounts via the local Friendbot.
 *   3. Issues two test assets (XDEMO, USDC) from a dedicated issuer.
 *   4. Establishes trustlines for the accounts that need them.
 *   5. Creates three deterministic SDEX sell offers (XDEMO/XLM, XLM/XDEMO, USDC/XLM).
 *   6. Deposits into the XLM/XDEMO constant-product liquidity pool.
 *   7. Deploys the Stellar Asset Contract (SAC) for XDEMO via Soroban RPC.
 *   8. Verifies every fixture and exits non-zero on any failure.
 *
 * Environment:
 *   STELLAR_SEED_HORIZON_URL  Horizon base URL          (default http://localhost:8000)
 *   STELLAR_SEED_RPC_URL      Soroban RPC URL           (default http://localhost:8000/rpc)
 *   STELLAR_SEED_TIMEOUT      Overall readiness budget  (default 180 seconds)
 *
 * SECURITY: The account keys below are derived from fixed, public labels so the
 * fixtures are reproducible across resets. They are for the throwaway local
 * Quickstart network ONLY — never fund these addresses on mainnet or testnet
 * and never reuse these derivation rules for real accounts.
 */

import { fileURLToPath } from 'node:url';
import * as StellarSdk from '@stellar/stellar-sdk';

const {
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Horizon,
  getLiquidityPoolId,
  xdr,
} = StellarSdk;

// ─── Configuration ────────────────────────────────────────────────────────────

const PASSPHRASE = Networks.STANDALONE; // 'Standalone Network ; February 2017'
const HORIZON_URL = process.env.STELLAR_SEED_HORIZON_URL || 'http://localhost:8000';
const RPC_URL = process.env.STELLAR_SEED_RPC_URL || 'http://localhost:8000/rpc';
const FRIENDBOT_URL = `${HORIZON_URL}/friendbot`;
const SEED_TIMEOUT_MS = Number(process.env.STELLAR_SEED_TIMEOUT || 180) * 1000;
const READY_POLL_MS = 1_000;
const TX_POLL_MS = 750;
const TX_TIMEOUT_MS = 30_000;

// `allowHttp` is required by the SDK for plain-http networks; this script only
// ever talks to a local Quickstart instance.
const server = new Horizon.Server(HORIZON_URL, { allowHttp: true });
const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

// ─── Deterministic dev identities (local network only — see security note) ────

const ACCOUNT_LABELS = ['seed-buyer', 'seed-issuer', 'seed-offer-a', 'seed-offer-b'];

/**
 * Derive a Keypair from a fixed public label. Deterministic by design so the
 * seeded fixtures survive network resets. NOT suitable for real funds.
 */
export function deriveKeypair(label) {
  const seed = Buffer.concat([Buffer.from(label, 'utf8'), Buffer.alloc(32)]).subarray(0, 32);
  return Keypair.fromRawEd25519Seed(seed);
}

export function deriveKeypairs() {
  const [BUYER, ISSUER, OFFER_A, OFFER_B] = ACCOUNT_LABELS.map(deriveKeypair);
  return { BUYER, ISSUER, OFFER_A, OFFER_B };
}

// ─── Assets & fixtures ────────────────────────────────────────────────────────

export const ASSET_SPECS = [
  { code: 'XDEMO', totalIssued: '1000000' },
  { code: 'USDC', totalIssued: '500000' },
];

export function buildAssets(ISSUER) {
  return {
    XLM: Asset.native(),
    XDEMO: new Asset('XDEMO', ISSUER.publicKey()),
    USDC: new Asset('USDC', ISSUER.publicKey()),
  };
}

/** Build the deterministic sell-offer fixtures for the local order books. */
export function createOfferSpecs(assets) {
  return [
    {
      offerId: 1001,
      seller: 'OFFER_A',
      selling: assets.XDEMO,
      buying: assets.XLM,
      amount: '25000',
      price: '0.5',
    },
    {
      offerId: 1002,
      seller: 'OFFER_B',
      selling: assets.XLM,
      buying: assets.XDEMO,
      amount: '5000',
      price: '2',
    },
    {
      offerId: 1003,
      seller: 'OFFER_B',
      selling: assets.USDC,
      buying: assets.XLM,
      amount: '2000',
      price: '40',
    },
  ];
}

/**
 * Decide the create/update/skip action for each offer fixture given the
 * seller's existing offers (Horizon records with `id` and `amount` fields).
 * Exported for tests and for future tooling.
 */
export function planOffers(existingOffers, specs) {
  return specs.map((spec) => {
    const existing = existingOffers.find((offer) => String(offer.id) === String(spec.offerId));
    if (!existing) return { action: 'create', spec };
    if (Number(existing.amount) === Number(spec.amount)) return { action: 'skip', spec };
    return { action: 'update', spec };
  });
}

/** Sort a pair of assets into the canonical (lexicographic) pool order. */
export function sortPoolAssets(assetA, assetB) {
  return Asset.compare(assetA, assetB) === -1 ? [assetA, assetB] : [assetB, assetA];
}

/** Compute the canonical constant-product pool id for an asset pair (fee 30). */
export function computeLiquidityPoolId(assetA, assetB) {
  const [a, b] = sortPoolAssets(assetA, assetB);
  return getLiquidityPoolId('constant_product', { assetA: a, assetB: b, fee: 30 }).toString('hex');
}

/** LP deposit fixture: 2,500 XDEMO + 5,000 XLM around the 0.5 XLM/XDEMO price. */
export function createPoolDepositSpec(assets) {
  return {
    liquidityPoolId: computeLiquidityPoolId(assets.XLM, assets.XDEMO),
    maxAmountA: '5000',
    maxAmountB: '2500',
    minPrice: '0.4',
    maxPrice: '0.6',
  };
}

// ─── Small async helpers ──────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(step, message) {
  console.log(`[seed] ${step}: ${message}`);
}

/**
 * Returns the ledger entry whose key carries a contract instance, if any.
 * Accepts both the parsed shape returned by `SorobanRpc.Server#getLedgerEntries`
 * (`{ key: LedgerKey, val: LedgerEntryData }`) and raw `{ key_xdr }` shapes.
 * Exported for tests.
 */
export function findContractInstance(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.find((entry) => {
    try {
      if (!entry) return false;
      if (entry.key?.switch) {
        return String(entry.key.switch().name).startsWith('contractData');
      }
      if (entry.key_xdr) {
        return String(xdr.LedgerKey.fromXDR(entry.key_xdr, 'base64').switch().name).startsWith(
          'contractData'
        );
      }
      return false;
    } catch {
      return false;
    }
  });
}

function ledgerKeyForContractInstance(contractId) {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: Address.fromString(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
}

// ─── Readiness waits ──────────────────────────────────────────────────────────

/** Poll Horizon's root endpoint until it answers with a JSON object. */
export async function waitForHorizon({ horizonUrl = HORIZON_URL, timeoutMs = SEED_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(horizonUrl);
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') return json;
      }
      lastError = new Error(`Horizon responded with status ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(READY_POLL_MS);
  }

  throw new Error(
    `Horizon at ${horizonUrl} was not ready within ${Math.round(timeoutMs / 1000)}s (${lastError?.message || 'no response'}). ` +
      'Start it with: docker compose --profile local up -d stellar'
  );
}

/** Poll Soroban RPC's getHealth until it reports healthy. */
export async function waitForRpc({ rpcUrl = RPC_URL, timeoutMs = SEED_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth', params: [] }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.result?.status === 'healthy') return json.result;
        lastError = new Error(`getHealth status: ${json?.result?.status || JSON.stringify(json)}`);
      } else {
        lastError = new Error(`Soroban RPC responded with status ${res.status}`);
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(READY_POLL_MS);
  }

  throw new Error(
    `Soroban RPC at ${rpcUrl} was not healthy within ${Math.round(timeoutMs / 1000)}s (${lastError?.message || 'no response'}). ` +
      'Start it with: docker compose --profile local up -d stellar'
  );
}

// ─── Funding ──────────────────────────────────────────────────────────────────

/** Fund an account via the local Friendbot, tolerating transient failures. */
export async function fundViaFriendbot(publicKey, { friendbotUrl = FRIENDBOT_URL, attempts = 3 } = {}) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${friendbotUrl}?addr=${publicKey}`);
      if (res.ok) return await res.json();
      lastError = new Error(`Friendbot responded with status ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(1_500);
  }
  throw new Error(`Friendbot funding failed for ${publicKey}: ${lastError?.message}`);
}

export async function fundAccounts(keypairs) {
  for (const [name, keypair] of Object.entries(keypairs)) {
    log('fund', `funding ${name} (${keypair.publicKey()})`);
    await fundViaFriendbot(keypair.publicKey());
  }
}

// ─── Transaction plumbing ─────────────────────────────────────────────────────

async function waitForSorobanTransaction(hash) {
  const deadline = Date.now() + TX_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const tx = await rpc.getTransaction(hash);
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return tx;
    if (tx.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction ${hash} failed: ${tx.resultXdr ? tx.resultXdr.toXDR('base64') : 'unknown result'}`);
    }
    await sleep(TX_POLL_MS);
  }
  throw new Error(`Timed out waiting for transaction ${hash}`);
}

/**
 * Sign and submit classic operations (payments, trustlines, offers, pool
 * deposits) through Horizon. Horizon processes the transaction synchronously
 * and throws with the result codes on failure.
 */
export async function submitOps(keypair, operations, { fee = BASE_FEE } = {}) {
  const account = await server.loadAccount(keypair.publicKey());
  const ops = Array.isArray(operations) ? operations : [operations];
  // TransactionBuilder scales `fee` by the operation count at build time.
  const builder = new TransactionBuilder(account, {
    fee,
    networkPassphrase: PASSPHRASE,
  }).setTimeout(30);
  for (const operation of ops) {
    builder.addOperation(operation);
  }
  const tx = builder.build();
  tx.sign(keypair);
  const response = await server.submitTransaction(tx);
  if (!response.successful) {
    throw new Error(`Transaction ${response.hash} was not successful`);
  }
  return response;
}

/**
 * Sign and submit a Soroban host-function operation through Soroban RPC.
 * `prepareTransaction` simulates the invocation and folds the resource fee
 * into the transaction fee before signing.
 */
export async function submitSorobanOp(keypair, operation) {
  const account = await server.loadAccount(keypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .setTimeout(30)
    .addOperation(operation)
    .build();
  const prepared = await rpc.prepareTransaction(tx);
  prepared.sign(keypair);
  const response = await rpc.sendTransaction(prepared);
  if (response.errorResult) {
    throw new Error(`Transaction rejected: ${response.errorResult.toXDR('base64')}`);
  }
  return waitForSorobanTransaction(response.hash);
}

// ─── Asset issuance & trustlines ──────────────────────────────────────────────

function hasTrustline(account, asset) {
  return (account.balances || []).some(
    (balance) =>
      balance.asset_type !== 'native' &&
      balance.asset_code === asset.getCode() &&
      balance.asset_issuer === asset.getIssuer()
  );
}

export async function ensureTrustline(keypair, asset) {
  const account = await server.loadAccount(keypair.publicKey());
  if (hasTrustline(account, asset)) {
    log('trustline', `${keypair.publicKey()} already trusts ${asset.getCode()}`);
    return false;
  }
  await submitOps(keypair, Operation.changeTrust({ asset, limit: '1000000' }));
  log('trustline', `${keypair.publicKey()} now trusts ${asset.getCode()}`);
  return true;
}

/** Pay the full issued supply to the issuer itself so the asset is spendable. */
export async function ensureIssued(keypair, asset, totalIssued) {
  const account = await server.loadAccount(keypair.publicKey());
  const balance = (account.balances || []).find(
    (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer()
  );
  const outstanding = balance ? Number(balance.balance) : 0;
  if (outstanding >= Number(totalIssued)) {
    log('issue', `${asset.getCode()} supply already issued (${totalIssued})`);
    return false;
  }
  await submitOps(
    keypair,
    Operation.payment({ destination: keypair.publicKey(), asset, amount: totalIssued })
  );
  log('issue', `issued ${totalIssued} ${asset.getCode()} to the issuer`);
  return true;
}

// ─── Offers & liquidity pool ──────────────────────────────────────────────────

async function fetchOffersFor(publicKey) {
  const res = await fetch(`${HORIZON_URL}/offers?seller=${publicKey}&limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch offers for ${publicKey}: ${res.status}`);
  const json = await res.json();
  return json._embedded?.records || [];
}

export async function seedOffers(keypairs, specs) {
  const sellers = [...new Set(specs.map((spec) => spec.seller))];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const seller of sellers) {
    const keypair = keypairs[seller];
    const existing = await fetchOffersFor(keypair.publicKey());
    for (const plan of planOffers(existing, specs.filter((spec) => spec.seller === seller))) {
      if (plan.action === 'skip') {
        skipped++;
        continue;
      }
      const { selling, buying, amount, price, offerId } = plan.spec;
      await submitOps(
        keypair,
        Operation.manageSellOffer({
          selling,
          buying,
          amount,
          price,
          offerId: plan.action === 'create' ? offerId : Number(plan.spec.offerId),
        })
      );
      log('offer', `${plan.action} offer ${offerId} (${amount} ${selling.getCode()} -> ${buying.getCode()})`);
      if (plan.action === 'create') created++;
      else updated++;
    }
  }

  return { created, updated, skipped };
}

export async function seedLiquidityPool(keypair, assets) {
  const poolId = computeLiquidityPoolId(assets.XLM, assets.XDEMO);
  const res = await fetch(`${HORIZON_URL}/liquidity_pools/${poolId}`);
  if (res.ok) {
    log('pool', `liquidity pool ${poolId.slice(0, 16)}… already exists`);
    return { deposited: false, poolId };
  }
  if (res.status !== 404) {
    throw new Error(`Unexpected status ${res.status} while checking liquidity pool ${poolId}`);
  }

  const spec = createPoolDepositSpec(assets);
  await submitOps(keypair, Operation.liquidityPoolDeposit(spec));
  log('pool', `deposited ${spec.maxAmountA} XLM + ${spec.maxAmountB} XDEMO into pool ${poolId.slice(0, 16)}…`);
  return { deposited: true, poolId };
}

// ─── Stellar Asset Contract deployment ────────────────────────────────────────

export async function deployStellarAssetContract(keypair, asset) {
  const contractId = asset.contractId(PASSPHRASE);
  const instanceKey = ledgerKeyForContractInstance(contractId);
  const existing = await rpc.getLedgerEntries(instanceKey);
  if (findContractInstance(existing.entries ?? [])) {
    log('contract', `SAC ${contractId} already deployed`);
    return { deployed: false, contractId };
  }

  await submitSorobanOp(keypair, Operation.createStellarAssetContract({ asset }));
  log('contract', `deployed SAC ${contractId} for ${asset.getCode()}`);
  return { deployed: true, contractId };
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function verifyFixtures(keypairs, assets, specs) {
  const results = [];

  for (const [name, keypair] of Object.entries(keypairs)) {
    const account = await server.loadAccount(keypair.publicKey());
    const xlm = Number(account.balances.find((b) => b.asset_type === 'native')?.balance || 0);
    if (xlm <= 0) throw new Error(`Verification failed: ${name} has no XLM balance`);
    results.push(`${name}: ${xlm.toFixed(0)} XLM`);
  }

  const issuerAccount = await server.loadAccount(keypairs.ISSUER.publicKey());
  for (const { code } of ASSET_SPECS) {
    const supply = issuerAccount.balances.find((b) => b.asset_code === code)?.balance;
    if (!supply || Number(supply) <= 0) throw new Error(`Verification failed: ${code} supply missing`);
    results.push(`${code} supply: ${Number(supply).toFixed(0)}`);
  }

  for (const spec of specs) {
    const offers = await fetchOffersFor(keypairs[spec.seller].publicKey());
    const match = offers.find((offer) => String(offer.id) === String(spec.offerId));
    if (!match) throw new Error(`Verification failed: offer ${spec.offerId} missing`);
    results.push(`offer ${spec.offerId}: ${match.amount} ${spec.selling.getCode()}@${spec.price}`);
  }

  const poolId = computeLiquidityPoolId(assets.XLM, assets.XDEMO);
  const poolRes = await fetch(`${HORIZON_URL}/liquidity_pools/${poolId}`);
  if (!poolRes.ok) throw new Error(`Verification failed: liquidity pool ${poolId} missing`);
  results.push(`pool: ${poolId.slice(0, 16)}…`);

  const contractId = assets.XDEMO.contractId(PASSPHRASE);
  const instanceKey = ledgerKeyForContractInstance(contractId);
  const entries = await rpc.getLedgerEntries(instanceKey);
  if (!findContractInstance(entries.entries ?? [])) {
    throw new Error(`Verification failed: SAC ${contractId} missing`);
  }
  results.push(`SAC: ${contractId}`);

  return results;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export async function runSeed() {
  log('wait', `waiting for Horizon at ${HORIZON_URL} and Soroban RPC at ${RPC_URL}`);
  await Promise.all([waitForHorizon(), waitForRpc()]);
  log('wait', 'Horizon and Soroban RPC are ready');

  const keypairs = deriveKeypairs();
  const assets = buildAssets(keypairs.ISSUER);
  const specs = createOfferSpecs(assets);

  await fundAccounts(keypairs);
  await ensureIssued(keypairs.ISSUER, assets.XDEMO, ASSET_SPECS[0].totalIssued);
  await ensureIssued(keypairs.ISSUER, assets.USDC, ASSET_SPECS[1].totalIssued);
  await ensureTrustline(keypairs.OFFER_A, assets.XDEMO);
  await ensureTrustline(keypairs.OFFER_B, assets.XDEMO);
  await ensureTrustline(keypairs.OFFER_B, assets.USDC);

  await seedOffers(keypairs, specs);
  await seedLiquidityPool(keypairs.OFFER_B, assets);
  await deployStellarAssetContract(keypairs.ISSUER, assets.XDEMO);

  const summary = await verifyFixtures(keypairs, assets, specs);
  log('done', 'local network seeded with:');
  for (const line of summary) console.log(`  ✓ ${line}`);
  return summary;
}

function main() {
  runSeed()
    .then(() => {
      log('done', 'seed completed successfully');
    })
    .catch((error) => {
      console.error(`\n[seed] FAILED: ${error?.message || error}`);
      console.error('[seed] Is the local Quickstart running? Try: docker compose --profile local up -d');
      process.exitCode = 1;
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
