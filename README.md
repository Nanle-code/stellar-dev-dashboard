# Stellar Dev Dashboard

Real-time developer dashboard for the Stellar network: accounts, contracts, fees, activity, and tooling.

Full guides live in the docs site under docs-site/. This README is only the entry point.

## Requirements

- Node.js: 22.x to 26.x (engines: >=22 <27)
- pnpm: 9+ (this repo package manager)

Install:

    corepack enable
    pnpm install
    pnpm run check:node
    pnpm run check:package-manager

Supported: Node 22-26 with pnpm 9+ and the repo lockfile.
Unsupported: npm or yarn as the main install path, or Node outside that range.
If package-lock.json appears, remove it before install.

## Quick start

    git clone https://github.com/Nanle-code/stellar-dev-dashboard.git
    cd stellar-dev-dashboard
    corepack enable
    pnpm install
    pnpm dev

Open the URL Vite prints (usually http://localhost:5173).

Useful commands:

- pnpm dev — local app
- pnpm test — unit tests
- pnpm run type-check — TypeScript
- pnpm run build — production build

## Features

- Network-aware account and contract views
- Transaction building and simulation helpers
- Fee insights and related tooling
- Demo / read-only explore flows where enabled

Details and how-tos are in docs-site, not in long root markdown files.

## Documentation

- Docs site: docs-site/
- Contributing: CONTRIBUTING.md
- Security: SECURITY.md
- Code of conduct: CODE_OF_CONDUCT.md
- Changelog: CHANGELOG.md

Root one-off guides were moved under docs-site/docs so there is one navigable docs home.

## Architecture: Shared Core Package

Since 2026, platform-agnostic Stellar logic is extracted into a shared workspace package:

- **`packages/core/`** — `@stellar-dev-dashboard/core`
  - Network configuration (`NETWORKS`, `getServer`, `getSorobanServer`)
  - Validation (addresses, amounts, memos, contracts, URLs)
  - Formatters (XLM, addresses, stroops, dates, relative time)
  - Address utilities (validation, resolution, SEP-29 memo check)
  - Reserve calculations
  - Operation labels
  - High-level services (`fetchAccount`, `fetchTransactions`, `fetchNetworkStats`, `fetchXLMPrice`)
  - Comprehensive test suite

- **Web app (`src/`)** — Imports from `@stellar-dev-dashboard/core`, keeps web-specific code (rate limiting, request coalescing, browser storage, network probing)
- **Mobile app (`mobile/`)** — Imports from `@stellar-dev-dashboard/core`, keeps mobile-specific code (AsyncStorage caching, React Native hooks)

This eliminates parity issues (#883) by ensuring both platforms share identical validation, formatting, and data-access logic.

See `packages/core/README.md` for full API reference and migration notes.

## License

### SEP-38 Integration
- **Quotes**: Added support for SEP-38 Quotes API. Now discovers ANCHOR_QUOTE_SERVER and can retrieve /info, /prices, /price and request authenticated /quote.
- **Security**: Authentication leverages SEP-10 tokens for quotes. Be aware that tokens can expire, and quotes have an expiration window handled gracefully with a countdown timer.
...
...
