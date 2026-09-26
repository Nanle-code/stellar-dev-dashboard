# Security Policy

## Federation and SEP endpoint trust

Federation and SEP endpoints discovered through `stellar.toml` are restricted
to the originating home domain and configured trusted domains. See
[`docs/security/endpoint-allowlist.md`](docs/security/endpoint-allowlist.md)
for compatibility and migration guidance.

## Overview
This document outlines the security architecture and threat model for the `stellar-dev-dashboard`. Our security strategy focuses on frontend hardening, automated dependency management, and restrictive communication policies.

## Threat Model Matrix

| Threat Vector | Description | Remediation Strategy | Automated Compliance |
| :--- | :--- | :--- | :--- |
| **Cross-Site Scripting (XSS)** | Injection of malicious scripts via user input or third-party dependencies. | Restrictive CSP (no `unsafe-inline`), nonce-based execution, and input sanitisation. | NPM Audit CI Gate, CSP Header Validation. |
| **Dependency Vulnerabilities** | Exploitation of known vulnerabilities in project dependencies. | Daily automated audits and proactive dependency updates. | Dependabot, GitHub Actions (`dependency-check.yml`). |
| **Data Exfiltration** | Unauthorised transmission of sensitive data to malicious endpoints. | Strict `connect-src` CSP directive limiting traffic to Stellar and CoinGecko APIs. | Nginx CSP Enforcement. |
| **Clickjacking** | Embedding the dashboard in malicious frames to trick users. | `X-Frame-Options: SAMEORIGIN` and `frame-ancestors: 'none'` CSP directive. | Nginx Header Injection. |
| **Insecure Connections** | Downgrade attacks or unencrypted data transmission. | Forced HTTPS via `upgrade-insecure-requests` CSP directive. | Nginx Configuration. |

## Security Architecture Blueprint

### 1. Content Security Policy (CSP)
We enforce a strict CSP through both Nginx and React-level meta tags. 
- **Nonces**: Cryptographically strong nonces are generated for inline scripts and styles.
- **Restrictions**: `'unsafe-inline'` is prohibited in production.
- **Allowed Sources**: 
  - Scripts/Styles: `'self'`
  - API Connections/Wallets: `https://*.stellar.org`, `wss://*.stellar.org`, `https://*.sorobanrpc.com`, `https://api.coingecko.com`, `wss://*.walletconnect.com`, `https://*.walletconnect.com`, `https://*.walletconnect.org`, `https://albedo.link`, `https://*.albedo.link`
  - Inline Scripts: Allowed via strict SHA-256 hash validation for the theme initialization script.

### Adding New Wallet or API Endpoints
To add a new endpoint or wallet integration, update the `Content-Security-Policy` header in `nginx.conf` and the corresponding meta tag in `index.html`. Add the domains to `connect-src` (for APIs/WebSocket) or `frame-src` (for iframes).

### 2. Automated Guardrails
- **Dependabot**: Monitors `npm` and `github-actions` ecosystems daily for updates.
- **CI Security Audit**: Every push and pull request triggers an `npm audit --audit-level=high` check. Failure to meet this threshold blocks the deployment pipeline.
- **Intelligent Dependency Management (#602)**: In-app analysis engine (`src/lib/dependencyManagement.ts`) correlates vulnerability databases / npm audit data, produces risk-scored update recommendations, detects version conflicts, and exposes a dashboard tab (`Dependencies`) plus the Security Dashboard dependency panel.

## Passkey Smart Wallet Threat Model (#974)

This section covers the additional attack surface introduced by WebAuthn / secp256r1 passkey-based smart wallet accounts (Protocol 21+).

### What is a Passkey Smart Wallet?

A passkey smart wallet is a Soroban contract account (C-address) whose `__check_auth` function verifies P-256 (secp256r1) WebAuthn signatures instead of classical Ed25519 signatures.  The dashboard creates credentials, derives signing challenges, and routes signed auth entries through a fee-sponsor relayer.

### Passkey Threat Model Matrix

| Threat Vector | Description | Remediation Strategy |
| :--- | :--- | :--- |
| **Credential theft via XSS** | An XSS attacker injects a script that calls `navigator.credentials.get()` to silently obtain a signed assertion. | The authenticator requires user-presence (UP) and user-verification (UV) gestures for every assertion. Silent signing without the user touching the authenticator is impossible. CSP (no `unsafe-inline`) prevents the injection vector. |
| **Phishing via origin spoofing** | A phishing site at `stellar-dev-dashb0ard.com` tricks the user into asserting a credential registered at `stellar-dev-dashboard.com`. | WebAuthn credentials are bound to the RP ID (origin hostname). A different origin cannot obtain a valid assertion for our credential, and the contract verifies the clientDataJSON origin on-chain. |
| **Relayer compromise / transaction substitution** | A malicious or compromised relayer substitutes a different transaction before broadcasting. | The authenticator signs the hash of the Soroban auth entry (not the full transaction). The smart wallet contract verifies the signed hash on-chain; any substitution is detected and rejected by `__check_auth`. The relayer can only manipulate fee-bump wrappers, not the inner auth payload. |
| **Credential ID enumeration** | An attacker enumerates stored credential IDs from localStorage to construct targeted assertions. | Credential IDs are opaque random identifiers. Possessing a credential ID alone is insufficient without the platform authenticator. The ID is not a secret, but it cannot be replayed without user interaction. |
| **Sign-count replay (authenticator clone detection)** | An attacker clones the authenticator and replays an old assertion with a lower sign count. | Smart wallet contracts that track and enforce monotonically increasing sign counts will reject replays. The dashboard surface the `signCount` field in the auth payload so contract developers can implement counter enforcement. |
| **Lost / inaccessible authenticator** | The user loses their device or passkey and is locked out of the smart wallet. | Recovery is a contract-level concern. Users should deploy smart wallets with recovery mechanisms (multisig guardians, social recovery, backup keys). The dashboard surfaces this requirement in the Compatibility & Security Notes panel. |
| **Unsupported browser downgrade** | A user on an unsupported browser silently falls back to an insecure path. | `isPasskeySupported()` is checked before every passkey operation. An incompatibility banner and explicit errors are shown; there is no silent fallback. |
| **Relayer SSRF / injection** | Malicious auth entry XDR causes the relayer to perform unintended actions. | The relayer receives only the unsigned XDR and the auth payload. Auth entry XDR is opaque binary data; the relayer does not interpret it. CSP `connect-src` must include the relayer endpoint. |

### Signing Challenge Integrity

The WebAuthn challenge passed to `navigator.credentials.get()` is derived deterministically as:

```
challenge = SHA-256( network_passphrase || auth_entry_xdr )
```

This means:
1. The authenticator commits to the exact auth entry the contract will verify.
2. The contract can reproduce the same hash on-chain and confirm the user authorised exactly this operation.
3. Changing the network or the auth entry yields a different challenge, preventing cross-network replay.

### CSP Additions Required

When deploying with a passkey relayer, add the relayer domain to `connect-src`:

```
connect-src ... https://*.stellar-passkey-relayer.com
```

See `nginx.conf` and `index.html` for the canonical CSP configuration.

### Security Posture Scoring

Passkey smart wallets score **78 / 100** in the dashboard's session security posture model (`getSessionSecurityPosture`), placing them in the **medium-high** tier — above software browser-extension wallets (60–65) and below Ledger native signing (80).  This reflects the strong hardware-bound key guarantee, offset slightly by reliance on a fee-sponsor relayer as an additional trust dependency.

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.
