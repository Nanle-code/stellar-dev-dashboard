# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Pre-sign risk summary** ([#982](https://github.com/Nanle-code/stellar-dev-dashboard/issues/982)).
  Every transaction is now parsed and described in plain language before it
  reaches a wallet, so an operation that irreversibly changes an account cannot
  be signed unread.
  - `src/lib/riskRules.js` — a declarative, pure ruleset covering master-key
    disable, signer and threshold changes, account merge, trustline removal and
    unlimited trustlines, `allowTrust` and `setTrustLineFlags` authorization
    changes, large native payments, and unapproved Soroban contract calls.
  - `src/lib/riskSummary.js` — assembles the ruleset into a per-transaction
    summary, derives expected balance changes, and folds in a best-effort
    Soroban simulation. Synchronous, pure, and unable to throw for a malformed
    transaction.
  - `src/components/security/RiskSummaryPanel.jsx` — an accessible
    `alertdialog` describing each operation, its severity, and its balance
    effects. High-risk transactions cannot be proceeded with until the
    acknowledgement checkbox is ticked; low-risk ones are not slowed by an extra
    step.
  - `src/hooks/usePreSignRiskSummary.js` — the shared parse → load → simulate →
    summarise → acknowledge state machine, so every signing surface behaves
    identically.
- Pre-sign review wired into all four signing surfaces: `<TransactionSigner>`
  (including XDR pasted from outside the dashboard), `<SignatureCollector>`,
  `<AnchorIntegration>` (SEP-10 challenges), and `signAndSubmitTransaction()`.
- An opt-in known-contract list, persisted locally, with a one-click "add this
  contract to my known list" affordance in the review dialog. Ships empty, so
  every contract call is flagged until the user approves it.
- Documentation: [`docs/api/riskRules.md`](docs/api/riskRules.md),
  [`docs/api/riskSummary.md`](docs/api/riskSummary.md), plus updates to
  [`docs/components.md`](docs/components.md),
  [`docs/api/transactionBuilder.md`](docs/api/transactionBuilder.md) and
  [`SECURITY.md`](SECURITY.md).
- 127 new tests across the ruleset, the engine, the hook, the dialog, and the
  pasted-XDR signing flow — including per-rule boundary coverage, fee-bump
  attribution, simulation-failure degradation, the acknowledgement gate, and a
  check that the envelope signed is the one that was reviewed.

### Fixed

- The large-payment thresholds are now scoped to native (XLM) payments. They are
  denominated in XLM, so applying them to a credit-asset payment both mislabelled
  the summary and compared a USDC amount against an XLM balance.
- `normaliseAllowlist()` no longer throws when handed a `Set`.
- `computeRiskSummary()` now tolerates an explicit `null` context, which a
  default parameter does not cover.
