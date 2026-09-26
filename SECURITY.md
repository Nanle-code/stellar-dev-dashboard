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
- **CI Security Audit (#832)**: Every push, pull request, and daily scheduled run audits production dependencies (`pnpm audit --prod`) against remediation SLAs (critical 7 days, high 30 days, moderate 90 days, low 180 days). High and critical advisories fail CI once their SLA elapses and are reported as warnings until then; moderate advisories always warn. Empty or invalid audit output fails the job. Thresholds are configurable via `VULN_FAIL_ON`, `VULN_WARN_ON`, and `VULN_SLA_DAYS` - see [docs/security/dependency-vulnerability-sla.md](docs/security/dependency-vulnerability-sla.md).
- **Intelligent Dependency Management (#602)**: In-app analysis engine (`src/lib/dependencyManagement.ts`) correlates vulnerability databases / npm audit data, produces risk-scored update recommendations, detects version conflicts, and exposes a dashboard tab (`Dependencies`) plus the Security Dashboard dependency panel.

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.
