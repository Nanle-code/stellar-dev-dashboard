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

## Reporting a Vulnerability
If you discover a security vulnerability within this project, please send an e-mail to security@stellar-dev-dashboard.org. All security vulnerabilities will be promptly addressed.
