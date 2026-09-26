# Stellar Dev Dashboard

Real-time developer dashboard for the Stellar network: accounts, transactions, Soroban tooling, portfolio analytics, and AI-assisted fee prediction.

## Quick start

### Requirements

- **Node.js:** 22 through 26 only (`package.json` engines: `>=22 <27`)
- **pnpm:** 9+ (required; do not use npm or yarn for installs)
- **Unsupported:** Node.js 18 and 20

### Install and run
corepack enable
pnpm install
pnpm run check:node
pnpm run check:package-manager
pnpm dev
App runs at http://localhost:5173 (Vite default).

Optional API:
pnpm run api:start
## Feature map

- **Getting started:** `docs-site/docs/getting-started/`
- **Guides:** `docs-site/docs/guides/`
- **Portfolio analytics:** `docs-site/docs/guides/portfolio/`
- **Mobile / responsive:** `docs-site/docs/guides/mobile/`
- **API reference:** `docs-site/docs/api-reference/`
- **Fee prediction (ML):** docs-site guides; scripts `pnpm run ml:train` and `pnpm run ml:server`
- **Security:** `SECURITY.md`
- **Canary / ops:** `docs/CANARY_DEPLOYMENT.md` (if present under `docs/`)

## Documentation site

Full navigable docs (Docusaurus):
cd docs-site
npm install
npm start
## Package manager

This repository uses **pnpm** and the repo lockfile. Remove any accidental `package-lock.json` before installing.

## Testing
pnpm test
pnpm run docs:validate-drift
pnpm run check:node
## Compatibility and security

- Node.js must be 22–26. Validate with `pnpm run check:node`.
- Ledger signing: Chromium browsers with WebUSB/WebHID; see docs-site guides.
- API auth: Bearer tokens on protected routes; see docs-site API reference.
- Report vulnerabilities via `SECURITY.md`.

## Contributing

See `CONTRIBUTING.md` if present, and documentation under `docs-site/`.

## License

See the repository `LICENSE` file if present.
