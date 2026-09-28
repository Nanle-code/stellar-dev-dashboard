---
id: wallet-connection-troubleshooting
title: Wallet Connection Troubleshooting Runbook
sidebar_label: Wallet Troubleshooting
---

# Wallet Connection Troubleshooting Runbook

This runbook helps diagnose and resolve the most common **Freighter** (browser
extension) and **Ledger** (hardware) connection failures. It mirrors the
classifier implemented in `src/lib/wallet/diagnostics.js`, so the diagnostics
described here are the same ones the dashboard surfaces.

Each failure lists:

- **Symptom** — what the user sees or the error text.
- **Diagnosis** — why it happens.
- **Remediation** — the concrete next step.

> If a diagnosis below does not match your case, the failure falls into the
> generic **unknown** bucket. Open the browser developer console, reproduce the
> failure, and capture the raw error message or Ledger status code.

## 1. Freighter

| Classification | Symptom / Error | Diagnosis | Remediation |
|---|---|---|---|
| Not installed | `Freighter is not installed` / `Freighter wallet not found` | The extension is missing, disabled, blocked, or not injected into the page. | Install from [https://freighter.app](https://freighter.app), then refresh. Disable any privacy blocking, and confirm the extension is enabled for this site. |
| Locked | `Freighter is locked` | The wallet session is locked and cannot sign or expose the account. | Open Freighter and unlock it, then reconnect from the dashboard. |
| Access denied | `User declined access` | The user dismissed or rejected the access request in the Freighter popup. | Click the wallet button again and **approve** the request. If no popup appears, check that popups are not blocked. |
| Network mismatch | `You must first turn off account network` / `network` | The network selected in Freighter differs from the one the dashboard is using. | Open the Freighter network selector and match it to the dashboard network (Testnet or Mainnet), then reconnect. |
| Invalid response | `Failed to get public key` / `Failed to sign` | Freighter could not return a valid address or signature (e.g. no active account). | Confirm an account is funded and selected in Freighter on the target network, then retry. |

### Success criteria for Freighter

The primary flow is considered healthy when Freighter returns a valid `G...`
public key and the account loads on the selected network. If the extension is
present but reports `isConnected: false`, treat it as **not installed / not
allowed** and follow the installed remediation above.

## 2. Ledger (hardware)

| Classification | Symptom / Error | Diagnosis | Remediation |
|---|---|---|---|
| Browser unsupported | `WebUSB/WebHID is not supported in this browser` | Firefox and Safari do not expose the WebUSB/WebHID APIs Ledger relies on. | Use Chrome, Edge, or a Chromium-based browser. |
| Dependency missing | `Optional dependency "@ledgerhq/hw-transport-webusb" is not installed` | The app was built without the optional Ledger transports. | Install `@ledgerhq/hw-transport-webusb` and `@stellar/ledger`, then rebuild. |
| Device not connected | `No device selected` / `Device not found` | Ledger is not plugged in / paired, or the browser cannot enumerate it. | Plug the device in (or pair over Bluetooth). Use a USB port that the OS permits the browser to access. |
| Device locked | `Ledger is locked` (status `0x6b0c`) | The device needs its PIN to unlock. | Enter the PIN on the device, then retry. |
| App not open | `Stellar app is not open` (status `0x6d00`) | The Stellar app is closed on the device. | Navigate to and open the **Stellar** app on the Ledger. |
| Request rejected | Transaction `rejected` (status `0x6985`) | The user rejected the operation on the device screen. | Re-attempt and **approve** on the device when you intend to continue. |

### Ledger status codes reference

| Code | Meaning | Action |
|---|---|---|
| `0x6985` | Request rejected / user declined | Approve on device; retry if unintended |
| `0x6b0c` | Device locked | Unlock with PIN |
| `0x6d00` | Instruction / app not found | Open the correct app (Stellar) |
| `0x6511` | App / data not present | Reinstall or update the Stellar app on the device |

### Common Ledger pitfalls

- Browser must be a secure context (HTTPS or `localhost`); WebUSB/WebHID are not
  available on plain HTTP.
- If multiple USB devices are attached, the browser may prompt which device to
  use — select the Ledger.
- After a firmware or app update, reconnect the device and start a fresh browser
  session.

## 3. Compatibility & security notes

- **Freighter** supports Chrome, Firefox, Brave, and Edge as a browser
  extension. It is the simplest path for development.
- **Ledger** support depends on **WebUSB/WebHID**, which is only available in
  Chrome/Chromium browsers. See the compatibility table above.
- Never handle a user's **secret key** in a browser-facing deployment. Secret
  key signing is for local development only.
- Always verify the **network** shown in the wallet matches the network the
  dashboard is configured for; mismatches are the single most common cause of
  "connection succeeded but data is wrong" confusion.

## 4. Migration / upgrade notes

- When upgrading ledger-js or the Stellar SDK, confirm the optional
  `@ledgerhq/hw-transport-*` packages are still present in `package.json`.
- If Freighter changes its injected API surface, refresh the page after
  upgrading the extension — the cached connector state can be stale.

## 5. Diagnostic helpers

The classifier exported by `src/lib/wallet/diagnostics.js` returns a stable
shape you can log or render:

```js
import { diagnoseWalletConnection } from '@/lib/wallet/diagnostics';

try {
  // ... connect flow ...
} catch (err) {
  const diagnostic = diagnoseWalletConnection('freighter', err);
  console.table(diagnostic);
  // { category, message, remediation, severity, matched }
}
```

See [Error Handling](./error-handling) and the general
[Troubleshooting](./troubleshooting) guide for related transaction and network
diagnostics.
