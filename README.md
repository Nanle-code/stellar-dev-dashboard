# ✦ Stellar Dev Dashboard

A real-time, open-source developer dashboard for the Stellar network — built with Vite + React.

![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)
![Network: Stellar](https://img.shields.io/badge/Network-Stellar-blue.svg)
![Stack: Vite + React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-yellow.svg)
![Last Updated](https://img.shields.io/badge/Last%20Updated-June%2024%202026-green.svg)

---

## What Is This?

Stellar Dev Dashboard is a browser-based developer tool for exploring and interacting with the Stellar blockchain. You enter any Stellar public key and get a full view of that account — balances, transactions, operations, contracts, network stats, and more. It supports both Mainnet and Testnet, connects to real wallets (Freighter, Ledger), and lets you build, simulate, and sign transactions directly in the UI.

---

## Getting Started

```bash
npm install
npm run dev       # development server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the production build
```

Node 18+ recommended. No environment variables required — all API calls go directly to public Stellar Horizon and Soroban RPC endpoints.

---

## Tech Stack

| Package                                                               | Purpose                                                         |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Vite 5](https://vitejs.dev/) + [React 18](https://reactjs.org/)      | Build tool and UI framework                                     |
| [@stellar/stellar-sdk ^12](https://github.com/stellar/js-stellar-sdk) | Horizon REST client, Soroban RPC, XDR encoding                  |
| [Zustand ^4](https://github.com/pmndrs/zustand)                       | Global state management                                         |
| [Recharts ^2](https://recharts.org/)                                  | Charts (ledger close times, network metrics, account activity)  |
| [date-fns ^3](https://date-fns.org/)                                  | Date formatting throughout the UI                               |
| [Lucide React](https://lucide.dev/)                                   | Icon set                                                        |
| TypeScript (dev)                                                      | Partial migration — `stellar.ts` and `store.ts` are fully typed |

Fonts: **Syne** (display) and **Space Mono** (monospace), loaded from Google Fonts.

---

## Project Structure

```
src/
├── main.jsx                    # React entry point
├── App.jsx                     # Root layout, tab routing, theme application
│
├── components/
│   ├── layout/
│   │   └── Sidebar.jsx         # Navigation sidebar with tab links and network switcher
│   │
│   ├── dashboard/              # One component per dashboard tab/feature
│   │   ├── ConnectPanel.jsx    # Landing screen — enter a public key to start
│   │   ├── Overview.jsx        # Account summary + recent txs + network stats
│   │   ├── Account.jsx         # Full account detail, balances, flags, signers, offers
│   │   ├── Transactions.jsx    # Paginated transaction and operation history
│   │   ├── Contracts.jsx       # Soroban contract inspector + invocation UI
│   │   ├── NetworkStats.jsx    # Live ledger stats, fee stats, close-time chart
│   │   ├── Faucet.jsx          # Testnet Friendbot funding
│   │   ├── Builder.jsx         # Simple transaction builder (payment / createAccount)
│   │   ├── TransactionBuilder.jsx  # Extended builder with more operation types
│   │   ├── TransactionSigner.jsx   # Sign raw XDR with a connected wallet
│   │   ├── WalletConnect.jsx   # Connect Freighter or Ledger hardware wallet
│   │   ├── AccountComparison.jsx   # Side-by-side comparison of up to 5 accounts
│   │   ├── ComparisonChart.jsx # Bar charts for the comparison view
│   │   ├── PortfolioValue.jsx  # USD portfolio value via CoinGecko prices
│   │   ├── PriceTicker.jsx     # XLM price bar shown at the top of every page
│   │   ├── DEXExplorer.jsx     # SDEX order book viewer + recent trades
│   │   ├── PathExplorer.jsx    # Horizon path-payment route finder
│   │   ├── RealTimeLedger.jsx  # Live SSE ledger stream with reconnection
│   │   ├── ExplorerEmbed.jsx   # Deep-link generator for Stellar Expert / Steexp
│   │   ├── ContractABI.jsx     # Contract ABI viewer
│   │   ├── ContractInteraction.jsx  # Contract interaction panel
│   │   ├── OrderBookChart.jsx  # Order book depth chart
│   │   ├── Card.jsx            # Reusable StatCard and Card components
│   │   └── CopyableValue.jsx   # Click-to-copy wrapper used throughout the UI
│   │
│   ├── charts/
│   │   ├── NetworkMetricsChart.jsx   # Network-level metrics over time
│   │   ├── AccountActivityChart.jsx  # Per-account activity chart
│   │   └── BalanceHistoryChart.jsx   # Balance history over time
│   │
│   ├── notifications/
│   │   ├── NotificationCenter.jsx    # Notification list overlay
│   │   └── NotificationItem.jsx      # Individual notification card
│   │
│   ├── accessibility/
│   │   ├── KeyboardNavigation.jsx    # Keyboard trap / focus management helper
│   │   └── ScreenReaderAnnouncer.jsx # ARIA live region for screen reader messages
│   │
│   ├── ErrorBoundary.jsx       # React error boundary wrapping the whole app
│   └── ErrorFallback.jsx       # Fallback UI shown when the boundary catches
│
├── lib/                        # Pure logic — no React
│   ├── stellar.ts              # All Stellar SDK calls: accounts, txs, ops, contracts,
│   │                           #   path payments, price feeds, validators, formatters
│   ├── stellar.js              # Legacy JS version (being replaced by .ts)
│   ├── store.ts                # Zustand store — full typed state shape
│   ├── store.js                # Legacy JS version (being replaced by .ts)
│   ├── dex.js                  # Order book, trades, liquidity pools, spread calc
│   ├── priceFeed.js            # CoinGecko price fetching + portfolio value calc
│   ├── streaming.js            # StreamManager class — SSE ledger stream with
│   │                           #   auto-reconnect, pub-sub, exponential backoff
│   ├── transactionBuilder.js   # Operation factory + build/simulate/submit helpers
│   ├── externalExplorers.js    # URL builders for Stellar Expert and Steexp
│   ├── chartUtils.js           # Recharts formatters, shared colors, placeholder data
│   ├── notifications.js        # Notification type definitions and ID generator
│   ├── storage.js              # IndexedDB persistence helpers
│   ├── errorReporting.js       # Error reporting service wrapper
│   ├── contractInvoker.js      # Contract invocation helpers
│   └── wallet/
│       ├── freighter.js        # Freighter browser extension connector
│       └── ledger.js           # Ledger hardware wallet connector (WebUSB/WebHID)
│
├── hooks/
│   ├── useAssetUsdEstimates.js # Fetches XLM + SDEX prices and returns USD estimates
│   │                           #   per balance entry; used in Overview and Account
│   ├── useNotifications.js     # Convenience hook: success/error/info/warning helpers
│   └── usePersistedState.js    # useState backed by IndexedDB via storage.js
│
├── utils/
│   ├── accessibility.js        # announceToScreenReader + subscribeToAnnouncements
│   ├── errorHandler.js         # formatErrorMessage + handleGlobalError
│   └── stateSync.js            # Cross-tab state synchronization helpers
│
└── styles/
    ├── globals.css             # CSS custom properties (design tokens), resets,
    │                           #   animations, spinner, theme variants
    ├── accessibility.css       # Focus ring styles, reduced-motion overrides
    └── themes.js               # THEMES enum, THEME_STORAGE_KEY, getSystemTheme()
```

---

## Features In Detail

### Connect Panel

The landing screen. Enter any valid Stellar public key (`G...`) and click Connect. The app validates the key with `StrKey.isValidEd25519PublicKey`, loads the account from Horizon, then fetches the first 20 transactions and operations in parallel in the background. Pressing Enter also triggers the connect.

### Overview

Summary dashboard for the connected account. Shows XLM balance with a USD estimate, number of non-native assets, recent transaction count, and the account sequence number. Below that is an asset holdings table with per-asset USD estimates (fetched from SDEX order books). The bottom section shows the 5 most recent transactions and live network stats (latest ledger, base fee, close time).

### Account Detail

Deep-dive into the connected account. Sections:

- Identity: public key, account ID, sequence number, creation date (fetched by finding the first `create_account` operation), XLM balance with USD estimate, subentry count, link to Stellar Expert
- Asset Balances: all non-native trustlines with issuer addresses and USD estimates
- Thresholds: low / medium / high signing thresholds
- Flags: auth_required, auth_revocable, auth_immutable, auth_clawback_enabled — shown as TRUE/FALSE badges
- Signers: all signers with their weights
- Open Offers: active SDEX sell offers for the account

### Transaction History

Tabbed view switching between Transactions and Operations. Both lists support cursor-based pagination — a "Load More" button appends the next 20 records without replacing existing ones. Transactions show hash (copyable), success/fail indicator, memo, fee in stroops, operation count, and timestamp. Operations show type label (human-readable via `OPERATION_LABELS` map), from/to addresses, and amount.

### Soroban Contracts

Two panels:

**Inspect Contract** — enter a contract address (`C...`), fetches the ledger entry via `SorobanRpc.Server.getContractData` and displays the raw JSON result.

**Invoke Contract** — build a contract call with:

- Contract ID, function name, source account
- Typed arguments (string, int, address, bool) — each parsed into the correct `ScVal` type
- Simulate button: calls `server.simulateTransaction` and shows return value, cost, events, and footprint (read-only / read-write ledger keys)
- Submit button (Testnet only): signs with a secret key, calls `server.prepareTransaction` then `server.sendTransaction`, shows hash and status

Mainnet safety mode disables submission but still allows simulation.

### Network Stats

Live network data with an SSE stream via `streamLedgers`. Shows:

- Latest ledger sequence, base fee, close time, successful/failed tx count, operation count
- Fee statistics table: min, mode, median, max, P10, P90 accepted fees
- Ledger close time chart (Recharts LineChart) — plots close interval in seconds for the last 20 ledgers with an average reference line
- Recent ledgers table (last 10)

### Testnet Faucet

Calls Friendbot (`https://friendbot.stellar.org?addr=<key>`) to fund any testnet account with 10,000 XLM. Pre-fills with the connected address. Disabled on Mainnet.

### Transaction Builder (Builder tab)

Simple builder for payment and createAccount operations. Supports source account, memo, base fee, and time bounds (min/max Unix timestamps). Simulate button validates operations and returns estimated fee. Export XDR button copies the unsigned transaction XDR to clipboard.

### Transaction Builder (txBuilder tab)

Extended builder with more operation types: payment, createAccount, changeTrust, accountMerge, manageData, fee bump, and sponsorship operations. Supports text/id/hash/return memo types. Uses `transactionBuilder.js` which has a full `createOperation` factory covering manageSellOffer, manageBuyOffer, setOptions, fee bump, and sponsorship flows.

### Transaction Signer

Paste any unsigned transaction XDR and sign it with the connected wallet. Freighter signs via `api.signTransaction`. Ledger signing is noted as requiring the device to be connected. The signed XDR is displayed and can be copied.

### Wallet Connect

Connect a real wallet instead of entering a public key manually:

- **Freighter**: detects `window.freighterApi`, calls `requestAccess()` then `getAddress()`
- **Ledger**: checks WebUSB/WebHID support, dynamically imports `@ledgerhq/hw-transport-webusb` and `@stellar/ledger` (optional peer deps), derives the public key from path `44'/148'/0'`

After connecting, the wallet's public key is set as the connected address and account data is loaded.

### Account Comparison

Compare up to 5 accounts side by side. Each slot has a public key input. Clicking "Compare All" fetches all accounts and their open offers in parallel. The comparison table shows: status, XLM balance, asset count, active orders, sequence number, subentries. Accounts can be sorted by balance, orders, or assets. Results can be exported as CSV. A `ComparisonChart` renders bar charts for visual comparison.

### Portfolio Value

Fetches USD prices for all held assets from CoinGecko (mapped via `ASSET_ID_MAP` in `priceFeed.js`). Displays total portfolio value and a per-asset breakdown with balance, price, and USD value. 24h price change indicators (↑/↓) are shown per asset.

### Price Ticker

Persistent bar at the top of every page showing the current XLM/USD price and 24h change, refreshed every 60 seconds from CoinGecko.

### DEX Explorer

Enter a selling asset (`native` or `CODE:ISSUER`) and a buying asset. Fetches the SDEX order book and recent trades via Horizon. Displays:

- Spread (absolute and percentage), best bid, best ask
- Aggregated bids and asks tables (top 10 levels with cumulative depth)
- Last 10 recent trades with price, amount, and time

### Path Explorer

Find cross-asset payment routes via Horizon's `/paths/strict-send` and `/paths/strict-receive` endpoints. Select source and destination assets (preset or custom), enter an amount, choose strict-send or strict-receive mode. Results are sorted by best rate and annotated with slippage percentage vs the best path.

### Real-Time Ledger

Live SSE stream of incoming ledgers using the `StreamManager` class in `streaming.js`. Shows connection status (connecting / live / reconnecting / error) with a pulsing indicator. Displays the latest ledger sequence, transaction count, and operation count as summary cards, plus a scrolling feed of all received ledgers. The stream uses exponential backoff (up to 30s, max 10 attempts) on errors.

### Explorer Integration

Generate deep links to external block explorers (Stellar Expert, Steexp) for accounts, transactions, contracts, assets, ledgers, and operations. Also shows quick-link cards to each explorer's homepage for the current network.

### Charts & Analytics

A combined view rendering three Recharts-based charts: NetworkMetricsChart, AccountActivityChart, and BalanceHistoryChart.

### Alert Rules
Custom alert rules engine that monitors account activity and delivers notifications. Create rules for:
- **Balance Thresholds**: Alert when balances go above or below specified amounts
- **Operation Types**: Monitor specific operation types (payments, trustlines, etc.)
- **Counterparty Tracking**: Track transactions with specific addresses

Rules are evaluated client-side with configurable frequencies (30s to 10min). Notifications are delivered in-app and optionally via browser notifications. All rules and notifications are persisted in IndexedDB per account.

---

## State Management

All global state lives in a single Zustand store (`src/lib/store.ts`). The store is fully typed with TypeScript interfaces. Key state slices:

| Slice                            | What it holds                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `network`                        | `'mainnet'`, `'testnet'`, `'futurenet'`, `'local'`, or `'custom'` — switching resets account/tx/ops data |
| `connectedAddress`               | The currently viewed public key                                                                          |
| `accountData`                    | Full `Horizon.AccountResponse`                                                                           |
| `transactions` / `operations`    | Arrays with cursor-based pagination state                                                                |
| `networkStats`                   | Latest ledger + fee stats                                                                                |
| `activeTab`                      | Which dashboard tab is rendered                                                                          |
| `contractId` / `contractData`    | Soroban contract inspector state                                                                         |
| `faucetLoading` / `faucetResult` | Faucet request state                                                                                     |
| Comparison slots                 | Array of `{ key, data, loading, error }` for multi-account view                                          |
| Stream state                     | `streamStatus`, `streamLedgers` for the real-time ledger feed                                            |
| Prices                           | CoinGecko price map keyed by asset code                                                                  |
| Notifications                    | Array of `{ id, type, title, message }`                                                                  |
| Wallet                           | `walletConnected`, `walletType`, `walletPublicKey`                                                       |

---

## Network Configuration

Defined in `src/lib/stellar.ts`:

| Network   | Horizon URL                             | Soroban RPC URL                         |
| --------- | --------------------------------------- | --------------------------------------- |
| Testnet   | `https://horizon-testnet.stellar.org`   | `https://soroban-testnet.stellar.org`   |
| Mainnet   | `https://horizon.stellar.org`           | `https://soroban-rpc.stellar.org`       |
| Futurenet | `https://horizon-futurenet.stellar.org` | `https://soroban-futurenet.stellar.org` |
| Local     | `http://localhost:8000`                 | `http://localhost:8000/soroban/rpc`     |
| Custom    | _User defined_                          | _User defined_                          |

The network switcher in the sidebar calls `setNetwork()` which resets all account-specific state.

---

## Bundle Size & Performance

### Size budget

The CI `bundle-size` job enforces a **500 KB gzipped** limit on the main entry chunk. A PR that exceeds this threshold will fail. To bypass intentionally (e.g. a large dependency bump that will be addressed in a follow-up), add the `skip-bundle-check` label to the PR and document the reason in the PR description.

### Chunk strategy

Vite splits the output into stable, cacheable chunks so that a UI-only change does not bust the Stellar SDK cache:

| Chunk | Contents | Why separate |
|---|---|---|
| `stellar-sdk` | `@stellar/stellar-sdk` | Largest dep; changes rarely |
| `react-vendor` | `react`, `react-dom`, `react-router-dom` | Stable; long cache TTL |
| `ui-vendor` | `recharts`, `lucide-react` | Changes with design work |
| `i18n` | `i18next`, `react-i18next`, `i18next-browser-languagedetector` | Only needed after first render |
| `index` (entry) | Application code | Changes on every commit |

### Bundle visualizer

Generate an interactive treemap of the bundle at any time:

```bash
# Linux / macOS
npm run build:analyze   # builds with ANALYZE=1, writes dist/stats.html
open dist/stats.html    # open in browser

# Windows (PowerShell)
$env:ANALYZE=1; npm run build; Remove-Item Env:ANALYZE
# then open dist/stats.html in your browser
```

In CI, add the `generate-bundle-report` label to a PR (or trigger the workflow manually via **Actions → CI → Run workflow**) to upload `dist/stats.html` as a downloadable artifact retained for 30 days.

---

## TypeScript Migration

The project is mid-migration from JavaScript to TypeScript. The Vite config sets `.ts` to resolve before `.js`, so imports of `stellar` and `store` automatically use the typed versions. `tsconfig.json` covers `src/lib/**/*.ts` with strict mode enabled. `allowJs: true` and `checkJs: false` let the remaining `.jsx` components import from the typed lib files without errors.

---

## Styling

All design tokens are CSS custom properties defined in `globals.css`. The app supports dark and light themes via a `data-theme` attribute on `<html>`, set reactively from the Zustand `theme` state. Fonts are Space Mono (monospace, used for addresses, hashes, numbers) and Syne (display, used for headings). All component styles are inline — no CSS modules or Tailwind.

---

## Accessibility

- `ScreenReaderAnnouncer` renders an ARIA live region; components call `announceToScreenReader()` from `utils/accessibility.js` to push messages
- `KeyboardNavigation` handles focus trapping for modal-like panels
- `accessibility.css` provides focus ring styles and `prefers-reduced-motion` overrides
- `ErrorBoundary` wraps the app and renders `ErrorFallback` on uncaught errors

---

## Contributing

This project is part of the [Stellar Wave Program](https://www.drips.network/wave/stellar) on Drips. Check open issues tagged `Stellar Wave` to contribute and earn rewards.

### Good First Issues

- [ ] Add pagination to transaction history
- [ ] Dark/light theme toggle
- [ ] Copy-to-clipboard on addresses
- [ ] Ledger close time chart (last 10 ledgers)
- [ ] Offer list viewer per account

### Medium Issues

- [ ] Real-time ledger streaming via SSE
- [ ] Asset price feed integration
- [ ] Multi-account comparison view
- [ ] Soroban contract invocation UI

### High Complexity

- [ ] Full Soroban contract interaction panel (call contract functions)
- [ ] Transaction builder / simulator
- [ ] Path payment explorer

---

## License

MIT
