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
