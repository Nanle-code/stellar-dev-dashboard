# Component Reference

This document describes every public React component in the dashboard.

## Layout Components

### `<Sidebar>`
**File:** `src/components/layout/Sidebar.jsx`

Fixed left-hand navigation for desktop viewports. Displays the network selector, connected account badge, nav items, and theme toggle.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
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
<DataExport />
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

### `<ContractEventDisplay>`
**File:** `src/components/dashboard/ContractEventDisplay.tsx`

Renders Soroban smart contract events as typed, searchable data with safe raw XDR fallback.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | `ContractEvent[] \| unknown` | `[]` | Array of Soroban contract events or single event object |
| `label` | `string` | `'Contract Events'` | Title label shown in header |
| `spec` | `any` | `undefined` | Optional contract spec object for spec-aware topic/parameter matching |
| `className` | `string` | `undefined` | Container styling class name |

#### Features & Usage Notes
- **Typed ScVal Decoding**: Converts ScVal base64 XDR payloads into native JS types (`symbol`, `address`, `i128`, `bool`, `vec`, `map`, `string`).
- **Raw XDR Fallback**: Provides safe fallback rendering for invalid, unparseable, or corrupt XDR inputs with toggleable raw payload viewer and copy actions.
- **Search & Filtering**: Search across topics, contract IDs, types, and values, or filter by category (`ALL`, `CONTRACT`, `SYSTEM`, `DIAGNOSTIC`, `RAW_XDR`).
- **Security & Compatibility**: Built with environment feature-detection (checking for `@stellar/stellar-sdk` and `navigator.clipboard`) and safe runtime fallback mechanisms.

---

### `<DEXExplorer>`
**File:** `src/components/dashboard/DEXExplorer.tsx`

Stellar DEX order book, trade history, AMM liquidity pools, and integrated trade execution with slippage protection.

---

### `<SlippageTradePanel>`
**File:** `src/components/dashboard/SlippageTradePanel.tsx`

Interactive trade builder and slippage protection panel.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sellingAsset` | `string` | `'native'` | Asset code or `CODE:ISSUER` being sold |
| `buyingAsset` | `string` | `'USDC:G...'` | Asset code or `CODE:ISSUER` being bought |
| `orderbook` | `OrderBookData \| null` | `null` | Orderbook bids and asks |
| `pool` | `AmmPoolData \| null` | `null` | AMM liquidity pool reserve data |
| `onBuildTrade` | `Function` | `undefined` | Callback fired on protected trade construction |

#### Key Features:
- **Real-Time Price Impact Calculation**: Calculates spot price, execution price, and price impact % across orderbook depth levels and AMM constant-product reserves ($x \cdot y = k$).
- **User-Selected Slippage Tolerance**: Supports preset tolerance levels (`0.1%`, `0.5%`, `1.0%`, `3.0%`) and custom % inputs.
- **Enforced Trade Guard**: Automatically blocks trade construction (`isValid = false`) and disables building if price impact exceeds user tolerance or market liquidity is insufficient.
- **Protected Parameter Output**: Emits minimum received output (`destMin` for strict send) or maximum sent (`sendMax` for strict receive) to guarantee slippage limits on-chain.

---

### `<WalletConnect>`
**File:** `src/components/dashboard/WalletConnect.jsx`

Freighter wallet connection panel.

---

### `<TransactionSigner>`
**File:** `src/components/dashboard/TransactionSigner.jsx`

XDR transaction signer — paste an XDR envelope, sign with a secret key or Freighter.

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

## Utility Components

### `<ErrorBoundary>`
**File:** `src/components/ErrorBoundary.jsx`

React error boundary that catches render errors and shows `<ErrorFallback>`.

### `<ContextualEmptyState>`
**File:** `src/components/common/ContextualEmptyState.tsx`

Replaces blank panels with a title, a reason and up to three next-best actions that link to related tools. Actions come from presets in `src/lib/emptyStates.ts` and are filtered by route registry, network, expertise and feature flags. See [EMPTY_STATES.md](./EMPTY_STATES.md).

### `<CopyableValue>`
**File:** `src/components/dashboard/CopyableValue.jsx`

Inline component that copies its `value` prop to the clipboard on click.

### `<I18nProvider>`
**File:** `src/components/I18nProvider.jsx`

Wraps the app in react-i18next context. Supports `en`, `es`, and `zh` out of the box.

## Security Components

Every envelope is passed through [`usePreSignRiskSummary`](#usepresignrisksummary) before the
wallet sees it, so an operation pasted from outside the dashboard gets the same
review as one the dashboard built.

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
| `beginReview(xdr, networkOverride?)` | `Promise<'shown' \| 'pass' \| 'error'>` | Runs the review. `shown` when the panel is presenting, `pass` when nothing was flagged, `error` when the envelope could not be decoded and must not be signed. |
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
`signAndSubmitTransaction()` in `lib/transactionBuilder.ts`.
