---
id: networks
title: Networks
sidebar_label: Networks
---

# Networks

## Available networks

| Network | Horizon URL | Soroban RPC URL | Passphrase |
|---|---|---|---|
| **Testnet** | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` | `Test SDF Network ; September 2015` |
| **Mainnet** | `https://horizon.stellar.org` | `https://soroban-rpc.stellar.org` | `Public Global Stellar Network ; September 2015` |
| **Futurenet** | `https://horizon-futurenet.stellar.org` | `https://rpc-futurenet.stellar.org` | `Test SDF Future Network ; October 2022` |
| **Local** | `http://localhost:8000` | `http://localhost:8000` | _(custom)_ |

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
