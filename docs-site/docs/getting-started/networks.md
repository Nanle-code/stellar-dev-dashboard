---
id: networks
title: Networks
sidebar_label: Networks
---

# Networks

## Available networks

| Network | Horizon URL | Soroban RPC URL | Passphrase | Faucet |
|---|---|---|---|---|
| **Testnet** | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` | `https://friendbot.stellar.org` |
| **Mainnet** | `https://horizon.stellar.org` | `https://soroban-rpc.stellar.org` | `Public Global Stellar Network ; September 2015` | — |
| **Futurenet** | `https://horizon-futurenet.stellar.org` | `https://rpc-futurenet.stellar.org` | `Test SDF Future Network ; October 2022` | `https://friendbot-futurenet.stellar.org` |
| **Local** | `http://localhost:8000` | `http://localhost:8000` | `Standalone Network ; February 2017` | `http://localhost:8000/friendbot` |

## Switching networks in the dashboard

The active network is controlled by the `VITE_STELLAR_NETWORK` environment variable or the in-app network selector. The app reads the configured network from `src/lib/config.js` via `getEnvironmentConfig()`.

```js
import { getEnvironmentConfig } from '@/lib/config';

const { horizonUrl, sorobanUrl, networkPassphrase } = getEnvironmentConfig();
```

## Custom network

To connect to a custom network (e.g., a private Stellar node):

```js
import { updateCustomNetworkConfig } from '@/lib/stellar';

updateCustomNetworkConfig({
  horizonUrl: 'http://my-node:8000',
  sorobanRpcUrl: 'http://my-node:8001',
  networkPassphrase: 'My Private Stellar Network ; 2024',
});
```

## Friendbot (Testnet funding)

Fund any testnet account instantly with 10,000 XLM:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

```js
const response = await fetch(
  `https://friendbot.stellar.org?addr=${publicKey}`
);
const { hash } = await response.json();
console.log('Funded! Transaction:', hash);
```

## Local Quickstart network (#1004)

For development against a fully local network, the repository ships a Docker
Compose profile that runs the official [Stellar Quickstart](https://github.com/stellar/quickstart)
image in standalone mode and seeds it with deterministic fixtures.

```bash
# Start Quickstart + the dashboard dev server, then seed the chain
docker compose --profile local up -d --build
docker compose --profile local up seed   # one-shot, idempotent

# or seed from the host against a running Quickstart
npm run seed:local
```

Endpoints exposed on the host:

| Endpoint | URL |
|---|---|
| Horizon | `http://localhost:8000` |
| Friendbot | `http://localhost:8000/friendbot` |
| Soroban RPC | `http://localhost:8000/rpc` |
| Stellar Lab | `http://localhost:8000/lab` |
| Dashboard (Vite) | `http://localhost:5173` |

The dashboard's Vite dev server inside the profile receives
`VITE_STELLAR_NETWORK=local`; the browser talks to Horizon over
`http://localhost:8000`, which matches the `local` entry in `NETWORKS`
(`src/lib/stellar.ts`) — including the local friendbot faucet.

### Seeded fixtures

`scripts/seed-local-stellar.mjs` is idempotent — rerun it at any time and it
skips work that already exists:

1. Waits for Horizon and Soroban RPC readiness.
2. Funds four deterministic accounts (`seed-buyer`, `seed-issuer`,
   `seed-offer-a`, `seed-offer-b`) via the local friendbot.
3. Issues 1,000,000 XDEMO and 500,000 USDC from the issuer.
4. Creates trustlines for the accounts that hold the assets.
5. Creates three deterministic SDEX sell offers (ids 1001–1003:
   XDEMO/XLM, XLM/XDEMO, USDC/XLM).
6. Deposits into the XLM/XDEMO constant-product liquidity pool.
7. Deploys the Stellar Asset Contract (SAC) for XDEMO.
8. Verifies every fixture and exits non-zero on failure.

The account keys are derived from fixed public labels so the fixtures are
reproducible across resets. **They are for the throwaway standalone network
only** — never fund these addresses on testnet or mainnet, and never reuse
these derivation rules for real accounts.

### Environment variables

| Variable | Default | Used by |
|---|---|---|
| `STELLAR_SEED_HORIZON_URL` | `http://localhost:8000` | seeder (Horizon) |
| `STELLAR_SEED_RPC_URL` | `http://localhost:8000/rpc` | seeder (Soroban RPC) |
| `STELLAR_SEED_TIMEOUT` | `180` seconds | seeder (readiness budget) |
| `VITE_STELLAR_NETWORK` | — | dashboard (set to `local` by the compose profile) |

### Resetting and troubleshooting

```bash
# Reset the chain (removes ledger state and all fixtures)
docker compose --profile local down -v

# Re-seed after a reset
docker compose --profile local up -d --build && docker compose --profile local up seed
```

- **Seeder exits with `Horizon ... was not ready within ...`** — Quickstart is
  still starting or failed to start. Check `docker compose --profile local logs
  stellar`; first boot can take a minute or two. The seed service waits for the
  Quickstart healthcheck before running, so this usually only appears when
  running `npm run seed:local` from the host before the node is ready.
- **Friendbot 5xx during funding** — the seeder retries transient failures;
  persistent failures mean the standalone core is unhealthy (see the logs).
- **`Transaction rejected` / failed SAC deploy** — the standalone network may
  have been reset mid-run; rerun the seeder, it re-creates what is missing.
- **Resource usage** — a Quickstart node runs stellar-core, Horizon, PostgreSQL
  and (on `--local`) an RPC service; budget roughly 2 GB of RAM for it.
