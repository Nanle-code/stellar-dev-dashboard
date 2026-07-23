# API Changelog

## 0.2.0 — D-012: Comprehensive API Documentation

### Added

- **Docusaurus documentation site** (`docs-site/`) with dark theme matching the dashboard aesthetic
  - Getting Started section: Introduction, Installation, Quick Start, Authentication, Networks
  - Full API Reference: Horizon (accounts, transactions, operations, submit), Soroban RPC (simulate, send, poll, contract data, events), External Services (CoinGecko, Friendbot)
  - Error Reference and Rate Limiting reference pages
  - Code Examples: JS/TS and Python for fetch-account, send-payment, create-trustline, invoke-contract, DEX swap, stream-transactions
  - Error scenario walkthroughs: transaction-failed, rate-limit, insufficient-funds
  - Guides: Getting Started, Soroban Smart Contracts, Error Handling, Rate Limiting, Troubleshooting
  - Interactive API Explorer page with OpenAPI spec integration
  - Docusaurus OpenAPI docs plugin (`docusaurus-plugin-openapi-docs`) for live "Try it out" against the spec

- **Expanded runnable example scripts**
  - `docs/api/examples/js/send-payment.mjs` — XLM payment with full error handling
  - `docs/api/examples/js/create-trustline.mjs` — trustline creation with reserve check
  - `docs/api/examples/js/invoke-contract.mjs` — full Soroban invocation (simulate → prepare → sign → send → poll)
  - `docs/api/examples/python/send_payment.py` — XLM payment via stellar-sdk
  - `docs/api/examples/python/create_trustline.py` — trustline with reserve validation
  - `docs/api/examples/python/invoke_contract.py` — Soroban contract invocation from Python

- **CI/CD pipeline** (`.github/workflows/docs.yml`)
  - Auto-regenerates `API_REFERENCE.md` from JSDoc on every push
  - Validates JS and Python example syntax
  - Builds Docusaurus site
  - Deploys to GitHub Pages on merge to master

- **Updated `SDK_EXAMPLES.md`** with links to all new examples and the docs site

## 0.1.0

- Added auto-generated API reference generation for `src/lib` exports.
- Added live, runnable SDK examples for JavaScript and Python.
- Added request/response sample documentation for Horizon and Soroban RPC.
- Added version history support to API docs.
