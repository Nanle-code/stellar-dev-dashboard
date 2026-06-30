# API Error Code Reference

This document serves as the developer reference for all categories of errors thrown or handled by the **Stellar Dev Dashboard** API layers and modules (primarily `src/lib/errorHandling.ts`, `stellar.ts`, and `contractInvoker.js`).

---

## 1. Error Categories and HTTP Mappings

The application maps all integration failures into a unified set of categories defined by the `ErrorCategory` enum. Below is the mapping table showing how HTTP status codes from Horizon, Soroban RPC, CoinGecko, and local validation map to these categories:

| HTTP Status | Category | Code / Identifier | User Message / Scenario | Retryable |
|-------------|----------|-------------------|-------------------------|-----------|
| `400` | `VALIDATION` | `bad_request` | Invalid parameters or malformed transaction XDR. | No |
| `401` | `AUTHENTICATION` | `unauthorized` | Freighter or Ledger wallet is not connected or approved. | No |
| `403` | `AUTHORIZATION` | `forbidden` | Access to the requested resource is denied. | No |
| `404` | `NOT_FOUND` | `not_found` | Stellar account or transaction hash does not exist on-chain. | No |
| `409` | `CONFLICT` | `conflict` | State conflict (e.g. transaction sequence gap). | No |
| `429` | `RATE_LIMIT` | `rate_limit_exceeded` | Horizon or CoinGecko rate limit has been exceeded. | **Yes** |
| `500` | `SERVER_ERROR` | `internal_server_error` | The remote server encountered an unexpected error. | **Yes** |
| `502` | `SERVER_ERROR` | `bad_gateway` | Horizon gateway failed to communicate with the core node. | **Yes** |
| `503` | `SERVER_ERROR` | `service_unavailable` | Service is down for maintenance or overloaded. | **Yes** |
| `504` | `TIMEOUT` | `gateway_timeout` | The request took too long to resolve. | **Yes** |
| — | `NETWORK` | `network_failed` | Client has lost internet connectivity or CORS blocked the call. | **Yes** |
| — | `TIMEOUT` | `client_timeout` | The local request timed out (default limit reached). | **Yes** |

---

## 2. Stellar Horizon Operation Result Codes

When submitting a transaction via `POST /transactions` or simulating via `simulateTransaction`, Horizon/Soroban returns specific result codes in the `result_codes` block inside `extras`.

Here are the most common result codes you must handle in integrations:

### Transaction-Level Codes (`result_codes.transaction`)

| Code | Meaning | Root Cause / Resolution |
|------|---------|-------------------------|
| `tx_success` | Success | The transaction was included in a ledger block. |
| `tx_failed` | Failed | One or more operations failed. Inspect `result_codes.operations`. |
| `tx_too_early` | Too Early | Ledger time is before the transaction's `time_bounds.min_time`. |
| `tx_too_late` | Too Late | Ledger time is after the transaction's `time_bounds.max_time`. |
| `tx_bad_seq` | Bad Sequence | The source account's sequence number does not match. Increment sequence by 1. |
| `tx_bad_auth` | Bad Auth | Invalid signatures, or signature weight is below threshold. |
| `tx_insufficient_balance` | Insufficient Balance | The source account cannot pay the fee in XLM. |
| `tx_insufficient_fee` | Insufficient Fee | The fee bid is below the current base fee multiplier for high-activity blocks. |

### Operation-Level Codes (`result_codes.operations`)

| Operation Code | Scenario | Recommended Action |
|----------------|----------|--------------------|
| `op_success` | Operation succeeded. | None. |
| `op_no_destination` | The destination account does not exist. | Create the account first using `createAccount`, or check key. |
| `op_no_trust` | The destination does not have a trustline for the asset. | Recipient must execute a `changeTrust` operation first. |
| `op_underfunded` | The source account has insufficient balance for the amount. | Fund the account or reduce transfer quantity. |
| `op_low_reserve` | The transfer would drop the account below the minimum base reserve. | Account must maintain `(2 + subentries) * 0.5 XLM`. |
| `op_src_not_authorized` | The source account is not authorized to hold this asset. | Issuer has auth_required enabled and has not approved the account. |

---

## 3. Soroban Smart Contract RPC Error Codes

Soroban RPC returns standard JSON-RPC 2.0 error payloads when the request format or VM execution fails.

| Error Code | Error Type | Scenario |
|------------|------------|----------|
| `-32600` | Invalid Request | The JSON sent is not a valid Request object. |
| `-32601` | Method Not Found | The JSON-RPC method does not exist (e.g. spelling error). |
| `-32602` | Invalid Params | Invalid method parameters (e.g. wrong transaction XDR format). |
| `-32603` | Internal Error | Internal JSON-RPC error. |
| `-32001` | Action Failed | The requested action could not be completed. |
| `-32002` | Contract Code Malformed | The contract bytecode failed loading / verification. |

### Soroban VM Invocation Result Codes

If `simulateTransaction` succeeds but the transaction itself fails, the simulation `status` will be `error`, and it will contain `events` or `logs` with the following error structures:

```json
{
  "jsonrpc": "2.0",
  "id": "sim-fail",
  "result": {
    "latestLedger": 5493205,
    "status": "error",
    "error": "ContractError(102)",
    "events": [
      {
        "type": "system",
        "ledger": 5493205,
        "contractId": "CBXG...",
        "topics": ["error"],
        "value": "AAAAAQAAAGY="
      }
    ],
    "logs": [
      "VM Error: contract panicked with error code 102"
    ]
  }
}
```

---

## 4. Developer Recovery Strategies (Code Reference)

In `src/lib/errorHandling.ts`, developers should utilize the `retryWithBackoff` wrapper to handle transient `RATE_LIMIT` (429) and `SERVER_ERROR` (5xx) codes safely:

```ts
import { retryWithBackoff } from '@/lib/errorHandling';

async function fetchWithRetry(publicKey: string) {
  return await retryWithBackoff(
    async () => {
      const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${publicKey}`);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      return await response.json();
    },
    3,    // Max retries
    1000  // Base delay (1s, becomes 2s, 4s...)
  );
}
```
