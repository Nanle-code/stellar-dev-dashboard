---
id: simulate-transaction
title: simulateTransaction
sidebar_label: simulateTransaction
---

# simulateTransaction

Dry-run a transaction against the current ledger state. Returns the fee estimate, resource footprint (CPU, memory, storage), and the contract return value — **without committing anything to the blockchain**.

Always simulate before sending. The simulation result includes the `footprint` and `auth` data that must be injected back into the transaction before signing.

## Request

```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "sim-1",
    "method": "simulateTransaction",
    "params": {
      "transaction": "AAAAAgAAAAD...UNSIGNED_TX_XDR..."
    }
  }'
```

```js
import { SorobanRpc, TransactionBuilder, Networks, Contract, nativeToScVal } from '@stellar/stellar-sdk';

const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');

// 1. Build the unsigned transaction
const account = await rpc.getAccount('GABC...SOURCE');
const contract = new Contract('CBXG...CONTRACT_ID');

const tx = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(contract.call('increment', nativeToScVal(1, { type: 'u32' })))
  .setTimeout(30)
  .build();

// 2. Simulate
const simResult = await rpc.simulateTransaction(tx);

if (SorobanRpc.Api.isSimulationError(simResult)) {
  throw new Error(`Simulation failed: ${simResult.error}`);
}

// 3. Prepare (injects footprint + auth into the tx)
const preparedTx = await rpc.prepareTransaction(tx);
console.log('Estimated fee:', simResult.minResourceFee, 'stroops');
```

```python
from stellar_sdk import SorobanServer, TransactionBuilder, Network, Contract
from stellar_sdk.soroban_rpc import SimulateTransactionResponse

server = SorobanServer("https://soroban-testnet.stellar.org")
account = server.load_account("GABC...SOURCE")

contract = Contract("CBXG...CONTRACT_ID")
tx = (
    TransactionBuilder(account, Network.TESTNET_NETWORK_PASSPHRASE, base_fee=100)
    .append_invoke_contract_function_op(
        contract_id="CBXG...CONTRACT_ID",
        function_name="increment",
        parameters=[],
    )
    .set_timeout(30)
    .build()
)

sim: SimulateTransactionResponse = server.simulate_transaction(tx)
print("Min resource fee:", sim.min_resource_fee)

prepared_tx = server.prepare_transaction(tx, sim)
```

## Success response

```json
{
  "jsonrpc": "2.0",
  "id": "sim-1",
  "result": {
    "latestLedger": 5493220,
    "status": "success",
    "results": [
      { "xdr": "AAAAEAAAAAE=" }
    ],
    "cost": {
      "cpuInsns": "182390",
      "memBytes": "42091"
    },
    "minResourceFee": "58432",
    "footprint": {
      "readOnly": [
        {
          "type": "contractCode",
          "hash": "abc123..."
        }
      ],
      "readWrite": [
        {
          "type": "contractData",
          "contract": "CBXG...",
          "key": "AAAAEAAAAAE="
        }
      ]
    }
  }
}
```

## Error response — simulation failed

```json
{
  "jsonrpc": "2.0",
  "id": "sim-1",
  "result": {
    "latestLedger": 5493220,
    "error": "HostError: Value(InvalidInput)\n  ...",
    "events": []
  }
}
```

## Fields reference

| Field | Type | Description |
|---|---|---|
| `results[].xdr` | string | Base64 XDR of the contract return value |
| `cost.cpuInsns` | string | CPU instructions consumed |
| `cost.memBytes` | string | Memory bytes consumed |
| `minResourceFee` | string | Minimum fee in stroops to include this transaction |
| `footprint.readOnly` | array | Ledger keys read but not written |
| `footprint.readWrite` | array | Ledger keys that will be written |

:::tip Always use prepareTransaction
After a successful simulation, call `rpc.prepareTransaction(tx, simResult)` before signing. This injects the footprint, auth entries, and optimal fee automatically.
:::
