---
id: installation
title: Installation
sidebar_label: Installation
---

# Installation

## Dashboard (React app)

```bash
git clone https://github.com/damiedee96/stellar-dev-dashboard.git
cd stellar-dev-dashboard
npm install
npm run dev          # starts Vite dev server at http://localhost:5173
```

## SDK only (library usage)

### JavaScript / TypeScript

```bash
npm install @stellar/stellar-sdk
# or
yarn add @stellar/stellar-sdk
# or
pnpm add @stellar/stellar-sdk
```

### Python

```bash
pip install stellar-sdk
# recommended: pin to a specific version
pip install stellar-sdk==10.0.0
```

## Environment configuration

Copy the example env file and set your preferred network:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|---|---|---|
| `VITE_STELLAR_NETWORK` | `testnet` | Active network (`testnet` / `mainnet` / `futurenet`) |
| `VITE_HORIZON_URL` | auto | Override Horizon base URL |
| `VITE_SOROBAN_URL` | auto | Override Soroban RPC base URL |
| `VITE_COINGECKO_API_KEY` | — | Optional CoinGecko Pro key for higher rate limits |

## Run the documentation site locally

```bash
cd docs-site
npm install
npm start            # http://localhost:3000
```

## Build the documentation site

```bash
cd docs-site
npm run build        # outputs to docs-site/build/
npm run serve        # preview the production build
```
