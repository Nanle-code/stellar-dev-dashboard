# Stellar Dev Dashboard

Real-time developer dashboard for the Stellar network: accounts, transactions,
Soroban tooling, portfolio analytics, and AI-assisted fee prediction.

![Dashboard screenshot](docs-site/static/img/dashboard-preview.png)

> If the image is missing, add a screenshot at `docs-site/static/img/dashboard-preview.png` or remove this line until one exists.

## Quick start

**Requirements**

| Tool | Supported |
|------|-----------|
| **Node.js** | **22–26** only (`package.json` engines: `>=22 <27`) |
| **pnpm** | 9+ (repo standard; do not use npm/yarn for installs) |

Node 18 and 20 are **unsupported**.

```bash
corepack enable
pnpm install
pnpm run check:node
pnpm run check:package-manager
pnpm dev
App: http://localhost:5173 (Vite default).
pnpm run api:start   # optional API
Feature map
Area
Docs
Getting started
docs-site
Guides (payments, Soroban, DEX, …)
docs-site/docs/guides
Portfolio analytics
docs-site/docs/guides/portfolio
Mobile / responsive
docs-site/docs/guides/mobile
API reference
docs-site/docs/api-reference
Fee prediction (ML)
See guides + pnpm run ml:train / ml:server
Security policy
SECURITY.md
Canary / ops
docs/CANARY_DEPLOYMENT.md (if present under docs/)
Full navigable docs (Docusaurus):
cd docs-site && npm install && npm start
Package manager
Use pnpm and the repo lockfile. Remove any accidental package-lock.json before install.
Testing
pnpm test
pnpm run docs:validate-drift
pnpm run check:node
Compatibility & security
Node: 22–26 only; validate with pnpm run check:node.
Ledger: Chromium + WebUSB/WebHID; see docs-site guides for details.
API auth: Bearer tokens on protected routes; see docs-site API reference.
Report vulnerabilities via SECURITY.md.
Contributing
See CONTRIBUTING.md if present, and docs under docs-site/.
License
See repository LICENSE if present.
