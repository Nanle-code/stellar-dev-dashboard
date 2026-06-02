# API Request / Response Samples

This document provides direct HTTP request and sample response payloads for common Stellar Horizon and Soroban RPC operations.

## Horizon: Account Details

Request:

```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GDFE3..." | jq .
```

Response sample:

```json
{
  "id": "GDFE3...",
  "account_id": "GDFE3...",
  "sequence": "1234567890123456",
  "balances": [
    {
      "balance": "100.0000000",
      "asset_type": "native"
    }
  ],
  "signers": [
    {
      "key": "GDFE3...",
      "weight": 1,
      "type": "ed25519_public_key"
    }
  ]
}
```

## Horizon: Submit Transaction

Request:

```bash
curl -X POST "https://horizon-testnet.stellar.org/transactions" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'tx=AAAA...'
```

Sample response:

```json
{
  "hash": "abcdef123456...",
  "ledger": 5601234,
  "envelope_xdr": "AAAA...",
  "result_xdr": "AAAAAAAA..."
}
```

## Soroban RPC: simulateTransaction

Request:

```bash
curl -s "https://soroban-testnet.stellar.org/soroban/rpc" \
  -H 'Content-Type: application/json' \
  -d '{"id": "1", "method": "simulateTransaction", "params": [{"tx": "AAAA..."}]}'
```

Response sample:

```json
{
  "id": "1",
  "result": {
    "status": "success",
    "results": [],
    "cost": {
      "cpu_insns": 12345,
      "mem_bytes": 6789
    }
  }
}
```
