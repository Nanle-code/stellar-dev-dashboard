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

### `<CopyableValue>`
**File:** `src/components/dashboard/CopyableValue.jsx`

Inline component that copies its `value` prop to the clipboard on click.

### `<I18nProvider>`
**File:** `src/components/I18nProvider.jsx`

Wraps the app in react-i18next context. Supports `en`, `es`, and `zh` out of the box.
