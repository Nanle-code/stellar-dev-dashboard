---
id: authentication
title: Authentication & Wallet Connection
sidebar_label: Authentication
---

# Authentication & Wallet Connection

The dashboard is **read-only by default** — no authentication is needed to query balances, transactions, or ledger data. Authentication is only required when signing and submitting transactions.

## Supported wallets

| Wallet | Type | Platform |
|---|---|---|
| **Freighter** | Browser extension | Chrome, Firefox, Brave |
| **Ledger** | Hardware wallet | USB / Bluetooth |
| **Secret key** | In-memory (dev only) | Any |

:::danger Never use secret keys in production
Secret key signing is provided for local development and testing only. Never expose secret keys in a browser environment used by real users.
:::

## Freighter integration

```ts
import freighter from '@stellar/freighter-api';

// Check if Freighter is installed
const isConnected = await freighter.isConnected();
if (!isConnected) {
  throw new Error('Please install the Freighter browser extension.');
}

// Request the user's public key
const { address } = await freighter.getAddress();
console.log('Connected account:', address);

// Sign a transaction XDR
const signedXdr = await freighter.signTransaction(transactionXdr, {
  networkPassphrase: 'Test SDF Network ; September 2015',
});
```

## Checking the connected network

```ts
const { network, networkPassphrase } = await freighter.getNetwork();
// network: 'TESTNET' | 'PUBLIC' | 'FUTURENET' | 'CUSTOM'
```

## Network passphrases

| Network | Passphrase |
|---|---|
| Mainnet | `Public Global Stellar Network ; September 2015` |
| Testnet | `Test SDF Network ; September 2015` |
| Futurenet | `Test SDF Future Network ; October 2022` |

## Biometric authentication (dashboard feature)

The dashboard supports WebAuthn-based biometric authentication for session management. This is handled by `src/lib/biometricAuth.ts`:

```ts
import { registerBiometric, loginBiometric, isBiometricSupported } from '@/lib/biometricAuth';

if (isBiometricSupported()) {
  // Register on first use
  await registerBiometric({ username: 'my-account' });

  // Authenticate on subsequent visits
  await loginBiometric();
}
```
