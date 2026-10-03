# Contextual Empty States

Issue #876. A panel with no data should say why it is empty and point to the tool that helps next, instead of showing a blank box or a single grey sentence.

- **Component:** `src/components/common/ContextualEmptyState.tsx`
- **Presets and resolution logic:** `src/lib/emptyStates.ts` (no React imports, so it can be unit-tested on its own)
- **Tests:** `src/lib/tests/emptyStates.test.ts`, `src/components/common/__tests__/ContextualEmptyState.test.tsx`

---

## 1. Usage

```tsx
import ContextualEmptyState from '../common/ContextualEmptyState';

// Use a preset
{pools.length === 0 && <ContextualEmptyState context="noPools" compact />}

// Add an in-page action (e.g. switch a sub-tab) before the preset's route actions
<ContextualEmptyState
  context="noPools"
  description="Search for pools in the Discover tab to view performance metrics."
  extraActions={[{ label: 'Go to Discover', onSelect: () => setTab('discover') }]}
/>
```

Keep loading states separate. An empty state means "loaded, and there is nothing here". Don't render it while a request is still in flight.

### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `context` | `EmptyStateContext` | `'generic'` | Preset key. Unknown keys fall back to `generic`. |
| `title` | `string` | preset title | Overrides the heading. |
| `description` | `string` | preset description | Overrides the explanation. |
| `actions` | `EmptyStateAction[]` | preset actions | Replaces the preset's actions. |
| `extraActions` | `EmptyStateAction[]` | none | Placed before the preset/override actions. |
| `maxActions` | `number` | `3` | Upper limit on rendered actions. `0` or a negative number hides them all. |
| `expertiseLevel` | `'novice' \| 'intermediate' \| 'expert'` | none | Hides routes whose `minExpertise` is higher. |
| `compact` | `boolean` | `false` | Tighter padding for nested panels. |

### `EmptyStateAction`

| Field | Description |
| :--- | :--- |
| `label` | Button text. Actions with a blank label are dropped. |
| `routeId` | A route `id` from `src/routes/routes.ts`. Navigation goes through the store's `setActiveTab`, which updates the URL. |
| `onSelect` | In-page handler. When present it takes precedence over `routeId`. |
| `hint` | Secondary line and tooltip. |
| `networks` | Networks the action works on (e.g. the faucet is testnet/futurenet/local only). Omit for all networks. |

---

## 2. Presets

| Context | Used in | Suggested tools |
| :--- | :--- | :--- |
| `generic` | fallback | Overview, Search |
| `walletRequired` | Liquidity pools (position, history) | Wallet, Faucet *(testnet only)* |
| `noPools` | Liquidity pools (discover, performance) | DEX, Path Explorer, Assets |
| `noPoolSelected` | Liquidity pools (selected pool, manage) | none (pool list is next to it) or an in-page "Go to Discover" |
| `noPoolTrades` | Liquidity pools (performance) | DEX, Live Activity |
| `noLpPositions` | Liquidity pools (your position) | Builder, Account |
| `noLpHistory` | Liquidity pools (history) | Transactions |
| `noRelationships` | Relationship panel | Transactions, Compare |
| `noAddresses` | Relationship panel | Search |
| `noClusters` | Relationship panel | AI Patterns |

To add a preset, add an entry to `EMPTY_STATE_PRESETS`. The test suite checks that every preset action points at a registered route. If a route is renamed or removed, CI fails instead of the app showing a broken link.

---

## 3. Invalid input, unsupported environments and failures

Before rendering, `resolveEmptyStateActions` drops any action that:

1. has an unknown `routeId`, a blank label, or neither `routeId` nor `onSelect`;
2. is limited to other networks (for example, the faucet on mainnet);
3. points to a route hidden by `minExpertise` or a disabled `featureFlag`;
4. points to the view the user is already on;
5. repeats a target that's already in the list.

It then stops at `maxActions` (non-finite values fall back to the default of 3). Input that isn't an array resolves to an empty list.

If the candidate list wasn't empty but nothing survives filtering, the component shows a short fallback that points to the sidebar and search. A preset that has no actions by design, such as `noPoolSelected`, shows no fallback.

If an action throws, or if store navigation isn't available, the component catches the error and shows an inline `role="alert"` message. The rest of the view keeps working.

---

## 4. Accessibility

- The container has `role="status"`, so assistive tech announces it without taking focus.
- Actions sit in a list labelled "Suggested next steps". Each one is a native `<button>` you can reach with the keyboard.
- Action failures use `role="alert"`.

## 5. Compatibility and migration

- No new dependencies. Existing public APIs are unchanged.
- The local `EmptyState` helper in `RelationshipPanel.tsx` has been removed. The one in `LiquidityPools.tsx` is now used only for loading text.
- To migrate another view, swap its ad-hoc empty `<div>` for `<ContextualEmptyState context="...">` and add a preset if none fits.
- Security: actions only navigate to routes in the registry or call handlers you pass in. They never build URLs from user data.
