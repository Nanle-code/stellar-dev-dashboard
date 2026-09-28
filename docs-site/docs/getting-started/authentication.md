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

## Freighter session lifecycle

The dashboard mounts global Freighter session listeners at the layout level (not only on the wallet tab). The app reacts when Freighter:

- **Locks** — wallet session is revoked and connected account data is cleared.
- **Disconnects** — same as lock; stale signing state is removed.
- **Changes account** — both `walletPublicKey` and `connectedAddress` update and account data is refetched.
- **Changes network** — the dashboard network switches when the Freighter network maps to a supported value (`PUBLIC` → mainnet, `TESTNET` → testnet, etc.). Unsupported networks revoke the session.

Implementation:

- Connector: `src/lib/wallet/freighter.js`
- Session listener: `src/lib/wallet/sessionListeners.ts`
- Store action: `revokeWalletSession(reason)`

### Security and compatibility

- Session revocation clears wallet identity **and** cached account state to prevent signing or displaying stale data.
- Freighter custom DOM events are supported, with polling fallback when the extension does not emit events.
- This does **not** revoke Freighter extension permissions; users must disconnect from the extension separately if required.

### Migration notes

Integrations that only listened inside `WalletConnect` should move session handling to the global listener hook (`useWalletSessionListeners`) so behavior remains consistent across tabs.

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
