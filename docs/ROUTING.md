# Routing & Navigation Registry

This document describes how dashboard navigation works, how to add or change a
view, and the compatibility, security, and migration notes that go with the
typed route registry (#959).

## Overview

`src/routes/routes.ts` is the **single source of truth** for dashboard
navigation. Every view declares its metadata once, and the rest of the app
derives from it:

| Consumer | Derived from |
|----------|--------------|
| Sidebar sections & links | `getNavGroups()` / `getNavRoutes()` |
| Mobile drawer | `getMobileNavRoutes()` |
| Command palette | `getNavRoutes()` (via `buildPath`) |
| Lazy view component | `route.loader` (via `routeComponents.ts`) |
| Document title | `getDocumentTitle(route)` |
| Deep links & params | `buildPath(id, params)` / `matchRoute(pathname)` |
| Keyboard audit list | `ROUTES` (see [KEYBOARD_NAVIGATION.md](./KEYBOARD_NAVIGATION.md)) |

`routes.ts` deliberately has **no React or React-Router runtime imports**, so it
can be consumed by pure logic and tests without pulling UI code into the graph.
`src/routes/routeComponents.ts` owns the `React.lazy` cache.

## Registry shape

Each entry in `ROUTES` is an `AppRoute`:

```ts
{
  id: string;          // stable id; also the legacy `activeTab` value
  path: string;        // URL template, e.g. '/account/:address?'
  title: string;       // sidebar label + document title
  icon: string;        // emoji / glyph
  group: RouteGroup;   // sidebar grouping
  loader: RouteLoader; // () => import('...') returning { default: Component }
  minExpertise?: 'novice' | 'intermediate' | 'expert';
  featureFlag?: string;
  nav?: boolean;       // false = routed but hidden from the sidebar
  param?: RouteParam;  // entity deep-link parameter
  aliases?: string[];  // extra paths, e.g. '/' for overview
}
```

## Adding a new view

1. Add one entry to `ROUTES` in `src/routes/routes.ts` with `id`, `path`,
   `title`, `icon`, `group`, and a `loader`.
2. Export the component as a **default** export (or use the `namedLoader`
   helper for named exports).
3. Run `pnpm run test` — the registry integrity tests fail if metadata is
   missing, ids/paths collide, or a generated path does not resolve back to its
   route.
4. No sidebar, command-palette, or title changes are required; they all read
   from the registry.

Routes with `nav: false` are reachable by URL and the command palette exclusion
rules, but are hidden from the sidebar (used for detail/system views).

## Entity deep links

Entity views use optional path params so a view is both linkable and usable
without one:

| Route | Path | Param binding |
|-------|------|---------------|
| Account | `/account/:address?` | `connectedAddress` |
| Transactions | `/transactions/:hash?` | `selectedTxHash` |
| Contracts | `/contracts/:contractId?` | `contractId` |

When a URL contains a bound param, `DashboardLayout` writes the decoded value
into the Zustand store, so refreshing or sharing the link restores the same
view. `buildPath('account', { address })` generates the forward link.

## Global context (network & time range) (#987)

Alongside path params, the dashboard keeps a global **network + time-range**
context in the query string:

```
?network=mainnet&range=7d
?network=testnet&range=custom&from=2026-09-01&to=2026-09-14
```

- Parsing/serialisation is pure and React-free in
  `src/lib/context/url-context.ts`; the React binding lives in
  `src/context/DashboardContext.tsx` (`DashboardProvider` /
  `useDashboardContext`).
- The URL is canonical. Invalid values degrade to defaults and surface an inline
  message; the parser never throws. See
  [CONTEXT_BAR.md](./CONTEXT_BAR.md) for the full contract.
- Network changes are mirrored into the Zustand store, so all existing views
  that read `store.network` follow the context without changes.
- The context is written with `setSearchParams` (push), so back/forward restores
  it. `DashboardLayout` appends `location.search` when it syncs the active tab,
  so view changes never drop the context.

## Not found (404)

`matchRoute(pathname)` returns `null` for unknown paths rather than silently
falling back to Overview. `DashboardLayout` renders the dedicated
`NotFound` view and sets the document title to `Page not found ·
Stellar Dev Dashboard`. The `matchRoute` fallback for malformed percent-encoding
returns the raw segment instead of throwing, so a bad link can never crash the
router.

## Compatibility & migration

The registry replaces two previously independent, drift-prone sources:

- the `TABS` record in `DashboardLayout.tsx`
- the `NAV_ITEMS` arrays in `Sidebar.tsx` / `MobileSidebar.tsx`

Both are gone. Compatibility is preserved for callers that still use the legacy
`activeTab` string: `route.id` **is** the old tab id, and `setActiveTab(id)`
still works — `DashboardLayout` translates store changes back into URL
navigation.

Migration notes:

- Add new views to `ROUTES` only; do not re-introduce a parallel nav list.
- `minExpertise` and `featureFlag` are surfaced through `isRouteVisible()`;
  routes without them are always visible, so existing sidebars are unchanged.
- The mobile drawer keeps a curated subset (`MOBILE_NAV_IDS`) for small screens,
  but titles/icons/paths are still resolved from the registry.

## Security notes

- Path params are percent-decoded with a guarded `decodeURIComponent`; malformed
  input is passed through untouched instead of throwing.
- Only opaque identifiers (addresses, hashes, contract ids) belong in paths.
  Never put secrets, tokens, or API keys in a URL — they leak via history,
  referrers, and logs.
- Connection gating still applies: unknown paths and entity links without a
  bound account redirect to `/connect` when no account is connected.

## Testing

- `tests/unit/routes/routes.test.ts` covers the primary flow (every route
  resolves from its generated path), boundary cases (optional params, trailing
  slashes, query strings, encoded/malformed params, auth gating), and failure
  cases (unknown paths → 404, unknown ids → `null`/`undefined`).
- `src/lib/context/__tests__/url-context.test.ts` and
  `src/context/__tests__/DashboardContext.test.tsx` cover the global context
  (#987): URL parsing/serialisation, back/forward restoration, and safe
  fallbacks for unknown networks and invalid ranges.
- Run the focused suite with `pnpm run test` (Vitest).
