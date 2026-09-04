# ADR-0001: Wallet Integration Strategy

- **Status:** Accepted
- **Date:** 2026-08-29
- **Deciders:** Stellar Dev Dashboard maintainers
- **Area:** wallet integration

## Context

The dashboard must let developers connect Stellar wallets to authenticate, read
balances, build transactions, and sign XDR before submission. Wallets span four
device classes:

1. Browser extension wallets (Freighter, xBull, Lobstr, Solar) that inject a global
   API into the page.
2. Hardware wallets (Ledger) that sign locally over WebUSB/WebHID.
3. Mobile / cross-device wallets reached through WalletConnect v2
   (Lobstr, xBull Mobile, Solar, and any WalletConnect-compatible Stellar wallet).
4. Read-only / watch-only flows (no signing at all).

Requirements:

- Private keys must never leave the wallet; the app never holds or requests secret keys.
- Bundle size must not grow with every wallet SDK; unsupported wallets must fail
  closed with actionable errors rather than silently degrading.
- A uniform connect/sign surface so UI components and DID authentication
  ([`src/lib/didAuth.ts`](../../src/lib/didAuth.ts)) do not depend on wallet specifics.
- Clear handling for invalid input, unsupported environments, and signing failures.

## Decision

Adopt a plugin-style connector layer under
`src/lib/wallet/` (e.g. [`freighter.js`](../../src/lib/wallet/freighter.js)) with a
common contract:

- `is<Wallet>Installed()` — capability probe.
- `connect<Wallet>() -> Promise<{ publicKey, network }>`.
- `signTransactionXdr / signXdrWith<Wallet>(xdr, networkPassphrase)` — returns a
  signed XDR base64 string; connectors normalise vendor response shapes.

Specifics:

- **Freighter** (`freighter.js`): read the injected `window.freighterApi` (CDN
  SDK loaded from `@stellar/freighter-api`) and expose `requestAccess`,
  `getAddress`, `getNetwork`, and `signTransaction`. Account/network/lock change
  events are surfaced for revalidation.
- **xBull** (`xbull.js`): use the injected `window.xBullWalletConnect` extension
  API and fall back to the `@creit.tech/xbull-wallet-connect` connector library for
  mobile/cross-origin.
- **Lobstr / Solar** (`lobstr.js`, `solar.js`): extension + WalletConnect-based
  mobile connectors.
- **Ledger** (`ledger.js`): optional peer dependencies
  `@ledgerhq/hw-transport-webusb`, `@ledgerhq/hw-transport-webhid`, and
  `@stellar/ledger`, dynamically imported. WebUSB preferred with WebHID fallback;
  only offered when `navigator.usb`/`navigator.hid` is present. Commits signatures
  to the parsed transaction and returns the signed envelope.
- **WalletConnect v2** (`walletconnect.js`): optional `@walletconnect/sign-client`
  and `@walletconnect/modal`, using the `stellar` namespace with
  `stellar_signXDR` / `stellar_getPublicKey` methods and `stellar:pubnet` /
  `stellar:testnet` chains. The public key is parsed from the session account
  string `stellar:<chain>:<G...>`.
- **Security layer** (`security.js`, `hardwareWalletSecurity.ts`): phishing-marker
  detection before signing, transaction confirmation summaries, a local security
  audit log, and a session security-posture score per wallet type.
- **UI wiring:** [`WalletConnect.tsx`](../../src/components/dashboard/WalletConnect.tsx)
  maps the uniform connector contract to connection states and error messages.

Optional dependencies are loaded with `new Function('s', 'return import(s)')(...)`
so bundles stay wallet-agnostic and missing packages throw install instructions.

## Consequences

- **Pros:** no wallet SDK is statically bundled; adding a wallet is a new connector
  module; errors are consistent and actionable; keys never touch application state.
- **Cons:** connectors must be maintained against vendor API drift; WalletConnect
  requires a real `PROJECT_ID` (the checked-in value is a demo placeholder);
  capability detection (extension injection, `navigator.usb`, `navigator.onLine`)
  is environment-dependent and needs feature-detect guards.

## Compatibility & Migration

- Ledger signing requires Chrome/Edge (WebUSB/WebHID). Firefox and Safari are
  unsupported and are reported as such rather than failing cryptically.
- WalletConnect requires `@walletconnect/sign-client` + `@walletconnect/modal`;
  install commands are surfaced in the error messages and developer docs.
- Freighter/xBull rely on the extension being present and unlocked; the connector
  returns a "not installed / install from <url>" error otherwise.
- When adding a wallet, add the connector under `src/lib/wallet/`, extend
  `WalletConnect.tsx`, and add a row to the posture scoring table in
  `security.js`. DID flows in `didAuth.ts` consume the same uniform surface.

## Security Considerations

- Secret keys and seed phrases are never stored or logged.
- Network passphrase used at signing time is taken from the wallet's reported
  network; the UI warns on testnet/mainnet mismatch with the app configuration.
- Phishing-marker checks run before the signing prompt; a positive match blocks
  the confirmation and lowers the session posture score.
- The audit log records connect/sign/disconnect events (last 50 entries) in local
  storage; store it via the app's encryption utilities when persistence is required.
- WalletConnect sessions support explicit disconnect; stale sessions are cleared on
  `session_delete` events.

## Invalid Input, Unsupported Environments & Failure Paths

- **Missing extension/package:** throw an error naming the wallet and the install
  source; never return a falsy success.
- **Unsupported browser (Ledger):** throw "WebUSB/WebHID not supported in this
  browser" before attempting a transport handshake.
- **User rejection:** a WalletConnect `error.code === 5000` (or a rejection message)
  is mapped to "Transaction rejected by the mobile wallet"; Ledger `0x6985`/denied
  maps to a device-rejection message.
- **Bad XDR:** empty/invalid XDR yields "Transaction XDR is required"/"Invalid
  transaction XDR" before any wallet call.
- **Malformed responses:** missing public key, missing session accounts, or
  unexpected signed-XDR shapes (`string`, `signedXDR`, `signedTxXdr`) are
  normalised or rejected deterministically.
- **Locked device / wrong app:** Ledger `0x6b0c`/`0x6d00` are translated to
  user-recoverable guidance.
- **No accounts returned:** WalletConnect refuses the session rather than defaulting
  to a wrong account.

## Alternatives Considered

- **Bundling SDKs up front** — rejected: paid for with large main bundles and dead
  code; optional peer dependencies keep the vendor chunk isolated.
- **Single-wallet (Freighter-only) integration** — rejected: excludes hardware and
  mobile users and forces web-only usage.
- **Server-side signing** — rejected for security: keys must never leave the user's
  device.

## References

- [`src/lib/wallet/freighter.js`](../../src/lib/wallet/freighter.js)
- [`src/lib/wallet/xbull.js`](../../src/lib/wallet/xbull.js)
- [`src/lib/wallet/ledger.js`](../../src/lib/wallet/ledger.js)
- [`src/lib/wallet/walletconnect.js`](../../src/lib/wallet/walletconnect.js)
- [`src/lib/wallet/lobstr.js`](../../src/lib/wallet/lobstr.js)
- [`src/lib/wallet/solar.js`](../../src/lib/wallet/solar.js)
- [`src/lib/wallet/security.js`](../../src/lib/wallet/security.js)
- [`src/components/dashboard/WalletConnect.tsx`](../../src/components/dashboard/WalletConnect.tsx)
- [`src/lib/didAuth.ts`](../../src/lib/didAuth.ts)
- Related: [ADR-0004: Soroban tooling](./adr-0004-soroban-tooling.md)