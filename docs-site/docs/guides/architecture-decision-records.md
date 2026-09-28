---
id: architecture-decision-records
title: Architecture Decision Records
sidebar_label: Architecture Decision Records
---

# Architecture Decision Records

Architecture decisions for the Stellar Dev Dashboard core modules are recorded as
lightweight Architecture Decision Records (ADRs). Each ADR captures the context,
the decision, its consequences, and the compatibility, security, and failure-path
handling that engineers must respect.

## Records

| ADR | Area | Decision |
|---|---|---|
| [ADR-0001: Wallet Integration](https://github.com/damiedee96/stellar-dev-dashboard/blob/master/docs/adrs/adr-0001-wallet-integration.md) | Wallet integration | Plugin-style connector layer (`freighter`, `xbull`, `Ledger`, `WalletConnect`, `LOBSTR`, `solar`) behind a common contract with per-provider failure paths. |
| [ADR-0002: Multi-Layer Caching](https://github.com/damiedee96/stellar-dev-dashboard/blob/master/docs/adrs/adr-0002-caching-strategy.md) | Caching | `CacheManager` v2 facade over L1 in-memory LRU, L2 IndexedDB, and L3 service worker with stale-while-revalidate and SWR/revalidation. |
| [ADR-0003: Offline Read-Only Mode](https://github.com/damiedee96/stellar-dev-dashboard/blob/master/docs/adrs/adr-0003-offline-mode.md) | Offline mode | `offlineReadOnly` contract — `DataSource` provenance, heartbeated `NetworkStatus`, `WriteSafetyGate`, and replayable offline writes. |
| [ADR-0004: Soroban Developer Tooling](https://github.com/damiedee96/stellar-dev-dashboard/blob/master/docs/adrs/adr-0004-soroban-tooling.md) | Soroban tooling | Separate scaffolding, simulated test runner, deployment tooling (20MB WASM cap, SHA-256 hashing), and invocation flow; mainnet is simulation-only. |

## Where the ADRs live

The ADR files are stored in `docs/adrs/` at the repository root, alongside the
other developer-facing documentation:

- `docs/adrs/README.md` — index and "how to add an ADR" instructions
- `docs/adrs/adr-000N-<slug>.md` — individual records

All ADRs open with a header (Status, Date, Deciders, Area) and follow a required
section skeleton: Context, Decision, Consequences, Compatibility & Migration,
Security Considerations, Invalid Input / Unsupported Environments / Failure Paths,
Alternatives Considered, and References.

## How to add an ADR

1. Copy the latest `adr-000N-*.md` and increment the sequence number.
2. Fill in the header block with `Status`, `Date`, `Deciders`, and `Area`.
3. Keep the required section skeleton so the drift validator and automated tests
   stay green.
4. Link code paths with repository-relative links (e.g. `src/lib/...`).
5. Update the table in `docs/adrs/README.md` and this page.

The repository's commit checks run `npm run docs:validate-drift`, which flags
missing `docs/` files, broken internal links, and references to npm scripts that do
not exist. Automated tests in `tests/docs/adrDocs.test.ts` assert that the records
exist, are indexed, use valid headers, and resolve their internal links.