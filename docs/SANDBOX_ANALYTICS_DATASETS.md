# Sandbox Analytics Datasets & Education Materials Guide

> Developer reference and educational guidance for using anonymized sandbox datasets (#908).

See full technical documentation at [docs/features/sandbox-analytics-datasets.md](./features/sandbox-analytics-datasets.md).

## Quick Summary

- **Objective**: Provide anonymized sample account and trade datasets for demos without Mainnet credentials.
- **Fixtures**: Located in `src/fixtures/sandboxDatasets.ts` and `tests/__factories__/sandboxFixtures.js`.
- **Service**: `src/lib/sandboxAnalytics.ts` provides validated querying, VWAP/OHLC analytics calculation, portfolio valuation, and environment protection.
- **Tutorial**: Added tutorial `tut-4` ("Sandbox Analytics Demos") in the Learning Hub (`src/lib/learningHub.ts`).
- **Interactive UI**: Demo component available at `src/components/dashboard/SandboxAnalyticsDemo.tsx`.

## Key Archetypes & Pairs

- **Accounts**: Retail Trader (`retail_active`), Institutional Market Maker (`institutional_market_maker`), Protocol Treasury (`soroban_dapp_treasury`), and New Onboarding User (`new_onboarded_sandbox`).
- **Trades**: `XLM/USDC`, `AQUA/XLM`, and `BTC/USDC` orderbook and liquidity pool time-series trades.

## Security & Compatibility

- **Zero Secret Keys**: Synthetic Ed25519 addresses only.
- **Environment Guard**: Rejects queries on `mainnet`/`production` without `allowMainnetDemo: true`.
- **Runtimes**: Node 22-26, modern browsers.
