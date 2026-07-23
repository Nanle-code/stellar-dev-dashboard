/**
 * Add a trustline so an account can hold a custom Stellar asset.
 *
 * Usage:
 *   node docs/api/examples/js/create-trustline.mjs <SECRET_KEY> <ASSET_CODE> <ASSET_ISSUER> [LIMIT]
 *
 * Example (add USDC trustline):
 *   node docs/api/examples/js/create-trustline.mjs SXXX... USDC GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
 */

import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Keypair,
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

async function createTrustline({ secretKey, assetCode, assetIssuer, limit }) {
  const server = new Horizon.Server(HORIZON_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const asset = new Asset(assetCode, assetIssuer);
  const xlmBalance = parseFloat(
    account.balances.find(b => b.asset_type === 'native')?.balance ?? '0'
  );
  const minBalance = (2 + account.subentry_count + 1) * 0.5;

  if (xlmBalance < minBalance) {
    console.error(`Insufficient XLM. Need at least ${minBalance} XLM (have ${xlmBalance}).`);
    process.exit(1);
  }

  const op = limit !== undefined
    ? Operation.changeTrust({ asset, limit: String(limit) })
    : Operation.changeTrust({ asset });

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  tx.sign(keypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('✓ Trustline created!');
    console.log('  Asset :', `${assetCode}:${assetIssuer.slice(0, 8)}...`);
    console.log('  Limit :', limit ?? 'maximum');
    console.log('  Hash  :', result.hash);
    return result;
  } catch (err) {
    const codes = err.response?.data?.extras?.result_codes;
    console.error('✗ Failed:', codes ?? err.message);
    process.exit(1);
  }
}

const [, , secretKey, assetCode, assetIssuer, limit] = process.argv;
if (!secretKey || !assetCode || !assetIssuer) {
  console.error('Usage: node create-trustline.mjs <SECRET> <ASSET_CODE> <ISSUER> [LIMIT]');
  process.exit(1);
}

createTrustline({ secretKey, assetCode, assetIssuer, limit });
