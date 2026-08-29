# ADR-0004: Soroban Developer Tooling

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Stellar Dev Dashboard maintainers
- **Area:** Soroban tooling

## Context

Developers use the dashboard to scaffold, test, deploy, and invoke Soroban smart
contracts without leaving the browser or installing the Rust toolchain. The
canonical off-chain workflow (`soroban-cli`, `cargo build`) remains the source of
truth; the dashboard provides an in-app complement: template scaffolding, simulated
test/coverage runs, deployment planning and cost estimation, WASM inspection, and
on-chain invocation through Soroban RPC. Requirements:

- Generate correct starter contracts and deployment commands for
  `soroban contract deploy`.
- Give quick, deterministic feedback on contract tests and coverage without a
  Rust toolchain up front.
- Enforce safe defaults: mainnet submissions are simulation-only until explicitly
  confirmed in the UI.
- Handle invalid input (bad XDR, bad WASM, malformed constructor args) and
  unsupported environments with clear errors.

## Decision

Keep the four building blocks separated by concern:

- **Scaffolding** ([`src/lib/contractDevelopment.js`](../../src/lib/contractDevelopment.js)):
  `getContractTemplates()` returns `token`, `escrow`, and `oracle` templates with
  metadata, entrypoints, source, `#[test]` fixtures, and a ready-to-run
  `soroban contract deploy` command. `buildContractWorkspace()` derives a workspace
  id, contract/package name, and tests. `generateDeploymentPlan()` composes the
  canonical CLI command plus a deploy checklist and a WASM hash placeholder;
  `downloadScaffold()` emits a JSON bundle (spec + README + source).
- **Simulated test runner & coverage**
  ([`src/lib/contractTestRunner.ts`](../../src/lib/contractTestRunner.ts)):
  `runContractTests(source, tests)` extracts `#[contractimpl]` functions and
  `#[test]` blocks, counts assertions
  (`assert!`, `assert_eq!`, `assert_ne!`, `assert_approx_eq!`, `unwrap`,
  `expect`), computes function/line coverage, and simulates per-test outcomes.
  Failure detection is explicit: `panic!` without `should_panic`,
  `todo!`/`unimplemented!`, bodies too short to assert, and tests that invoke no
  contract function or SDK built-in are reported as failed. `exportTestReport()`
  renders JSON or text.
- **Deployment tooling**
  ([`src/lib/deployment/WASMProcessor.ts`](../../src/lib/deployment/WASMProcessor.ts),
  [`CostEstimator.ts`](../../src/lib/deployment/CostEstimator.ts),
  [`ContractDeployer.ts`](../../src/lib/deployment/ContractDeployer.ts)):
  WASM files are parsed and hashed with SHA-256 via WebCrypto, falling back to a
  FNV-1a hash when Web Crypto is absent (keeps receipts deterministic in tests);
  a 20MB upload cap is enforced. Constructor args are normalised (empty values
  dropped, typed `int`/`bool`/`address`/`bytes` encoded to ScVal-style strings) and
  cost estimates (fee stroops, footprint, arg count) are attached to a deployment
  receipt with source account, network, explorer URLs, and a status timeline.
  **Mainnet runs return simulation-only results** with an explicit error message.
- **Invocation**
  ([`src/lib/contractInvoker.js`](../../src/lib/contractInvoker.js),
  [`src/lib/stellar.ts`](../../src/lib/stellar.ts)): the canonical flow is
  build → `simulateTransaction` → `prepareTransaction` → sign (wallet via
  [ADR-0001](./adr-0001-wallet-integration.md), or simulation) → `sendTransaction`,
  with validation through `isValidContractId`/`isValidPublicKey` and tolerant
  ScVal/response decoding. Contract metadata reads are cached through
  `sorobanCacheManager` (see [ADR-0002](./adr-0002-caching-strategy.md)).

## Consequences

- **Pros:** a complete scaffold→test→deploy→invoke loop inside the dashboard;
  deterministic simulated feedback before spending XLM; mainnet safety by default.
- **Cons:** simulated tests are heuristics — they cannot replace `cargo test`
  against the real Soroban environment, and coverage is best-effort static
  analysis; CLI command generation must track `soroban-cli` flag changes; contract
  IDs/hashes for local dev are placeholders until a real build produces artifacts.

## Compatibility & Migration

- Scaffold output targets Rust 1.70+ with `wasm32-unknown-unknown` and
  `soroban-cli`; the generated README and deploy plans document those
  prerequisites.
- The runner parses Rust 2018+ `#[contractimpl]` syntax; hyphenated/odd macro
  layouts may need manual coverage tweaks.
- When rising fees or resource prices change, `CostEstimator` thresholds should be
  updated in lockstep with Soroban RPC behaviour.
- Deploy receipts are versioned per `specVersion` in exported specs; consumers
  should tolerate unknown fields.

## Security Considerations

- Mainnet `sendTransaction` is simulation-only; real submissions require explicit
  UI confirmation and wallet signing (per ADR-0001).
- Never embed secret keys or source accounts in generated commands; deploy plans
  use `<SOURCE_ACCOUNT>` placeholders and remind the user to verify balances.
- WASM inspection hashes and inspects metadata only; no code execution of untrusted
  wasm occurs in the browser.
- Constructor argument values are normalised/escaped before inclusion in any
  generated command to avoid shell injection.

## Invalid Input, Unsupported Environments & Failure Paths

- **Unknown template id:** `getContractTemplateById` returns `null`; build/export/
  download functions throw "Template not found".
- **Incomplete source/tests:** simulation reports "Source code is incomplete",
  missing `#[contractimpl]`, or "No #[test] function found" issues and marks the
  run failed.
- **No tests found:** the runner returns a report with a single skipped "(no tests
  found)" entry and zero coverage rather than throwing.
- **Invalid XDR:** Ledger/`stellar.ts` paths reject malformed transaction envelopes
  before any peer interaction.
- **Oversized WASM:** files above the 20MB cap are rejected at parse time.
- **Missing Web Crypto:** hashing falls back to FNV-1a with documented lower
  collision-resistance; receipts remain deterministic.
- **Unsupported browser surfacing:** deployment simulation is available everywhere;
  real submission paths surface their own wallet/network requirements.

## Alternatives Considered

- **Shelling out to `soroban-cli` from the browser** — rejected: no native binary
  in the client; the CLI commands are generated for copy-paste execution instead.
- **Executing wasm in the browser for real tests** — rejected: wasm runtime in
  jsdom/browsers is heavy and unproven here; simulated tests plus documented
  `cargo test` guidance cover the loop.
- **Defaulting mainnet submission on** — rejected on safety grounds.

## References

- [`src/lib/contractDevelopment.js`](../../src/lib/contractDevelopment.js)
- [`src/lib/contractTestRunner.ts`](../../src/lib/contractTestRunner.ts)
- [`src/lib/contractInvoker.js`](../../src/lib/contractInvoker.js)
- [`src/lib/deployment/ContractDeployer.ts`](../../src/lib/deployment/ContractDeployer.ts)
- [`src/lib/deployment/WASMProcessor.ts`](../../src/lib/deployment/WASMProcessor.ts)
- [`src/lib/deployment/CostEstimator.ts`](../../src/lib/deployment/CostEstimator.ts)
- [`src/lib/stellar.ts`](../../src/lib/stellar.ts)
- [Soroban best practices](../SOROBAN_BEST_PRACTICES.md)
- [Soroban debugging guide](../SOROBAN_DEBUGGING_GUIDE.md)
- Related: [ADR-0001: wallet integration](./adr-0001-wallet-integration.md),
  [ADR-0002: caching](./adr-0002-caching-strategy.md)