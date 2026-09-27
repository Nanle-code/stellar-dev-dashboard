#!/usr/bin/env node
/**
 * Seed (re)create the read-only demo fixtures used by "Try demo" (#875).
 *
 * The demo dashboard must render a fully populated Overview for a first-time
 * visitor with no wallet and no network access, so its data is bundled as a
 * static fixture instead of fetched from Horizon at runtime.
 *
 * Testnet is periodically reset, which invalidates public-network history. Run
 * this script after a reset (or whenever the curated accounts/contracts change)
 * to regenerate `src/fixtures/demo-fixtures.generated.json`.
 *
 * Usage:
 *   node scripts/seed-demo-fixtures.mjs                 # regenerate from the built-in spec
 *   node scripts/seed-demo-fixtures.mjs --anchor <ISO>  # re-anchor relative history
 *   node scripts/seed-demo-fixtures.mjs --check         # verify the committed file is current
 *
 * The output is deterministic for a given anchor, which keeps `--check` usable
 * in CI and prevents unrelated diffs.
 *
 * Security: fixtures contain ONLY public keys and no secret material. They are
 * read-only and never signed or submitted.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_PATH = join(ROOT, 'src', 'fixtures', 'demo-fixtures.generated.json');

/** Fixed anchor keeps the committed fixture byte-stable. */
export const DEFAULT_ANCHOR = '2026-09-20T12:00:00Z';

/** Curated, checksum-valid public testnet keys — public keys only. */
const KEYS = {
  RETAIL: 'GBIEWBI6Y3UUG5AKBQH4V5O75BFACPJ66QWTT6NZYH4S645TIR2XT4KC',
  MARKET_MAKER: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  TREASURY: 'GBYBJAJSIGKHXCMK6KIDCLHPY6I6YNG5I5KZBOHJAGHGXITADIPSRR65',
  ISSUER: 'GBTNSMGDYQKVYFAU5K2L3SHC7X6SUNVM3XQUDDIE4HF4YRSIOAIO5PSA',
};

/** Curated, checksum-valid public testnet contract ids. */
const CONTRACTS = {
  TOKEN: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  AMM: 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ',
  REGISTRY: 'CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3',
};

const HOUR = 60 * 60 * 1000;

function isoOffset(anchorMs, hoursAgo) {
  return new Date(anchorMs - hoursAgo * HOUR).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function balance(asset_type, balanceValue, extra = {}) {
  return { asset_type, balance: Number(balanceValue).toFixed(7), ...extra };
}

function nativeBalance(amount) {
  return balance('native', amount, {
    buying_liabilities: '0.0000000',
    selling_liabilities: '0.0000000',
  });
}

function creditBalance(code, issuer, amount) {
  return balance('credit_alphanum4', amount, {
    asset_code: code,
    asset_issuer: issuer,
    limit: '1000000.0000000',
    buying_liabilities: '0.0000000',
    selling_liabilities: '0.0000000',
  });
}

function accountRecord({ address, sequence, subentry_count, last_modified_ledger, last_modified_time, balances, signers, thresholds, flags }) {
  return {
    account_id: address,
    sequence,
    subentry_count,
    last_modified_ledger,
    last_modified_time,
    num_sponsoring: 0,
    num_sponsored: 0,
    thresholds: thresholds ?? { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    flags: flags ?? { auth_required: false, auth_revocable: false, auth_immutable: false },
    balances,
    signers: signers ?? [],
    data: {},
  };
}

function buildAccounts() {
  return [
    {
      address: KEYS.RETAIL,
      label: 'Testnet Retail Trader',
      description: 'Funded testnet account holding XLM, USDC and AQUA trustlines with active DEX history.',
      tags: ['retail', 'dex', 'stablecoins'],
      account: accountRecord({
        address: KEYS.RETAIL,
        sequence: '192045000120000',
        subentry_count: 3,
        last_modified_ledger: 53120410,
        last_modified_time: isoOffset(0, 1),
        balances: [
          nativeBalance(4820.5),
          creditBalance('USDC', KEYS.ISSUER, 1250.75),
          creditBalance('AQUA', KEYS.ISSUER, 18500),
        ],
        signers: [{ key: KEYS.RETAIL, weight: 1, type: 'ed25519_public_key' }],
      }),
    },
    {
      address: KEYS.MARKET_MAKER,
      label: 'Testnet Market Maker',
      description: 'High-volume testnet liquidity provider with multi-asset trustlines and 2-of-3 multisig.',
      tags: ['institutional', 'multisig', 'market_maker'],
      account: accountRecord({
        address: KEYS.MARKET_MAKER,
        sequence: '782910492810992',
        subentry_count: 4,
        last_modified_ledger: 53120408,
        last_modified_time: isoOffset(0, 2),
        balances: [
          nativeBalance(450000),
          creditBalance('USDC', KEYS.ISSUER, 65200),
          creditBalance('BTC', KEYS.ISSUER, 4.25),
        ],
        signers: [
          { key: KEYS.MARKET_MAKER, weight: 1, type: 'ed25519_public_key' },
          { key: KEYS.ISSUER, weight: 1, type: 'ed25519_public_key' },
          { key: KEYS.TREASURY, weight: 1, type: 'ed25519_public_key' },
        ],
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 2 },
        flags: { auth_required: false, auth_revocable: false, auth_immutable: true },
      }),
    },
    {
      address: KEYS.TREASURY,
      label: 'Testnet Soroban Treasury',
      description: 'Soroban demo treasury interacting with the bundled token, AMM and registry contracts.',
      tags: ['soroban', 'treasury', 'contracts'],
      account: accountRecord({
        address: KEYS.TREASURY,
        sequence: '582049281048100',
        subentry_count: 2,
        last_modified_ledger: 53120405,
        last_modified_time: isoOffset(0, 3),
        balances: [nativeBalance(75000), creditBalance('USDC', KEYS.ISSUER, 142500)],
        signers: [{ key: KEYS.TREASURY, weight: 1, type: 'ed25519_public_key' }],
      }),
    },
  ];
}

function buildContracts() {
  return [
    {
      contractId: CONTRACTS.TOKEN,
      name: 'Demo Token (DMO)',
      description: 'SEP-41 style fungible token with mint, transfer and balance queries.',
      category: 'token',
      deployedAt: isoOffset(0, 240),
      callCount: 312,
      functions: ['initialize', 'mint', 'transfer', 'balance'],
    },
    {
      contractId: CONTRACTS.AMM,
      name: 'Demo AMM Pool',
      description: 'Constant-product liquidity pool used by the curated DEX history.',
      category: 'liquidity_pool',
      deployedAt: isoOffset(0, 216),
      callCount: 176,
      functions: ['swap', 'deposit', 'withdraw', 'get_reserves'],
    },
    {
      contractId: CONTRACTS.REGISTRY,
      name: 'Demo Registry',
      description: 'Read-only registry mapping demo accounts to their roles.',
      category: 'registry',
      deployedAt: isoOffset(0, 192),
      callCount: 88,
      functions: ['register', 'lookup', 'list'],
    },
  ];
}

const TX_SPECS = [
  { hoursAgo: 1, operation_count: 1, fee_charged: '100', memo: 'demo-payment' },
  { hoursAgo: 2, operation_count: 2, fee_charged: '200', memo: null },
  { hoursAgo: 3, operation_count: 1, fee_charged: '100', memo: 'invoke-token' },
  { hoursAgo: 5, operation_count: 1, fee_charged: '100', memo: null },
  { hoursAgo: 8, operation_count: 1, fee_charged: '100', memo: 'swap' },
  { hoursAgo: 13, operation_count: 1, fee_charged: '100', memo: null },
  { hoursAgo: 21, operation_count: 1, fee_charged: '100', memo: 'mint' },
  { hoursAgo: 34, operation_count: 1, fee_charged: '100', memo: null },
];

function hexHash(seed) {
  return seed.toString(16).padStart(64, '0').slice(-64);
}

function buildTransactions(anchorMs, address) {
  return TX_SPECS.map((spec, index) => {
    const hash = hexHash(0xde00 + index);
    return {
      id: hash,
      paging_token: String(53120300 + index),
      successful: true,
      hash,
      ledger: 53120300 + index,
      created_at: isoOffset(anchorMs, spec.hoursAgo),
      source_account: address,
      source_account_sequence: String(192045000120000 + index),
      fee_account: address,
      fee_charged: spec.fee_charged,
      max_fee: spec.fee_charged,
      operation_count: spec.operation_count,
      envelope_xdr: '',
      result_xdr: '',
      result_meta_xdr: '',
      memo_type: spec.memo ? 'text' : 'none',
      memo: spec.memo,
    };
  });
}

function buildOperations(anchorMs, address) {
  const ops = [];
  TX_SPECS.forEach((spec, index) => {
    const hash = hexHash(0xde00 + index);
    const created_at = isoOffset(anchorMs, spec.hoursAgo);
    const paging_token = `${53120300 + index}-1`;

    if (index % 3 === 2) {
      ops.push({
        id: String(900000 + index),
        paging_token,
        transaction_hash: hash,
        transaction_successful: true,
        type: 'invoke_host_function',
        type_i: 24,
        created_at,
        source_account: address,
        function: 'host_function',
        contract_id: index === 2 ? CONTRACTS.TOKEN : CONTRACTS.AMM,
      });
    } else if (index % 3 === 1) {
      ops.push({
        id: String(900000 + index),
        paging_token,
        transaction_hash: hash,
        transaction_successful: true,
        type: 'manage_sell_offer',
        type_i: 3,
        created_at,
        source_account: address,
        offer_id: String(1000 + index),
        amount: '500.0000000',
        price: '0.1265000',
        price_r: { n: 253, d: 2000 },
        buying_asset_type: 'credit_alphanum4',
        buying_asset_code: 'USDC',
        buying_asset_issuer: KEYS.ISSUER,
        selling_asset_type: 'native',
      });
    } else {
      ops.push({
        id: String(900000 + index),
        paging_token,
        transaction_hash: hash,
        transaction_successful: true,
        type: 'payment',
        type_i: 1,
        created_at,
        source_account: address,
        asset_type: 'native',
        from: address,
        to: KEYS.MARKET_MAKER,
        amount: '250.0000000',
      });
    }
  });
  return ops;
}

export function buildDemoFixture(anchor = DEFAULT_ANCHOR) {
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) {
    throw new Error(`Invalid --anchor value: '${anchor}'. Expected an ISO-8601 timestamp.`);
  }

  const accounts = buildAccounts();
  return {
    version: 1,
    network: 'testnet',
    anchor: new Date(anchorMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    generatedBy: 'scripts/seed-demo-fixtures.mjs',
    accounts,
    contracts: buildContracts(),
    transactions: buildTransactions(anchorMs, accounts[0].address),
    operations: buildOperations(anchorMs, accounts[0].address),
  };
}

function serialize(fixture) {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const checkIndex = args.indexOf('--check');
  const anchorIndex = args.indexOf('--anchor');
  const anchor = anchorIndex !== -1 ? args[anchorIndex + 1] : DEFAULT_ANCHOR;

  if (anchorIndex !== -1 && !anchor) {
    console.error('--anchor requires an ISO-8601 timestamp value.');
    process.exit(1);
  }

  const fixture = buildDemoFixture(anchor);
  const expected = serialize(fixture);

  if (checkIndex !== -1) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`Missing demo fixture: ${OUTPUT_PATH}`);
      process.exit(1);
    }
    const actual = readFileSync(OUTPUT_PATH, 'utf8');
    if (actual !== expected) {
      console.error('Demo fixture is stale. Run: node scripts/seed-demo-fixtures.mjs');
      process.exit(1);
    }
    console.log('Demo fixtures are up to date.');
    return;
  }

  writeFileSync(OUTPUT_PATH, expected, 'utf8');
  const totals = `${fixture.accounts.length} accounts, ${fixture.contracts.length} contracts, ` +
    `${fixture.transactions.length} transactions, ${fixture.operations.length} operations`;
  console.log(`Wrote ${OUTPUT_PATH} (${totals}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
