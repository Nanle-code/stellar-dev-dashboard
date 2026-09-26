# Wallet Adapter Integration

The dashboard routes wallet connection and transaction signing through `src/lib/wallet/adapters.ts`. Each `WalletAdapter` exposes `connect`, `getAddress`, `getNetwork`, `signTransaction`, `signAuthEntry`, `disconnect`, and declared capabilities. Add new wallet implementations to the registry rather than adding wallet-specific branches to dashboard components.

## Compatibility

The picker includes Freighter, xBull, Albedo, LOBSTR, Hana, Ledger, and WalletConnect, and retains Solar for compatibility with the existing dashboard. Freighter, xBull, LOBSTR, and Solar use their existing injected connectors. Albedo requires its browser API; Hana requires an injected `window.hana` provider implementing the methods used by its adapter. WalletConnect requires its existing optional `@walletconnect/sign-client` and `@walletconnect/modal` packages plus `VITE_WALLETCONNECT_PROJECT_ID` in the Vite environment. Ledger requires WebUSB or WebHID, the existing Ledger transport package, and `@stellar/ledger`.

Adapters report capabilities explicitly. Ledger supports transaction signing but not authorization-entry signing. Albedo reports no authorization-entry support until its provider offers that operation. A missing provider network query is treated as unknown, not as a match: signing is refused until the adapter can confirm the active network. Albedo is the exception because its intent API takes an explicit network per request; its remembered network is the intent scope, and signing still validates the XDR against that network. Ledger has no independent network selection, so its transaction XDR is validated using the dashboard network passphrase before the device is asked to sign.

## Security Notes

Before a signature request, the adapter compares the provider's current network with the dashboard network and parses transaction XDR against that network's Stellar passphrase. A mismatch or unknown network prevents the wallet prompt. Do not weaken these checks to make a provider work; extend its `getNetwork` implementation to return a verified network identifier instead. Wallet adapters never receive secret keys.

## E2E Tests

Wallet e2e flows use the generic `mockWalletAdapter` fixture controls. The fixture exposes the mock through the Freighter-compatible injected API so it exercises the same adapter boundary as the browser extension. Unit tests for the registry live under `src/lib/wallet/__tests__`.