# Component Reference

This document describes every public React component in the dashboard.

## Layout Components

### `<Sidebar>`

**File:** `src/components/layout/Sidebar.jsx`

Fixed left-hand navigation for desktop viewports. Displays the network selector, connected account badge, nav items, and theme toggle.

| Prop       | Type      | Default | Description                             |
| ---------- | --------- | ------- | --------------------------------------- |
| `isMobile` | `boolean` | `false` | Renders in mobile-drawer mode when true |

---

### `<MobileSidebar>`

**File:** `src/components/layout/MobileSidebar.jsx`

Slide-in navigation drawer for mobile viewports. Controlled by the `isMobileMenuOpen` Zustand state. Closes on nav-item tap, backdrop click, and Escape key.

```jsx
import MobileSidebar, { HamburgerButton } from './components/layout/MobileSidebar';
// Render HamburgerButton in the mobile header, MobileSidebar anywhere in the tree.
```

---

### `<MobileHeader>`

**File:** `src/components/layout/MobileHeader.jsx`

Fixed top-bar visible only on small screens. Contains the hamburger toggle and network badge.

---

### `<DashboardGrid>`

**File:** `src/components/layout/DashboardGrid.jsx`

Drag-and-drop widget grid for the customisable dashboard layout.

---

### `<ThemeToggle>`

**File:** `src/components/layout/ThemeToggle.jsx`

Dark/light mode button. Reads and writes `theme` from the Zustand store.

---

## Dashboard Components

### `<Overview>`

**File:** `src/components/dashboard/Overview.jsx`

Top-level summary panel: account stats, recent transactions, network health.

---

### `<Account>`

**File:** `src/components/dashboard/Account.jsx`

Account detail view: balances, signers, flags, thresholds, and data entries.

---

### `<Transactions>`

**File:** `src/components/dashboard/Transactions.jsx`

Paginated transaction list with filter controls.

---

### `<TransactionBuilder>`

**File:** `src/components/dashboard/TransactionBuilder.jsx`

Interactive multi-operation transaction builder. Supports all Stellar operation types including payment, path payment, create account, change trust, manage offers, manage data, bump sequence, claimable balances, and sponsorship operations.

Optionally loads a pre-built template via the `TRANSACTION_TEMPLATES` from `src/lib/transactionTemplates.js`.

---

### `<DataExport>`

**File:** `src/components/dashboard/DataExport.jsx`

Export/import panel for dashboard data. Allows downloading:

- Dashboard settings backup (JSON)
- Transaction history (CSV)
- Account balances (CSV)

And importing a previously saved JSON backup to restore theme and network settings.

```jsx
import DataExport from './components/dashboard/DataExport';
<DataExport />;
```

---

### `<NetworkStats>`

**File:** `src/components/dashboard/NetworkStats.jsx`

Live Stellar network metrics: ledger sequence, base fee, protocol version, and node counts.

---

### `<Contracts>`

**File:** `src/components/dashboard/Contracts.jsx`

Soroban smart contract inspector and invoker.

---

### `<DEXExplorer>`

**File:** `src/components/dashboard/DEXExplorer.jsx`

Stellar DEX order book, trade history, and path-finding explorer.

---

### `<WalletConnect>`

**File:** `src/components/dashboard/WalletConnect.jsx`

Freighter wallet connection panel.

---

### `<TransactionSigner>`

**File:** `src/components/dashboard/TransactionSigner.jsx`

XDR transaction signer — paste an XDR envelope, sign with a secret key or Freighter.

Every envelope is passed through [`usePreSignRiskSummary`](#usepresignrisksummary) before the
wallet sees it, so an operation pasted from outside the dashboard gets the same
review as one the dashboard built.

---

### `<Faucet>`

**File:** `src/components/dashboard/Faucet.jsx`

Testnet faucet (Friendbot) integration — fund any testnet account with a click.

---

### `<PortfolioValue>`

**File:** `src/components/dashboard/PortfolioValue.jsx`

USD/EUR portfolio value estimate based on live price feeds.

---

## Asset Components

### `<AssetDiscovery>`

**File:** `src/components/assets/AssetDiscovery.jsx`

Search and discover Stellar assets by code, issuer, or domain.

### `<AssetCard>`

**File:** `src/components/assets/AssetCard.jsx`

Single asset card showing balance, price, 24h change, and quick actions.

---

## Chart Components

### `<AdvancedChartSuite>`

**File:** `src/components/charts/AdvancedChartSuite.jsx`

Configurable chart collection: balance history, network metrics, account activity.

### `<BalanceHistoryChart>`

**File:** `src/components/charts/BalanceHistoryChart.jsx`

XLM balance over time using the Recharts `AreaChart`.

---

## Security Components

### `<RiskSummaryPanel>`

**File:** `src/components/security/RiskSummaryPanel.jsx`

Pre-sign risk review dialog. Describes every operation in a parsed transaction
in plain language, before the transaction reaches a wallet. Implemented for
[#982](https://github.com/Nanle-code/stellar-dev-dashboard/issues/982).

| Prop              | Type          | Default               | Description                                                    |
| ----------------- | ------------- | --------------------- | -------------------------------------------------------------- |
| `summary`         | `RiskSummary` | —                     | Output of `computeRiskSummary()`. Renders nothing when falsy.  |
| `onAcknowledged`  | `Function`    | —                     | Called when the user proceeds. Only route to the signing call. |
| `onCancel`        | `Function`    | —                     | Called on Cancel, Escape, or backdrop click.                   |
| `onTrustContract` | `Function`    | —                     | Optional. Enables "add this contract to my known list".        |
| `proceedLabel`    | `string`      | `'Proceed to wallet'` | Label for the proceed button.                                  |
| `sourceLabel`     | `string`      | —                     | Context line describing the signer or flow.                    |

Behaviour:

- When `summary.requiresAcknowledgement` is `true`, the proceed button stays
  disabled until the acknowledgement checkbox is ticked. A low-risk transaction
  is **not** slowed down by an extra step.
- `role="alertdialog"` with `aria-modal`, `aria-labelledby` and
  `aria-describedby`; focus moves into the dialog on open and is restored on
  close via `FocusManager`.
- Escape and backdrop click cancel. Body scroll is locked while open.
- Severity is conveyed by the design tokens `--red`, `--amber` and `--green`
  (with `--red-glow` / `--amber-glow` / `--green-glow` backgrounds); every
  severity is also spelled out in text, so colour is never the only signal.

```jsx
import RiskSummaryPanel from './components/security/RiskSummaryPanel';

<RiskSummaryPanel
  summary={summary}
  proceedLabel="Sign Transaction"
  onAcknowledged={() => onAcknowledged(performSign)}
  onCancel={cancelReview}
/>;
```

See [`api/riskSummary.md`](./api/riskSummary.md) for the summary shape and
[`api/riskRules.md`](./api/riskRules.md) for the ruleset.

### `usePreSignRiskSummary`

**File:** `src/hooks/usePreSignRiskSummary.js`

Hook that owns the shared pre-sign state machine — parse, load the account,
simulate, summarise, present, await acknowledgement. Every signing surface uses
it, which is what makes pasted XDR and dashboard-built XDR behave identically.

| Returned field                       | Type                  | Description                                              |
| ------------------------------------ | --------------------- | -------------------------------------------------------- |
| `beginReview(xdr, networkOverride?)` | `Promise<boolean>`    | Runs the review. `true` when the panel is now showing.   |
| `cancelReview()`                     | `Function`            | Dismisses the panel.                                     |
| `onAcknowledged(signFn)`             | `Promise`             | Clears the panel, then runs `signFn`.                    |
| `onTrustContract()`                  | `Promise`             | Allowlists `summary.flaggedContracts[0]` and re-reviews. |
| `summary`                            | `RiskSummary \| null` | The current summary.                                     |
| `pendingXdr`                         | `string \| null`      | The envelope awaiting acknowledgement.                   |
| `reviewing`                          | `boolean`             | True while parsing/simulating.                           |
| `reviewError`                        | `string \| null`      | Set when the XDR could not be decoded.                   |
| `knownContracts`                     | `string[]`            | The persisted allowlist.                                 |

Also exports the framework-free `reviewTransaction(xdr, options)`, so a
non-React caller can reuse the whole review.

**Integrated into:** `<TransactionSigner>`, `<SignatureCollector>`,
`<AnchorIntegration>` (SEP-10 challenge), and
`signAndSubmitTransaction()` in `lib/transactionBuilder.js`.

---

## Utility Components

### `<ErrorBoundary>`

**File:** `src/components/ErrorBoundary.jsx`

React error boundary that catches render errors and shows `<ErrorFallback>`.

### `<CopyableValue>`

**File:** `src/components/dashboard/CopyableValue.jsx`

Inline component that copies its `value` prop to the clipboard on click.

### `<I18nProvider>`

**File:** `src/components/I18nProvider.jsx`

Wraps the app in react-i18next context. Supports `en`, `es`, and `zh` out of the box.
