# Security Policy

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
  - API Connections: `https://*.stellar.org`, `https://api.coingecko.com`

### 2. Automated Guardrails
- **Dependabot**: Monitors `npm` and `github-actions` ecosystems daily for updates.
- **CI Security Audit**: Every push and pull request triggers an `npm audit --audit-level=high` check. Failure to meet this threshold blocks the deployment pipeline.

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

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.
