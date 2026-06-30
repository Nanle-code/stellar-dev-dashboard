# API Request / Response Samples

This page provides exact, real-world examples of HTTP request payloads and corresponding server responses for the primary API integrations used by the **Stellar Dev Dashboard**.

You can run the `curl` examples directly in your terminal to see live network responses.

---

## 1. Horizon: Account Details

Retrieve core account details, sequence numbers, thresholds, signers, and asset trustline balances.

> [!NOTE]
> All balances are represented as strings to preserve decimal precision, avoiding IEEE-754 floating point inaccuracies.

### Request (cURL)
```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GD3W47O7L6J22XCQNFSK3L2V3N45EPEHPEH4J46EPEH4J46EPEH4J46E"
```

### Response (200 OK)
```json
{
  "id": "GD3W47O7L6J22XCQNFSK3L2V3N45EPEHPEH4J46EPEH4J46EPEH4J46E",
  "account_id": "GD3W47O7L6J22XCQNFSK3L2V3N45EPEHPEH4J46EPEH4J46EPEH4J46E",
  "sequence": "125893021482",
  "subentry_count": 2,
  "last_modified_ledger": 5493201,
  "last_modified_time": "2026-06-02T08:45:12Z",
  "thresholds": {
    "low_threshold": 0,
    "med_threshold": 1,
    "high_threshold": 2
  },
  "flags": {
    "auth_required": false,
    "auth_revocable": false,
    "auth_immutable": false,
    "auth_clawback_enabled": true
  },
  "balances": [
    {
      "balance": "1240.4019234",
      "liquidity_pool_id": "",
      "limit": "",
      "buying_liabilities": "0.0000000",
      "selling_liabilities": "0.0000000",
      "asset_type": "native"
    },
    {
      "balance": "500.0000000",
      "limit": "922337203685.4775807",
      "buying_liabilities": "0.0000000",
      "selling_liabilities": "0.0000000",
      "asset_type": "credit_alphanum4",
      "asset_code": "USDC",
      "asset_issuer": "GBBDQG4GBFFKFA65K7Z4C6EPEH4J46EPEH4J46EPEH4J46EPEH4J46E"
    }
  ],
  "signers": [
    {
      "weight": 1,
      "key": "GD3W47O7L6J22XCQNFSK3L2V3N45EPEHPEH4J46EPEH4J46EPEH4J46E",
      "type": "ed25519_public_key"
    }
  ]
}
```

---

## 2. Horizon: Submit Transaction

Submit a signed TransactionEnvelope XDR to Horizon to be included in a ledger block.

### Request (cURL)
```bash
curl -X POST "https://horizon-testnet.stellar.org/transactions" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'tx=AAAAAgAAAADcR+U8H9v...YOUR_SIGNED_XDR_HERE...'
```

### Success Response (200 OK)
```json
{
  "id": "8c3bcf5273f7c469b61d4ff1ee8deabfe64e223d6a6234b3f86e92ab0310214a",
  "hash": "8c3bcf5273f7c469b61d4ff1ee8deabfe64e223d6a6234b3f86e92ab0310214a",
  "ledger": 5493205,
  "envelope_xdr": "AAAAAgAAAADcR+U8H9v...",
  "result_xdr": "AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAAAAAAAAQ==",
  "result_meta_xdr": "AAAAAQAAAAAAAAAA...",
  "fee_charged": "100"
}
```

### Error Response (400 Bad Request / Transaction Failed)
```json
{
  "type": "https://stellar.org/horizon-errors/transaction_failed",
  "title": "Transaction Failed",
  "status": 400,
  "detail": "The transaction execution failed on the ledger. Check the result_codes for details.",
  "extras": {
    "envelope_xdr": "AAAAAgAAAADcR...",
    "result_xdr": "AAAAAAAAAHwAAAAAA...",
    "result_codes": {
      "transaction": "tx_failed",
      "operations": [
        "op_no_destination"
      ]
    }
  }
}
```

---

## 3. Soroban RPC: simulateTransaction

Simulate contract invocation before committing it to the blockchain. Essential for estimating resource costs (CPU, memory, storage) and generating the footprint.

### Request (cURL)
```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "sim-1",
    "method": "simulateTransaction",
    "params": {
      "transaction": "AAAAAgAAAADcR+U8H9v...UNSIGNED_TX_ENVELOPE_XDR..."
    }
  }'
```

### Response (200 OK)
```json
{
  "jsonrpc": "2.0",
  "id": "sim-1",
  "result": {
    "latestLedger": 5493220,
    "status": "success",
    "results": [
      {
        "xdr": "AAAAEAAAAAE="
      }
    ],
    "cost": {
      "cpuInsns": 182390,
      "memBytes": 42091
    },
    "footprint": {
      "readOnly": [
        {
          "type": "ledgerKeyContractData",
          "contractId": "CBXG...",
          "key": "AAAAEAAAAAE="
        }
      ],
      "readWrite": []
    }
  }
}
```

---

## 4. Soroban RPC: sendTransaction

Submit a signed transaction to a Soroban contract. This is an asynchronous process; the RPC server returns a submission status and transaction hash, which can then be polled using `getTransaction`.

### Request (cURL)
```bash
curl -s -X POST "https://soroban-testnet.stellar.org" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "send-1",
    "method": "sendTransaction",
    "params": {
      "transaction": "AAAAAgAAAADcR+U8H9v...SIGNED_TX_ENVELOPE_XDR..."
    }
  }'
```

### Response (200 OK)
```json
{
  "jsonrpc": "2.0",
  "id": "send-1",
  "result": {
    "hash": "4a737f...TRANSACTION_HASH...",
    "status": "PENDING",
    "latestLedger": 5493222,
    "latestLedgerCloseTime": 1772491200
  }
}
```

---

## 5. CoinGecko: Simple Price

Fetch live USD exchange rates and 24-hour fluctuations for XLM and mapped trustline tokens.

### Request (cURL)
```bash
curl -s "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true"
```

### Response (200 OK)
```json
{
  "stellar": {
    "usd": 0.114532,
    "usd_24h_change": 3.4561234901
  }
}
```

---

## 6. Friendbot: Faucet Funding

Deposit 10,000 XLM into an account on the Testnet network.

### Request (cURL)
```bash
curl -s "https://friendbot.stellar.org?addr=GD3W47O7L6J22XCQNFSK3L2V3N45EPEHPEH4J46EPEH4J46EPEH4J46E"
```

### Response (200 OK)
```json
{
  "hash": "a0fb4cfe3e...TRANSACTION_HASH...",
  "ledger": 5493240
}
```
