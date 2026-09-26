# Migrating to @stellar/stellar-sdk 17.x (#970)

## Version

- From: `@stellar/stellar-sdk` ^12.3.0
- To: `@stellar/stellar-sdk` ^17.1.0

## Breaking changes applied

| Change | Migration |
|--------|-----------|
| `SorobanRpc` renamed to `rpc` | `StellarSdk.SorobanRpc.*` → `StellarSdk.rpc.*` |
| `new SorobanRpc.Server` | `new rpc.Server` |
| `SorobanRpc.Api.*` | `rpc.Api.*` |
| `SorobanRpc.Durability` | `rpc.Durability` |
| Node for SDK 17 | Prefer Node >= 22.12.0 within repo policy 22–26 |
| Some SDK returns are `Uint8Array` not `Buffer` | Avoid `buffer.toString('hex')` on raw SDK bytes without converting |

## Unchanged

- Horizon: still `StellarSdk.Horizon.Server`
- App helper name `getSorobanServer` (wrapper only)
- Network `sorobanUrl` config keys

## Verify
