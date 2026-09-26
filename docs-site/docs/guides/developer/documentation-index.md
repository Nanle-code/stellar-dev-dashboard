# ✦ Stellar Dev Dashboard

> A real-time, open-source developer dashboard for the Stellar network — built with Vite + React.

![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)
![Network: Stellar](https://img.shields.io/badge/Network-Stellar-blue.svg)
![Stack: Vite + React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-yellow.svg)
![Status: Active](https://img.shields.io/badge/Status-Active-green.svg)
![Stellar Wave](https://img.shields.io/badge/Stellar-Wave%20Program-blueviolet.svg)

---

## Overview!!

**Stellar Dev Dashboard** is a free, open-source web application that gives Stellar developers a unified, real-time view of accounts, transactions, smart contracts, and network activity — all in one place.

It is purpose-built for developers working on the Stellar ecosystem who need quick access to on-chain data without switching between multiple tools. Whether you're debugging a Soroban contract, checking account balances, or monitoring network fee stats, this dashboard brings it all under one roof.

This project is actively maintained and participates in the [Stellar Wave Program](https://www.drips.network/wave/stellar) on Drips — a monthly open-source contribution sprint where contributors can earn rewards for merged pull requests.

---

## Features

### 🔑 Account & Balance Viewer
Inspect any Stellar public key in detail. View all asset balances (XLM and non-native), account flags, signing thresholds, signer list, and sequence number. Works on both Mainnet and Testnet.

### ⇄ Transaction & Operation History
Browse the full transaction and operation history for any account. Filter between transactions and individual operations, with details including fees, memos, timestamps, and direct links to Stellar Expert.

### ◻ Soroban Contract Explorer
Enter any Soroban smart contract address to inspect its on-chain ledger data, WASM hash, and persistent instance storage via the Soroban RPC. Built to support developers actively building and debugging contracts.

### ◎ Network Stats
Live network information including the latest ledger sequence, base fee, transaction count, operation count, fee percentile breakdowns (P10–P90), and a stream of recent ledgers.

### ⬡ Testnet Faucet
Fund any testnet account directly from the dashboard using Stellar's Friendbot. Activates new accounts and re-funds existing ones with 10,000 XLM. Only available on Testnet.

### 🔌 Wallet Connect
Connect any Stellar public key (G...) on either Mainnet or Testnet to load account data, history, and balances instantly.

---

## Screenshots

> _Coming soon — add screenshots of the dashboard, account view, and contract explorer here._

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/stellar-dev-dashboard.git
cd stellar-dev-dashboard

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
stellar-dev-dashboard/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                  # App entry point
    ├── App.jsx                   # Root component + layout
    ├── styles/
    │   └── globals.css           # Design system & CSS variables
    ├── lib/
    │   ├── stellar.js            # Stellar SDK wrapper (Horizon + Soroban RPC)
    │   └── store.js              # Zustand global state
    └── components/
        ├── layout/
        │   └── Sidebar.jsx       # Navigation sidebar
        └── dashboard/
            ├── ConnectPanel.jsx  # Landing / wallet connect screen
            ├── Overview.jsx      # Account summary + recent activity
            ├── Account.jsx       # Full account detail view
            ├── Transactions.jsx  # Transaction & operation history
            ├── Contracts.jsx     # Soroban contract explorer
            ├── NetworkStats.jsx  # Live ledger & fee statistics
            ├── Faucet.jsx        # Testnet Friendbot faucet
            └── Card.jsx          # Reusable UI components
```

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Vite](https://vitejs.dev/) | Build tool & dev server |
| [React 18](https://reactjs.org/) | UI framework |
| [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) | Horizon API & Soroban RPC |
| [Zustand](https://github.com/pmndrs/zustand) | Global state management |
| [date-fns](https://date-fns.org/) | Date formatting |
| [Lucide React](https://lucide.dev/) | Icon library |

---

## Contributing

This project participates in the **[Stellar Wave Program](https://www.drips.network/wave/stellar)** on Drips. Contributors who resolve issues during an active Wave earn Points that translate to real USDC rewards.

**Read the [Terms & Rules](https://docs.drips.network/wave/terms-and-rules) before contributing.**

### How to Contribute

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit: `git commit -m "feat: description"`
4. Push to your fork: `git push origin feature/your-feature-name`
5. Open a Pull Request against `main`

Please make sure your PR:
- Is scoped to a single issue
- Includes a clear description of what was changed and why
- Does not introduce breaking changes without discussion

---

## Roadmap

- **v0.1** — Account viewer, transaction history, Soroban explorer, network stats, faucet ✅
- **v0.2** — Real-time ledger streaming, asset prices, DEX order book
- **v0.3** — Transaction builder, contract invocation UI
- **v1.0** — Full Stellar developer toolkit with wallet signing support

---

## License

MIT © 2025 — See [LICENSE](./LICENSE) for details.

---

## Acknowledgements

Built on top of the [Stellar SDK](https://github.com/stellar/js-stellar-sdk) and [Horizon API](https://developers.stellar.org/api/horizon) by the Stellar Development Foundation.

Part of the [Stellar Wave Program](https://www.drips.network/wave/stellar) — funding open-source development on Stellar via [Drips](https://www.drips.network).
