# Mobile Parity Matrix: Account Overview

## Overview

This document defines the web-to-mobile feature parity matrix for the Stellar Developer Dashboard Account Overview, ensuring 100% functional, analytical, and security parity between Desktop Web and Mobile Web/PWA viewports.

---

## Feature Parity Matrix

| Feature Area | Capability | Desktop Web | Mobile Web / PWA | Parity Status | Implementation Notes |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Balances** | Native XLM Balance Display | ✅ | ✅ | **Full Parity** | Formatted XLM display with formatted micro-lumen precision |
| **Balances** | Real-time USD Portfolio Estimate | ✅ | ✅ | **Full Parity** | Powered by `useAssetUsdEstimates` with total portfolio valuation |
| **Balances** | Spendable vs Locked Reserves | ✅ | ✅ | **Enhanced on Mobile** | Mobile includes dedicated visual progress bar + percentage gauge |
| **Balances** | Detailed Reserve Breakdown | ✅ | ✅ | **Full Parity** | Base, Signer, Asset Trustline, Offer, and Subentry reserves |
| **Trustlines** | Asset Code & Issuer Address | ✅ | ✅ | **Full Parity** | `shortAddress` with one-tap copy and `AddressLabelBadge` |
| **Trustlines** | Trustline Authorization Status | ✅ | ✅ | **Full Parity** | `AssetTrustStatus` badge (Authorized / Revoked / Maintaining) |
| **Trustlines** | Asset Search & Filter | ✅ | ✅ | **Full Parity** | Real-time search query and "Hide Zero Balances (0.0)" filter |
| **Trustlines** | Asset Valuation & Explorer Links | ✅ | ✅ | **Full Parity** | Real-time USD valuation and direct links to Stellar.Expert asset explorer |
| **Recent Activity** | Unified Account Activity Feed | ✅ | ✅ | **Full Parity** | Latest transactions with success/failed badges, op count, and timestamps |
| **Recent Activity** | Activity Status & Hash Search | ✅ | ✅ | **Full Parity** | Search by hash or memo, and filter by status (`All`, `Success`, `Failed`) |
| **Security** | Thresholds (Low, Medium, High) | ✅ | ✅ | **Full Parity** | Responsive grid cards displaying threshold weights |
| **Security** | Authorization Flags | ✅ | ✅ | **Full Parity** | `auth_required`, `auth_revocable`, `auth_immutable`, `auth_clawback_enabled` |
| **Security** | Signers List with Weights | ✅ | ✅ | **Full Parity** | Signer public keys with copy buttons, labels, and weight badges |
| **Offers & Claims** | Open DEX Order Book Offers | ✅ | ✅ | **Full Parity** | Active selling/buying offers, price ratios, and explorer links |
| **Offers & Claims** | Claimable Balances Shortcut | ✅ | ✅ | **Full Parity** | Direct navigation to claimable balance inspection and simulation |
| **Offline Resilience** | Offline & Stale Cache Banners | ✅ | ✅ | **Full Parity** | Informative banner reassuring user that cached account data is read-only |

---

## Architecture & Data Flow

```mermaid
graph TD
    Store[useStore: accountData, network, transactions] --> Parity[accountParity.ts]
    Parity --> Spendable[calculateSpendableMetrics]
    Parity --> Trustlines[normalizeTrustlines & filterTrustlines]
    Parity --> Activity[normalizeAccountActivity & filterActivity]
    Spendable --> Mobile[MobileAccountOverview.tsx]
    Trustlines --> Mobile
    Activity --> Mobile
    Mobile --> Account[Account.tsx (Responsive Switcher)]
```

---

## Mobile Usability Standards

1. **Touch Targets**: All interactive elements (tabs, copy buttons, links, filter toggles) meet WCAG AAA ≥ 44px touch target guidelines.
2. **Segmented Navigation**: Tabbed horizontal pill switcher (`Balances`, `Trustlines`, `Activity`, `Security`, `Offers`) keeps content clean without overwhelming mobile viewports.
3. **Copy-to-Clipboard**: Visual feedback with `Check` icon when copying addresses or transaction hashes.
4. **Resilient Degradation**: Handles missing data, offline states, and empty trustline/activity lists with friendly contextual empty states.
