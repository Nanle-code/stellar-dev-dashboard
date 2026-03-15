# ✦ Stellar Dev Dashboard

A real-time, open-source developer dashboard for the Stellar network — built with Vite + React.

![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)
![Network: Stellar](https://img.shields.io/badge/Network-Stellar-blue.svg)
![Stack: Vite + React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-yellow.svg)

## Features

- **Account & Balance Viewer** — Inspect any Stellar public key: balances, flags, thresholds, signers
- **Transaction History** — Full transaction and operation history with memos, fees, and timestamps
- **Soroban Contract Explorer** — Inspect Soroban smart contract ledger data and WASM hashes
- **Network Stats** — Live ledger info, fee statistics, recent ledger stream
- **Testnet Faucet** — Fund accounts via Friendbot directly in the UI
- **Wallet Connect** — Connect any public key on Mainnet or Testnet

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://reactjs.org/)
- [@stellar/stellar-sdk](https://github.com/stellar/js-stellar-sdk) — Horizon & Soroban RPC
- [Zustand](https://github.com/pmndrs/zustand) — state management
- [date-fns](https://date-fns.org/) — date formatting
- [Lucide React](https://lucide.dev/) — icons

## Contributing

This project is part of the [Stellar Wave Program](https://www.drips.network/wave/stellar) on Drips.
Check open issues tagged `Stellar Wave` to contribute and earn rewards.

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

## License

MIT
