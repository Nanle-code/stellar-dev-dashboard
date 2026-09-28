# Threat Model: Freighter & Ledger Wallet Flows

This document details the threat model, trust boundaries, failure handling, and developer guidance for browser extension (`Freighter`) and hardware wallet (`Ledger`) integration within the `stellar-dev-dashboard` (#841).

---

## 1. Overview & Trust Boundaries

The dashboard interfaces with decentralized key-management providers to execute queries, review account balances, simulate Soroban invocations, and submit cryptographically signed Stellar transactions. Because keys never enter dashboard memory (Freighter holds keys inside an isolated extension sandbox; Ledger holds keys inside an EAL5+ Secure Element), the dashboard interacts with these providers across distinct trust boundaries:

```
┌────────────────────────────────────────────────────────┐
│                   Dashboard Host Page                  │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │  Transaction Builder  │   │ Pre-Sign Risk Review │  │
│  └──────────┬────────────┘   └──────────▲───────────┘  │
│             │                           │              │
│             ▼                           │              │
│     Unsigned Envelope ──────────────────┘              │
│             │                                          │
│    Validate & Sanitize                                 │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
  IPC / Injected Provider         WebUSB / WebHID (Chromium)
              │                           │
              ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Freighter Wallet      │   │    Ledger Hardware Wallet │
│   (Isolated Extension)    │   │  (Secure Element Enclave) │
│                           │   │                           │
│ - Origin allowlist        │   │ - On-screen verification  │
│ - Secure user prompt      │   │ - PIN & physical buttons  │
│ - Ed25519 signing         │   │ - Blind-signing policies  │
└───────────────────────────┘   └───────────────────────────┘
```

---

## 2. Threat Model Matrices

### 2.1 Freighter Extension Flow Threat Matrix

| Threat Vector                                   | Category        | Description                                                                                                                                                             | Dashboard & Provider Remediation Strategy                                                                                                                                                                                                                                                                                                                       |
| :---------------------------------------------- | :-------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider Spoofing / Window Hijacking**        | Wallet Spoofing | Malicious third-party scripts overwrite or tamper with `window.freighterApi` before initialization, intercepting requests or feeding spoofed public keys.               | Content Security Policy forbids `unsafe-inline` scripts. The connector strictly validates provider methods (`isConnected`, `getAddress`, `signTransaction`) and checks returned public keys against Stellar StrKey Ed25519 checksums (`StellarSdk.StrKey.isValidEd25519PublicKey`). Corrupt or non-conforming providers fail with explicit security exceptions. |
| **Tampered Public Key / Identity Substitution** | Wallet Spoofing | A compromised or mock provider emits an attacker-controlled public key to misdirect account inspection or funds.                                                        | The dashboard verifies that public keys match canonical `G[A-Z0-9]{55}` format with valid CRC16 checksums. Upon account change events, cached sessions are invalidated, and account balance subscriptions are re-anchored.                                                                                                                                      |
| **Phishing Origin / Typosquatting dApp**        | Phishing        | An attacker clones the dashboard at `stellar-dev-dashb0ard.com` to trick users into connecting or approving malicious operations.                                       | Freighter enforces origin-based access gating (`isAllowed` / `requestAccess`). Each origin must be explicitly authorized by the user in the Freighter popup. The dashboard checks authorization status continuously (`isFreighterAllowed`).                                                                                                                     |
| **Malicious Memo Phishing**                     | Phishing        | Attackers send transactions with memos containing deceptive URLs (`claim: stellar-reward.org`) or homoglyph domains to phish wallet credentials.                        | The pre-sign pipeline executes heuristic and neural phishing models (`memoHasPhishingPattern`, `detectDomainImpersonation`). Transactions containing recognized phishing cues trigger `CRITICAL` risk escalation, blocking submission until whitelisted or corrected.                                                                                           |
| **Blind Signing / Obfuscated XDR**              | Malicious dApp  | A malicious dApp or pasted XDR requests signature for complex operations (e.g., Soroban contract calls, account merge, signer modification) without clear explanations. | Pre-Sign Risk Review parses every operation in the transaction envelope. High-risk operations (disabling master key, adding signers, merging account, calling unapproved contracts) are escalated to `high` or `critical` risk and require explicit two-step user acknowledgment before the signing request is dispatched to Freighter.                         |
| **Cross-Network Signature Replay**              | Malicious dApp  | A signature collected for a Testnet transaction is maliciously submitted against Public Network (Mainnet) or Futurenet.                                                 | Network passphrase domain separation is enforced. Freighter verifies the target network on signing (`{ network: 'TESTNET' }`), and the dashboard validates that the transaction hash commits to the active network passphrase (`NETWORKS[network].passphrase`).                                                                                                 |
| **Unauthorized Repeated Submissions / Replay**  | Malicious dApp  | An attacker re-broadcasts intercepted signed envelopes to duplicate payments or state alterations.                                                                      | Transactions require valid sequence numbers and bounded validity intervals (`timebounds`). The sequence conflict engine tracks in-flight and reserved sequence numbers to reject duplicate submissions.                                                                                                                                                         |

### 2.2 Ledger Hardware Wallet Flow Threat Matrix

| Threat Vector                                   | Category        | Description                                                                                                                     | Dashboard & Provider Remediation Strategy                                                                                                                                                                                                                                                 |
| :---------------------------------------------- | :-------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rogue USB Device / WebUSB Spoofing**          | Wallet Spoofing | A malicious USB device attempts to impersonate a Ledger device to feed fake public keys or steal raw inputs.                    | WebUSB requires an explicit browser permission gesture (`navigator.usb.requestDevice`) filtered by Ledger's official USB vendor ID (`0x2c97`). The dashboard performs cryptographic handshakes with the genuine Stellar app running on Ledger's Secure Element.                           |
| **Derivation Path Manipulation**                | Wallet Spoofing | A malicious payload requests derivation along an unexpected or unauthorized BIP-44 path, accessing unauthorized accounts.       | Strict validation enforces standard BIP-44 derivation format (`44'/148'/n'`). Empty, malformed, or out-of-spec paths are rejected before reaching device transport.                                                                                                                       |
| **Host Display / Mismatched Address Deception** | Phishing        | Malware on the host machine modifies destination addresses or amounts rendered in the browser DOM.                              | Ledger enforces What-You-See-Is-What-You-Sign (WYSIWYS). The user must independently verify the destination address, memo, and amount directly on the physical Ledger device display before pressing hardware confirmation buttons.                                                       |
| **Blind Signing of Soroban Operations**         | Malicious dApp  | Soroban smart contract calls contain serialized binary parameters that cannot be completely parsed on legacy hardware displays. | Ledger displays explicit "Blind Signing" warnings when Soroban contract execution is requested. The dashboard pre-computes contract invocation footprint diffs, simulated gas limits, and parameter summaries so developers can review parameters on-screen prior to device confirmation. |
| **Firmware Vulnerability Exploitation**         | Wallet Spoofing | Devices running outdated firmware (< 2.1.0) with known memory corruption or timing vulnerabilities are connected to the app.    | The `hardwareWalletSecurity` manager evaluates device firmware versions against the known CVE vulnerability database. Insecure firmware versions trigger critical security warnings recommending immediate update via Ledger Live.                                                        |
| **Device Disconnect Mid-Transaction**           | Failure Path    | Hardware device is disconnected or loses power during APDU exchange.                                                            | Transport errors are trapped gracefully. Unfinished sessions are torn down with `disconnectLedger()`, and audit events are emitted without hanging dashboard UI.                                                                                                                          |

---

## 3. Handling Invalid Input, Unsupported Environments & Failure Paths

### 3.1 Invalid Input Handling

- **Public Key Validation:** All addresses received from Freighter (`getAddress`) or Ledger (`getPublicKey`) are validated via `StrKey.isValidEd25519PublicKey`. Invalid strings (e.g. SQL/XSS payloads, non-56 character strings, corrupt checksums) trigger an immediate `INVALID_PUBLIC_KEY` error.
- **XDR Sanitization:** Transaction XDR passed to `signTransactionWithFreighter` or `signXdrWithLedger` is validated against base64 encoding and parsed into a valid `StellarSdk.Transaction` envelope before any signing call is issued.
- **Network Passphrase:** Empty or null network passphrases throw immediate synchronous errors (`Network passphrase is required.`).
- **Derivation Paths:** Ledger derivation paths are checked against the BIP-44 regex `^44'/148'/\d+'?$`. Any non-conforming path is rejected immediately.

### 3.2 Unsupported Environment Handling

- **Non-Chromium Browsers for Ledger:** WebUSB and WebHID are not supported in Firefox or Safari. `isLedgerSupported()` detects absence of `navigator.usb` and `navigator.hid`, surfacing an actionable incompatibility banner directing users to Chrome, Edge, or Brave.
- **Missing Freighter Extension:** When `window.freighterApi` is absent, `connectFreighter()` throws an actionable error with the official installation link (`https://freighter.app`).
- **Headless / Server Environments:** In SSR or Node.js test environments without a `window` object, connectors safely return `false` or inactive state rather than crashing with `ReferenceError`.

### 3.3 Failure Paths

- **User Rejection (0x6985):** When a user cancels a connection or signing request on Freighter or Ledger, the error is normalized to `User declined transaction signing.` or `Transaction was rejected on the Ledger device.` The UI returns to the review state without losing user input.
- **Device Locked (0x6b0c):** When Ledger is PIN-locked or Freighter is locked (`isAllowed: false`), the user is prompted with an unlock directive.
- **Stellar App Not Open (0x6d00):** If the user has Ledger connected but is on the device dashboard or inside another blockchain app, the connector returns `Stellar app is not open on the Ledger device.`
- **Transport Disconnect:** Disconnecting USB or unloading the extension triggers cleanup routines (`clearLedgerSession()`, session listener aborts) and records a `wallet_security_audit_log` event.

---

## 4. E2E Wallet Fixtures (`tests/e2e/fixtures/`)

To support automated end-to-end verification of threat vectors and security paths, the test suite provides deterministic mock providers that simulate both normal and hostile wallet behavior:

1. **`freighter-mock.js`**:
   - `mockWalletAdapter.simulateSpoofedPublicKey(invalidKey)`: Simulates provider spoofing with malformed public keys.
   - `mockWalletAdapter.simulateHostileProvider()`: Simulates hostile DOM script injection.
   - `mockWalletAdapter.simulateNetworkMismatch(network)`: Injects cross-network signature responses.
   - `mockWalletAdapter.rejectNextConnect()` / `rejectNextSign()`: Simulates user denial flows.
   - `mockWalletAdapter.simulateLock()`: Simulates wallet locking.
2. **`ledger-mock.js`**:
   - Simulates WebUSB device enumeration (`vendorId: 0x2c97`).
   - Simulates hardware lock state (`0x6b0c`), app-closed state (`0x6d00`), and user rejection (`0x6985`).
   - Simulates firmware version checks (vulnerabilities vs. secure firmware).

---

## 5. Compatibility & Migration Notes

- **Freighter API Compatibility:** Compatible with `@stellar/freighter-api` v1 and v2 methods (`isConnected`, `isAllowed`, `setAllowed`, `requestAccess`, `getAddress`, `getNetwork`, `signTransaction`, `getUserInfo`).
- **Ledger Transports:** WebUSB (`@ledgerhq/hw-transport-webusb`) is preferred; WebHID (`@ledgerhq/hw-transport-webhid`) acts as fallback on Chromium 89+.
- **Zero-Dependency Core:** Transports for hardware wallets remain optional dynamic peer dependencies so browser bundle size is not penalized when hardware signing is unused.
