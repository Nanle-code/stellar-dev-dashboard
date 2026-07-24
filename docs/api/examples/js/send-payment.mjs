/**
 * Send an XLM payment on the Stellar testnet.
 *
 * Usage:
 *   node docs/api/examples/js/send-payment.mjs <SECRET_KEY> <DESTINATION> <AMOUNT> [MEMO]
 *
 * Example:
 *   node docs/api/examples/js/send-payment.mjs SXXX... GDEST... 10 "Hello"
 */

import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Keypair,
  Memo,
} from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';

async function sendXlmPayment({ secretKey, destination, amount, memo }) {
  const server = new Horizon.Server(HORIZON_URL);
  const keypair = Keypair.fromSecret(secretKey);
  const sourceAccount = await server.loadAccount(keypair.publicKey());

  const builder = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  }).addOperation(
    Operation.payment({
      destination,
      asset: Asset.native(),
      amount: String(amount),
    })
  );

  if (memo) builder.addMemo(Memo.text(String(memo)));

  const tx = builder.setTimeout(180).build();
  tx.sign(keypair);

  try {
    const result = await server.submitTransaction(tx);
    console.log('✓ Payment successful!');
    console.log('  Hash  :', result.hash);
    console.log('  Ledger:', result.ledger);
    console.log('  Fee   :', result.fee_charged, 'stroops');
    return result;
  } catch (err) {
    const codes = err.response?.data?.extras?.result_codes;
    if (codes) {
      console.error('✗ Transaction failed');
      console.error('  Transaction code:', codes.transaction);
      console.error('  Operation codes :', codes.operations);
    } else {
      console.error('✗ Error:', err.message);
    }
    process.exit(1);
  }
}

const [, , secretKey, destination, amount = '1', memo] = process.argv;
if (!secretKey || !destination) {
  console.error('Usage: node send-payment.mjs <SECRET_KEY> <DESTINATION> <AMOUNT> [MEMO]');
  process.exit(1);
}

sendXlmPayment({ secretKey, destination, amount, memo });
