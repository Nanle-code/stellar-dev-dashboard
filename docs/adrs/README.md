# Architecture Decision Records

This directory records the significant architecture decisions for the Stellar Dev
Dashboard. Each record captures the context, the decision, its consequences, and
the compatibility, security, and failure-path implications of the choice.

ADRs are immutable once marked **Accepted**; new changes are added as new ADRs that
reference the superseded record.

## How to add an ADR

1. Copy the next free number (`adr-NNNN-<slug>.md`).
2. Fill in the status, date, deciders, and area header.
3. Keep the `## Context`, `## Decision`, and `## Consequences` sections.
4. Document failure paths, unsupported environments, compatibility, migration, and
   security notes — reviewers treat these as mandatory.
5. Add a link to the record in the index below and (for user-facing changes) to the
   published docs site.

## Index

| ADR | Title | Status | Area |
|-----|-------|--------|------|
| [ADR-0001](./adr-0001-wallet-integration.md) | Wallet integration strategy | Accepted | Wallet integration |
| [ADR-0002](./adr-0002-caching-strategy.md) | Multi-layer caching strategy | Accepted | Caching |
| [ADR-0003](./adr-0003-offline-mode.md) | Offline read-only mode | Accepted | Offline mode |
| [ADR-0004](./adr-0004-soroban-tooling.md) | Soroban developer tooling | Accepted | Soroban tooling |

## Related documentation

- [API documentation](../api/README.md) — Horizon, Soroban RPC, and external services.
- [Soroban best practices](../SOROBAN_BEST_PRACTICES.md) — authoring guidance for contracts.
- [Soroban debugging guide](../SOROBAN_DEBUGGING_GUIDE.md) — diagnosing contract issues.
- [Performance notes](../PERFORMANCE.md) — latency and budget guidance.