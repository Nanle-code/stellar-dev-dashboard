# Offline support

The dashboard is a progressive web app. After a first visit while online, it can
reopen without a connection and show data it has already fetched. This page lists
which views work offline, which run in a degraded read-only mode, and which need
a live connection, along with the known limitations.

## Summary

| Level                            | Meaning                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Works offline**                | Runs entirely in the browser. Everything works once the view's code is cached.                                                       |
| **Degraded (cached, read-only)** | Shows previously fetched data with a stale-data badge. Refresh, pagination past the cache, and network writes are blocked or queued. |
| **Online only**                  | Needs a live connection: streaming, endpoints that are never cached, or network writes. The view shows an offline notice.            |

When you go offline, the offline banner shows the current view's level and what
you can still do.

## Before you go offline

Offline access only covers what the browser has already cached:

1. Open the dashboard while online so the service worker installs.
2. Open each view you want offline at least once. The app shell (`/`,
   `/index.html`, `/manifest.json`) is precached; each view's code is cached the
   first time you open it.
3. Load the accounts, transactions, or order books you need. Degraded views can
   only show data that was fetched while online.

## Capability matrix

This table is generated from
[`src/lib/offlineCapabilities.ts`](../../src/lib/offlineCapabilities.ts). A unit
test fails if the table and the registry drift, or if a route is added without
declaring its offline level. To regenerate it after changing the registry:

```bash
UPDATE_OFFLINE_DOCS=1 pnpm exec vitest run src/lib/__tests__/offlineCapabilities.test.ts
```

<!-- offline-matrix:start -->

### ANALYTICS

| View                                   | Path                      | Offline                      | Notes                                                                     |
| -------------------------------------- | ------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Overview                               | `/overview`               | Degraded (cached, read-only) | Last cached account and network summary.                                  |
| Account                                | `/account/:address?`      | Degraded (cached, read-only) | Cached balances and signers with a stale-data badge. Refresh is disabled. |
| Claimable                              | `/claimableBalances`      | Degraded (cached, read-only) | Cached list only. Claiming needs a connection.                            |
| Compare                                | `/compare`                | Degraded (cached, read-only) | Only accounts already cached can be compared.                             |
| Transactions                           | `/transactions/:hash?`    | Degraded (cached, read-only) | Previously loaded pages only. Pagination beyond the cache fails.          |
| Contracts                              | `/contracts/:contractId?` | Degraded (cached, read-only) | Cached contract metadata. Invocation is blocked.                          |
| Assets                                 | `/assets`                 | Degraded (cached, read-only) | Previously loaded asset lists only.                                       |
| Anchors                                | `/anchors`                | Online only                  | SEP endpoints on anchor domains are never cached.                         |
| Search                                 | `/search`                 | Degraded (cached, read-only) | Searches cached results and saved queries only.                           |
| Transaction Analytics (not in sidebar) | `/txAnalytics`            | Degraded (cached, read-only) | Cached transactions only.                                                 |

### NETWORK

| View                          | Path                  | Offline                      | Notes                                                                   |
| ----------------------------- | --------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| Network Info                  | `/network`            | Degraded (cached, read-only) | Cached ledger stats. Fee stats are always live and show as unavailable. |
| Validator AI                  | `/validatorPredictor` | Degraded (cached, read-only) | Last computed predictions only.                                         |
| Real-Time                     | `/realtime`           | Online only                  | Horizon streaming; pauses until reconnected.                            |
| Live Activity                 | `/liveActivity`       | Online only                  | Live stream; pauses until reconnected.                                  |
| Cache Stats                   | `/cacheStats`         | Works offline                | Reads local cache metrics.                                              |
| Performance                   | `/performance`        | Works offline                | Reads in-browser performance metrics.                                   |
| Fee Forecast (not in sidebar) | `/feeForecast`        | Online only                  | `/fee_stats` is never cached.                                           |

### BUILD

| View                                  | Path                       | Offline                      | Notes                                                                              |
| ------------------------------------- | -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| Builder                               | `/builder`                 | Degraded (cached, read-only) | Build and export XDR offline. Loading sequence numbers and submitting are blocked. |
| Simulator                             | `/txSimulator`             | Online only                  | Simulation calls Soroban RPC (POST, never cached).                                 |
| Advanced Sim                          | `/advancedSim`             | Online only                  | Simulation calls Soroban RPC (POST, never cached).                                 |
| Soroban Debugging                     | `/sorobanDebug`            | Works offline                | Static tutorial content.                                                           |
| Learning Hub                          | `/learningHub`             | Works offline                | Static course content.                                                             |
| Faucet                                | `/faucet`                  | Online only                  | Friendbot is network-only; funding is a write.                                     |
| Transaction Builder (not in sidebar)  | `/txBuilder`               | Degraded (cached, read-only) | Build and export XDR offline. Submitting is blocked.                               |
| Contract Interaction (not in sidebar) | `/contractInteraction`     | Online only                  | Invocation is a network write.                                                     |
| Contract ABI (not in sidebar)         | `/contractABI`             | Degraded (cached, read-only) | Parsing an uploaded WASM works offline; fetching by contract ID does not.          |
| Contract AI (not in sidebar)          | `/contractRecommendations` | Degraded (cached, read-only) | Recommendations from cached data only.                                             |

### EXPLORE

| View           | Path                   | Offline                      | Notes                                          |
| -------------- | ---------------------- | ---------------------------- | ---------------------------------------------- |
| DEX            | `/dex`                 | Degraded (cached, read-only) | Cached order books and trades, possibly stale. |
| Liquidity AI   | `/liquidityPrediction` | Online only                  | Needs the ML prediction service.               |
| Path Explorer  | `/pathExplorer`        | Degraded (cached, read-only) | Only path queries already cached resolve.      |
| Explorer Links | `/explorers`           | Online only                  | Embeds third-party explorer sites.             |

### PAYMENTS

| View         | Path               | Offline     | Notes                                     |
| ------------ | ------------------ | ----------- | ----------------------------------------- |
| Pay Channels | `/paymentChannels` | Online only | Channel state changes are network writes. |

### TOOLS

| View                | Path                    | Offline                      | Notes                                                                            |
| ------------------- | ----------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| Wallet              | `/wallet`               | Online only                  | Wallet extensions and account lookup need a connection.                          |
| Signer              | `/signer`               | Degraded (cached, read-only) | Sign XDR locally. Submission is blocked until reconnected.                       |
| Multisig            | `/multisig`             | Degraded (cached, read-only) | Collect signatures on a loaded transaction. Submission is blocked.               |
| DID                 | `/did`                  | Online only                  | DID resolution needs the network.                                                |
| Alerts              | `/alertRules`           | Degraded (cached, read-only) | Edit rules locally. Rules are not evaluated until reconnected.                   |
| Portfolio           | `/portfolio`            | Online only                  | Prices come from a network-only price feed.                                      |
| Portfolio Analytics | `/portfolioAnalytics`   | Degraded (cached, read-only) | Analytics over cached history only.                                              |
| Sandbox Demos       | `/sandboxAnalytics`     | Works offline                | Uses bundled fixture datasets.                                                   |
| Trading Agent       | `/autonomousTrading`    | Online only                  | Trading needs live market data and submission.                                   |
| Charts              | `/charts`               | Degraded (cached, read-only) | Charts render from cached series only.                                           |
| Data Stories        | `/dataStorytelling`     | Degraded (cached, read-only) | Stories render from cached data only.                                            |
| Analytics           | `/analytics`            | Degraded (cached, read-only) | Cached metrics only.                                                             |
| Design System       | `/designSystem`         | Works offline                | Static component catalogue.                                                      |
| Flags               | `/featureFlags`         | Works offline                | Flags are stored locally.                                                        |
| Code Review         | `/codeReview`           | Works offline                | Analysis runs in the browser.                                                    |
| AI Patterns         | `/txPatterns`           | Degraded (cached, read-only) | Analyses cached transactions only.                                               |
| Anomaly Viz         | `/anomalyViz`           | Degraded (cached, read-only) | Analyses cached transactions only.                                               |
| Health              | `/systemHealth`         | Online only                  | Health probes need the network.                                                  |
| Monitoring          | `/monitoringDashboards` | Degraded (cached, read-only) | Last collected metrics only.                                                     |
| Forecast            | `/throughputForecast`   | Online only                  | Needs live ledger throughput.                                                    |
| Export              | `/dataExport`           | Degraded (cached, read-only) | Exports cached data only.                                                        |
| Collaboration       | `/collaboration`        | Online only                  | Real-time sessions need a connection.                                            |
| Governance          | `/governance`           | Online only                  | Proposals and votes are network reads and writes.                                |
| Settings            | `/settings`             | Works offline                | Preferences save locally. Switching network loads no new data until reconnected. |
| Audit               | `/audit`                | Works offline                | Audit log is stored locally.                                                     |
| AI Personalization  | `/personalization`      | Works offline                | Preferences save locally.                                                        |
| Security            | `/security`             | Degraded (cached, read-only) | Local checks run; network-backed checks are skipped.                             |
| Dependencies        | `/dependencyManagement` | Works offline                | Uses bundled dependency data.                                                    |

### SYSTEM

| View                         | Path          | Offline       | Notes                      |
| ---------------------------- | ------------- | ------------- | -------------------------- |
| Compliance (not in sidebar)  | `/compliance` | Works offline | Reads the local audit log. |
| Dev Toolbar (not in sidebar) | `/devToolbar` | Works offline | Local developer tooling.   |

<!-- offline-matrix:end -->

## How it works

| Layer                             | Behaviour offline                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| App shell and static assets       | Cache-first from the `stellar-shell-v4` cache. Navigations fall back to `/index.html`.              |
| Horizon / Soroban `GET` responses | Network-first. When the network fails, the last cached response is served and marked `cache-stale`. |
| In-memory cache                   | Entries expire after 1 minute (`TTL.ACCOUNT`). Past that, views rely on the service worker cache.   |
| Network writes                    | Blocked by `assertWriteSafe` with an `OfflineWriteError`, unless the caller queues them.            |
| Offline queue                     | Queued writes are replayed with retry and back-off when the browser reports it is online again.     |

See [`src/lib/offlineReadOnly.ts`](../../src/lib/offlineReadOnly.ts) for the
read-only contract and [`public/sw.js`](../../public/sw.js) for caching rules.

## Known limitations

- **Views never opened online are unavailable.** Only the app shell is precached.
  A view whose code chunk was never loaded shows the offline fallback.
- **Degraded views need cached data.** An account or transaction page that was
  never fetched has nothing to show.
- **Short API cache lifetime.** Service worker API entries are fresh for 30
  seconds and then served only as stale fallbacks. The bucket holds at most 150
  responses; the oldest are evicted first, so heavy browsing can push out data
  you meant to keep.
- **Some endpoints are never cached:** `/fee_stats`, any `/transactions` write,
  Friendbot, and the price feed. Fee estimates, faucet funding, and portfolio
  valuation are always online-only.
- **Queued writes do not survive a reload.** The queue keeps the operation itself
  in memory. After a page reload, persisted queue records have no operation to
  replay and are discarded when the queue next flushes. Keep the tab open until
  the banner's pending count reaches zero.
- **Captive portals.** The browser can report "online" behind a captive portal. A
  heartbeat re-checks connectivity every 15 seconds, so there can be a short
  window where requests fail before the app switches to offline mode.
- **Streaming pauses.** Live ledger and activity streams stop while offline and
  resume on reconnect. Events missed while offline are not backfilled.

## Compatibility

| Environment                                                  | Offline behaviour                                                                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium browsers (Chrome, Edge, Brave), desktop and Android | Full support, including Background Sync for queue replay.                                                                                      |
| Firefox                                                      | Supported. No Background Sync; the queue replays on the `online` event while the tab is open.                                                  |
| Safari (macOS, iOS)                                          | Supported without Background Sync. iOS may evict service worker storage after about 7 days without use, so reopen the app online periodically. |
| Private / incognito windows                                  | Caches are cleared when the window closes. Offline access lasts only for the session.                                                          |
| Browsers without service workers, or when blocked by policy  | No offline support. Reloading while offline fails; an already-open tab keeps working with in-memory data.                                      |
| Automated browsers (`navigator.webdriver`)                   | Service worker registration is skipped, so E2E tests run online-only.                                                                          |

## Security notes

- Cached API responses are public ledger data. Secret keys and signed transaction
  envelopes are never written to the service worker cache.
- Anyone with access to the browser profile can read cached account data. On a
  shared machine, use a private window or clear site data from **Settings**.
- Offline signing in **Signer** and **Multisig** uses keys in memory only. It does
  not submit anything until you reconnect and confirm.

## Reporting a mismatch

If a view behaves differently offline than this page says, open an issue with the
view name, browser, and steps. Update its entry in `offlineCapabilities.ts`, then
regenerate the table with the command above.
