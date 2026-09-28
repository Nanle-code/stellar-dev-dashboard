# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the default branch. Older
releases may not receive backports; please upgrade to the latest version before
reporting an issue.

## Wallet session idle timeout

Connected wallets are disconnected after a configurable idle period (default
15 minutes) with a confirmation prompt first. See
[`docs/security/wallet-idle-timeout.md`](docs/security/wallet-idle-timeout.md).

## Code owners for security-sensitive paths

Wallet, authentication, cryptography, and CI paths require review from the
owners listed in [`.github/CODEOWNERS`](.github/CODEOWNERS). Coverage is
enforced in CI; see [`docs/contributing.md`](docs/contributing.md#code-owners).

## Overview
This document outlines the security architecture and threat model for the `stellar-dev-dashboard`. Our security strategy focuses on frontend hardening, automated dependency management, and restrictive communication policies.

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

### 2. Automated Guardrails
- **Dependabot**: Monitors `npm` and `github-actions` ecosystems daily for updates.
- **CI Security Audit (#832)**: Every push, pull request, and daily scheduled run audits production dependencies (`pnpm audit --prod`) against remediation SLAs (critical 7 days, high 30 days, moderate 90 days, low 180 days). High and critical advisories fail CI once their SLA elapses and are reported as warnings until then; moderate advisories always warn. Empty or invalid audit output fails the job. Thresholds are configurable via `VULN_FAIL_ON`, `VULN_WARN_ON`, and `VULN_SLA_DAYS` - see [docs/security/dependency-vulnerability-sla.md](docs/security/dependency-vulnerability-sla.md).
- **Intelligent Dependency Management (#602)**: In-app analysis engine (`src/lib/dependencyManagement.ts`) correlates vulnerability databases / npm audit data, produces risk-scored update recommendations, detects version conflicts, and exposes a dashboard tab (`Dependencies`) plus the Security Dashboard dependency panel.

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.

### 3. Pre-Sign Risk Review
Signing is treated as a privileged action, because it usually is one. Before any
transaction reaches a wallet, it is parsed and run through a declarative ruleset
([`docs/api/riskRules.md`](docs/api/riskRules.md)) that describes every
operation in plain language.

- **Coverage:** all four signing surfaces — `<TransactionSigner>` (including
  XDR pasted from outside the dashboard), `<SignatureCollector>`,
  `<AnchorIntegration>` (SEP-10 challenges), and
  `signAndSubmitTransaction()`.
- **Gating:** irreversible operations — disabling the master key, changing
  thresholds or signers, merging the account, removing or unlimiting a
  trustline, spending a large share of the account, or calling an unapproved
  contract — are escalated to `high` and require an explicit acknowledgement.
  The signing call is unreachable until the user confirms.
- **Fail open, state the caveat:** a failed simulation or an unavailable account
  snapshot degrades the summary and says so on screen; it never silently
  presents an unverified transaction as verified, and never blocks a user
  because a node was down.
- **Allowlist by default:** the approved-contract list ships empty, so any
  contract invocation is flagged until the user opts in.
- **Full-transaction review:** every operation is shown, including those that
  matched no rule, so a dangerous operation cannot hide between unremarkable
  ones.
