---
id: error-reference
title: Error Reference
sidebar_label: Error Reference
---

# Error Reference

All errors from Horizon, Soroban RPC, and CoinGecko are normalized by the dashboard into a unified `ErrorContext` shape. This page is the complete lookup for every error code and category.

## HTTP status → ErrorCategory mapping

| HTTP Status | Category | Code | Retryable? |
|---|---|---|---|
| `400` | `VALIDATION` | `bad_request` | No |
| `401` | `AUTHENTICATION` | `unauthorized` | No |
| `403` | `AUTHORIZATION` | `forbidden` | No |
| `404` | `NOT_FOUND` | `not_found` | No |
| `409` | `CONFLICT` | `conflict` | No |
| `429` | `RATE_LIMIT` | `rate_limit_exceeded` | **Yes** |
| `500` | `SERVER_ERROR` | `internal_server_error` | **Yes** |
| `502` | `SERVER_ERROR` | `bad_gateway` | **Yes** |
| `503` | `SERVER_ERROR` | `service_unavailable` | **Yes** |
| `504` | `TIMEOUT` | `gateway_timeout` | **Yes** |
| — | `NETWORK` | `network_failed` | **Yes** |
| — | `TIMEOUT` | `client_timeout` | **Yes** |

## Horizon transaction result codes

### Transaction-level (`result_codes.transaction`)

| Code | Meaning | Fix |
|---|---|---|
| `tx_success` | Included successfully | — |
| `tx_failed` | One or more operations failed | Check `result_codes.operations` |
| `tx_too_early` | Before `timeBounds.minTime` | Wait or adjust timebounds |
| `tx_too_late` | After `timeBounds.maxTime` | Increase `setTimeout` |
| `tx_missing_operation` | No operations in transaction | Add at least one operation |
| `tx_bad_seq` | Stale sequence number | Reload account and rebuild |
| `tx_bad_auth` | Invalid or insufficient signatures | Check keypair and signer weights |
| `tx_insufficient_balance` | Can't pay the fee | Fund the source account |
| `tx_no_source_account` | Source account not found | Account doesn't exist on network |
| `tx_insufficient_fee` | Fee below network minimum | Increase `baseFee` |
| `tx_bad_auth_extra` | Signatures provided but not needed | Remove extra signatures |
| `tx_internal_error` | Stellar node internal error | Retry later |

### Operation-level (`result_codes.operations`)

| Code | Meaning | Fix |
|---|---|---|
| `op_success` | Operation succeeded | — |
| `op_no_destination` | Destination doesn't exist | Create account first |
| `op_no_trust` | No trustline for asset | Recipient must run `changeTrust` |
| `op_underfunded` | Insufficient balance | Fund account or reduce amount |
| `op_low_reserve` | Drops below minimum reserve | Fund or remove subentries |
| `op_src_not_authorized` | Not authorized to hold asset | Contact issuer for authorization |
| `op_no_issuer` | Asset issuer not found | Check asset issuer public key |
| `op_not_authorized` | Destination not authorized | Issuer auth_required is enabled |
| `op_self_not_allowed` | Cannot send to self | Use a different destination |
| `op_line_full` | Trustline limit reached | Recipient must increase limit |

## Soroban RPC error codes

| Code | Type | Description |
|---|---|---|
| `-32600` | `InvalidRequest` | Malformed JSON-RPC request |
| `-32601` | `MethodNotFound` | Unknown RPC method |
| `-32602` | `InvalidParams` | Wrong parameters (e.g. bad XDR) |
| `-32603` | `InternalError` | Server-side internal error |
| `-32001` | `ActionFailed` | Action could not be completed |
| `-32002` | `ContractCodeMalformed` | WASM bytecode invalid |

## Soroban HostError types (simulation/invocation failures)

| Error | Cause |
|---|---|
| `Value(InvalidInput)` | Argument type or value rejected |
| `Auth(InvalidAction)` | Caller not authorized |
| `Auth(NotAuthorized)` | Auth entry not provided |
| `Storage(MissingValue)` | Reading a key that doesn't exist |
| `Storage(ExistingValue)` | Creating a key that already exists |
| `Budget(CpuLimitExceeded)` | Contract used too much CPU |
| `Budget(MemLimitExceeded)` | Contract used too much memory |
| `WasmVm(InvalidAction)` | WASM execution trap |

## CoinGecko errors

| Status | Cause | Fix |
|---|---|---|
| `429` | Rate limit exceeded | Add `VITE_COINGECKO_API_KEY` or reduce request frequency |
| `404` | Unknown asset ID | Check the CoinGecko asset ID (use `stellar` for XLM) |
