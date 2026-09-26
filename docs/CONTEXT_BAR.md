# Global Network & Time-Range Context (#987)

Every analytics and chart view now shares one **global context**: the active
Stellar network and a time range. The context lives in the URL query string, so
a copied link reproduces exactly what the sender was looking at, and browser
back/forward restores the previous selection.

## URL contract

| Param | Values | Notes |
|-------|--------|-------|
| `network` | `mainnet` \| `testnet` \| `futurenet` \| `local` \| `custom` | Case-insensitive. Absent → the stored preference (`stellar:selected-network`, default `testnet`). |
| `range` | `15m` \| `1h` \| `6h` \| `24h` \| `7d` \| `30d` \| `90d` \| `1y` \| `all` \| `custom` | Absent → `24h`. |
| `from` | `YYYY-MM-DD`, ISO-8601, or epoch-ms | Required when `range=custom`. |
| `to` | `YYYY-MM-DD`, ISO-8601, or epoch-ms | Required when `range=custom`, and must be `>= from`. |

Examples:

```
/overview?network=mainnet&range=7d
/charts?network=testnet&range=custom&from=2026-09-01&to=2026-09-14
```

Unrelated query params (deep-link params, feature flags, …) are preserved when
the context bar writes to the URL.

## Validation & fallbacks

Parsing lives in [`src/lib/context/url-context.ts`](../src/lib/context/url-context.ts)
and never throws. Invalid input degrades to a documented default and the header
bar shows an inline explanation:

| Input | Result |
|-------|--------|
| Unknown `network` (e.g. `network=ethereum`) | Falls back to the default network (`testnet`) and raises `unknown-network`. The raw value is echoed back. |
| Unrecognised `range` (e.g. `range=banana`) | Falls back to `24h` and raises `invalid-range`. |
| `range=custom` missing `from`/`to` | Falls back to `24h` and raises `incomplete-custom-range`. |
| `range=custom` with unparseable bounds | Falls back to `24h` and raises `invalid-range`. |
| `range=custom` where `from > to` | Falls back to `24h` and raises `reversed-custom-range`. |

The custom-range picker additionally refuses to submit invalid bounds and shows
an inline error instead of writing a broken URL.

## How views consume the context

- `DashboardProvider` (`src/context/DashboardContext.tsx`) parses the URL and
  exposes `network`, `range`, `resolvedRange` (concrete `start`/`end` dates) and
  the setters.
- Because every analytics/chart view already reads the network from the Zustand
  store, the provider mirrors the URL network into `store.setNetwork()`. A shared
  link therefore drives the whole dashboard, not just the header.
- `useDashboardContext()` is the hook views use for the time range and for
  `resolvedRange`.
- `ContextScopeNotice` renders the active context inside a view and clearly
  flags a **view-level override** ("Local override: …") with a one-click
  **Use global** action.

## Back/forward and shareability

All context changes are written with React Router's `setSearchParams` using a
push (not replace), so the browser back/forward stack restores the previous
network/range. `DashboardLayout` preserves the query string when it syncs the
active tab to the URL, so switching views never drops the context.

## Compatibility & migration notes

- The context is additive. With no context params in the URL, behaviour is
  unchanged: the stored network preference is used and the default range is
  `24h`.
- No new dependencies or lockfile changes are required; the implementation uses
  `react-router-dom`, already a project dependency.
- Existing deep links such as `/account/:address?` and `/transactions/:hash?`
  keep working — the context params ride alongside the path params.
- Nothing secret belongs in these params. They are display state (network name,
  dates) only, and must never carry tokens or keys (see
  [ROUTING.md](./ROUTING.md#security-notes)).

## Testing

- `src/lib/context/__tests__/url-context.test.ts` covers the primary parse/serialise
  flow, boundary cases (`all`, equal custom bounds, epoch bounds, case-insensitive
  values) and failure cases (unknown network, invalid range, missing/unparseable
  or reversed custom bounds).
- `src/context/__tests__/DashboardContext.test.tsx` covers provider hydration,
  URL writes, back-navigation restoration, store synchronisation and safe
  fallbacks.

Run them with:

```bash
pnpm run test -- src/lib/context/__tests__/url-context.test.ts src/context/__tests__/DashboardContext.test.tsx
```
