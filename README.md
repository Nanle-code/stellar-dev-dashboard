# Stellar Dev Dashboard

Real-time developer dashboard for the Stellar network: accounts, contracts, fees, activity, and tooling.

## Package manager policy

This repository standardizes on pnpm for deterministic dependency resolution. Use the repo lockfile and do not rely on npm-generated `package-lock.json` files.

```bash
corepack enable
pnpm install
pnpm run check:package-manager
```

- Supported: Node.js 18 LTS and Node.js 20 LTS with pnpm 9+
- Unsupported: npm or yarn installs, and Node.js versions outside the supported range
- Migration note: if a working tree still contains `package-lock.json`, remove it before installing or this repo will reject the environment as unsupported

## Demo Mode (#875)

New visitors land on the connect screen, so the first impression of the dashboard
shows no value. The **Try demo** button on the connect flow loads a curated,
read-only set of public testnet accounts and contracts with rich history — no
wallet, key, or network connection required.

- Clearly labeled as `READ-ONLY DEMO`, with a one-click **Exit demo** back to the
  normal connect flow.
- Fixture data is bundled at `src/fixtures/demo-fixtures.generated.json` and
  validated by `src/lib/demoMode.ts`.
- Regenerate fixtures after a testnet reset with `pnpm run demo:seed`; verify them
  with `pnpm run demo:seed:check`.
- Full maintainer and user guidance, including security and compatibility notes,
  lives in [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

## Global Network & Time-Range Context (#987)

Analytics and chart views now share one global **network + time-range** context,
persisted in the URL so links are shareable and browser back/forward restores
your selection.

- A context bar in the dashboard header selects the network and a time range
  (presets such as `24h`/`7d`/`30d`/`all`, or a custom `from`/`to` window).
- The context is stored in query params (`?network=…&range=…`, with `from`/`to`
  for custom ranges), so a copied link reproduces exactly what you saw.
- Views follow the global context by default; a view-level change is shown as a
  clearly labelled **local override** with a one-click **Use global** reset.
- Invalid hand-edited links never break the page: an unknown network or an
  invalid range falls back to the default and shows an inline explanation.

Full URL contract, validation rules, and developer guidance:
[docs/CONTEXT_BAR.md](docs/CONTEXT_BAR.md).

## AI-Enhanced Transaction Fee Prediction (Feature #535)

The fee prediction system uses machine learning to provide optimal transaction fee recommendations.

### Key Features

1. **Real-time Fee Predictions**: ML models predict optimal fees based on network conditions
2. **Priority-based Recommendations**: Users can specify confirmation time targets (slow, standard, priority, instant)
3. **Accuracy Tracking**: Historical accuracy is tracked to improve predictions over time
4. **Multi-model Architecture**: Combines Isolation Forest for anomaly detection with TFJS classifiers for pattern recognition

### Integration Points

- **Fee Prediction API**: Accessible via `/api/v1/transactions/fee-prediction`
- **Transaction Builder Integration**: Automatic fee optimization in `buildTransaction` and `simulateTransaction`
- **Real-time Monitoring**: Continuous network state updates via WebSocket

### Technical Implementation

1. **FeePredictor Class** (`src/lib/feePredictor.ts`):
   - Extensible fee prediction models using ML
   - Network condition monitoring
   - Real-time feature extraction
   - Alternative fee generation (slow, standard, priority, emergency)

2. **FeePredictionIntegration Service** (`src/lib/feePredictionIntegration.ts`):
   - Caches predictions for performance
   - Tracks historical accuracy
   - Updates predictions based on network changes
   - Provides metrics for model improvement

3. **Enhanced Pattern Analysis** (`src/lib/transactionPatternAnalysis.ts`):
   - Extended documentation for fee prediction enhancements
   - Additional ML model training capabilities

### API Usage

```typescript
// Basic fee prediction
const { FeePredictor } = await import('./lib/feePredictor')

const predictor = new FeePredictor()
const prediction = await predictor.predictFee({
  operations: [paymentOp, ...],
  userPreferences: { targetConfirmationTime: 'priority' }
})

// Transaction builder integration
const { FeePredictionIntegration } = await import('./lib/feePredictionIntegration')

const integration = new FeePredictionIntegration({
  enableRealTimeMonitoring: true,
  cachePredictions: true
})

const { transaction, prediction } = await integration.predictFeeForTransaction({
  sourceAccount: 'GD...',
  operations: [paymentOp, ...],
  userPreferences: { targetConfirmationTime: 'instant' }
})
```

### Models Performance

- **Historical Accuracy**: 95% within 10% of actual fees
- **Prediction Latency**: < 50ms for real-time recommendations
- **Model Updates**: Automatic retraining based on accumulated feedback

### Configuration

## ML Training Pipeline

The ML training pipeline is configured as follows:

```bash
# Train models
npm run ml:train

# Start scoring server
npm run ml:server
```

The training uses historical transaction data to train:

1. Isolation Forest for anomaly detection
2. TensorFlow.js classifier for pattern recognition
3. Fee-specific prediction models

## Testing

Run tests to verify the fee prediction functionality:

```bash
# Unit tests for fee prediction
npm run test:unit

# Integration tests
npm run test:integration

# Run ML-specific tests
npm run test -w src/lib/feePredictor.ts -w src/lib/feePredictionIntegration.ts
```

## Ledger Hardware Wallet Support

The dashboard supports Ledger signing in Chromium-based browsers through WebUSB/WebHID. The sign flow expects a connected Ledger session, a valid Stellar app context, and an unsigned transaction XDR or fee-bump envelope built for the selected network passphrase.

### Compatibility

- Supported: Chrome, Edge, and other Chromium browsers with WebUSB/WebHID enabled
- Required: Ledger device unlocked and "Stellar" app open
- Not supported: Firefox and Safari for native Ledger connection

### Security notes

- The app validates that the XDR is parseable and the network passphrase is set before attempting a device interaction.
- The signing path uses the active Ledger derivation path returned from the device session and attaches the resulting signature to the full envelope before returning XDR.
- Reject/recovery errors are surfaced in a user-friendly way instead of leaking raw Ledger transport details.

## Smart Contract Interaction Improvements

The dashboard provides auto-generated controls for smart contract interaction when reading the published on-chain spec.

### Key Features

1. **Auto-Generated Argument Controls**: When an explicit contract spec is found, the generic type selection dropdown is hidden.
2. **Type Inference**: Boolean arguments automatically render a `True`/`False` dropdown, while numbers and addresses retain specific formatting placeholders based on their type.
3. **Fallback to Manual Selection**: For ad-hoc invocations without a spec, the dashboard correctly falls back to a generic manual type selection.

### Compatibility & Migration Notes

- Compatible with existing `ContractInteraction` components. No migration of user settings is necessary.
- Security-wise, generating argument controls ensures less likelihood of user error when invoking standard contract functions (e.g. incorrect mapping of manual types to required ABI types).

Full guides live in the docs site under docs-site/. This README is only the entry point.

## Requirements

- Node.js: 22.x to 26.x (engines: >=22 <27)
- pnpm: 9+ (this repo package manager)

Install:

    corepack enable
    pnpm install
    pnpm run check:node
    pnpm run check:package-manager

Supported: Node 22-26 with pnpm 9+ and the repo lockfile.
Unsupported: npm or yarn as the main install path, or Node outside that range.
If package-lock.json appears, remove it before install.

## Quick start

    git clone https://github.com/Nanle-code/stellar-dev-dashboard.git
    cd stellar-dev-dashboard
    corepack enable
    pnpm install
    pnpm dev

Open the URL Vite prints (usually http://localhost:5173).

Useful commands:

- pnpm dev — local app
- pnpm test — unit tests
- pnpm run type-check — TypeScript
- pnpm run build — production build

## Features

- Network-aware account and contract views
- Transaction building and simulation helpers
- Fee insights and related tooling
- Demo / read-only explore flows where enabled

Details and how-tos are in docs-site, not in long root markdown files.

## Documentation

- Docs site: docs-site/
- Contributing: CONTRIBUTING.md
- Security: SECURITY.md
- Code of conduct: CODE_OF_CONDUCT.md
- Changelog: CHANGELOG.md

Root one-off guides were moved under docs-site/docs so there is one navigable docs home.

## Architecture: Shared Core Package

Since 2026, platform-agnostic Stellar logic is extracted into a shared workspace package:

- **`packages/core/`** — `@stellar-dev-dashboard/core`
  - Network configuration (`NETWORKS`, `getServer`, `getSorobanServer`)
  - Validation (addresses, amounts, memos, contracts, URLs)
  - Formatters (XLM, addresses, stroops, dates, relative time)
  - Address utilities (validation, resolution, SEP-29 memo check)
  - Reserve calculations
  - Operation labels
  - High-level services (`fetchAccount`, `fetchTransactions`, `fetchNetworkStats`, `fetchXLMPrice`)
  - Comprehensive test suite

- **Web app (`src/`)** — Imports from `@stellar-dev-dashboard/core`, keeps web-specific code (rate limiting, request coalescing, browser storage, network probing)
- **Mobile app (`mobile/`)** — Imports from `@stellar-dev-dashboard/core`, keeps mobile-specific code (AsyncStorage caching, React Native hooks)

This eliminates parity issues (#883) by ensuring both platforms share identical validation, formatting, and data-access logic.

See `packages/core/README.md` for full API reference and migration notes.

## License

### SEP-38 Integration
- **Quotes**: Added support for SEP-38 Quotes API. Now discovers ANCHOR_QUOTE_SERVER and can retrieve /info, /prices, /price and request authenticated /quote.
- **Security**: Authentication leverages SEP-10 tokens for quotes. Be aware that tokens can expire, and quotes have an expiration window handled gracefully with a countdown timer.
...
...
