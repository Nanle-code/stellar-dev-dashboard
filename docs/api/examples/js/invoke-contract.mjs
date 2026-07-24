/**
 * Invoke a Soroban smart contract function on the Stellar testnet.
 *
 * Full flow: simulate → prepare → sign → send → poll.
 *
 * Usage:
 *   node docs/api/examples/js/invoke-contract.mjs <SECRET_KEY> <CONTRACT_ID> <FUNCTION_NAME>
 *
 * Example:
 *   node docs/api/examples/js/invoke-contract.mjs SXXX... CBXG... increment
 */

import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  scValToNative,
  Keypair,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;

async function invokeContract({ secretKey, contractId, functionName, args = [] }) {
  const rpc = new SorobanRpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(secretKey);

  console.log('Loading account...');
  const account = await rpc.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);

  // Build unsigned transaction
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(30)
    .build();

  // Simulate
  console.log('Simulating...');
  const simResult = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    console.error('✗ Simulation failed:', simResult.error);
    process.exit(1);
  }

  console.log('  Min resource fee :', simResult.minResourceFee, 'stroops');
  console.log('  CPU instructions :', simResult.cost?.cpuInsns);
  console.log('  Memory bytes     :', simResult.cost?.memBytes);

  // Prepare
  const preparedTx = await rpc.prepareTransaction(tx);

  // Sign
  preparedTx.sign(keypair);

  // Send
  console.log('Sending...');
  const sendResult = await rpc.sendTransaction(preparedTx);

  if (sendResult.status === 'ERROR') {
    console.error('✗ Send failed:', sendResult.errorResult);
    process.exit(1);
  }

  console.log('  Hash  :', sendResult.hash);
  console.log('  Status:', sendResult.status);

  // Poll
  console.log('Polling for confirmation...');
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await rpc.getTransaction(sendResult.hash);

    process.stdout.write(`  Attempt ${i + 1}: ${result.status}\r`);

    if (result.status === 'SUCCESS') {
      console.log('\n✓ Contract call succeeded!');
      if (result.returnValue) {
        const native = scValToNative(result.returnValue);
        console.log('  Return value:', native);
      } else {
        console.log('  Return value: (none / unit)');
      }
      return result.returnValue;
    }

    if (result.status === 'FAILED') {
      console.error('\n✗ Contract call failed:', result.resultXdr);
      process.exit(1);
    }
  }

  console.error('\n✗ Timed out waiting for confirmation.');
  process.exit(1);
}

const [, , secretKey, contractId, functionName] = process.argv;
if (!secretKey || !contractId || !functionName) {
  console.error('Usage: node invoke-contract.mjs <SECRET> <CONTRACT_ID> <FUNCTION_NAME>');
  process.exit(1);
}

invokeContract({ secretKey, contractId, functionName });
