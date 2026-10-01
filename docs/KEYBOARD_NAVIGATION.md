# Keyboard Navigation Guide

This document describes keyboard navigation behavior across all dashboard routes, how to test it, and compatibility notes for developers.

> Dashboard views are declared in one typed registry. See [ROUTING.md](./ROUTING.md)
> for how routes drive the sidebar, command palette, document titles, and deep links.

## Overview

Every dashboard route must be fully operable without a pointer. Keyboard users rely on:

- Logical **Tab** order (skip link → sidebar → toolbar → main content)
- **Arrow keys** in the sidebar navigation list
- **Enter** / **Space** to activate buttons and links
- **Escape** to dismiss overlays and return focus to the trigger
- **Focus traps** inside modal dialogs (preferences, command palette, notifications)

## Skip link

The first focusable element on every page is **Skip to main content** (`.skip-link`). It moves focus to `#main-content`, which receives programmatic focus after route changes via `useRouteFocus`.

## Global shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + /` or `?` | Show keyboard shortcuts help |
| `G` then `D` | Go to Overview |
| `G` then `A` | Go to Account |
| `G` then `T` | Go to Transactions |
| `G` then `C` | Go to Contracts |
| `Escape` | Close open modals / overlays |

Shortcuts are suppressed while focus is inside text inputs unless noted otherwise.

## Command palette

Press `Ctrl + K` (Windows/Linux) or `⌘ K` (macOS) from anywhere in the dashboard to open the palette. Type to filter, use **Arrow Up / Arrow Down** to move, **Enter** to run, and **Escape** to close. Focus is trapped while it is open and returns to the previously focused element on close.

| Type… | Result |
|-------|--------|
| A page name (`contracts`, `network`) | **Navigation** — jump to any sidebar route |
| `settings`, `flags`, `theme`, `shortcuts` | **Settings** — Settings page, Feature Flags, AI Personalization, Security, User Preferences dialog, keyboard shortcuts help |
| A `G…` account address | **Jump to** — opens `/account/<address>` and adds it to Recent Accounts |
| A `C…` contract ID | **Jump to** — opens `/contracts/<contractId>` |
| Nothing | All commands, including Recent Accounts and Templates |

Implementation: the pure command model lives in `src/lib/commandPalette.ts` (`classifyPaletteQuery`, `buildPaletteCommands`, `getPaletteResults`, `resolveTargetPath`); the UI is `CommandPalette` in `src/components/accessibility/KeyboardNavigation.tsx`.

### Invalid input and failure handling

- Address-shaped input (`G`/`C` followed by base32 characters) is validated with `StrKey` before any navigation. A wrong length (`A Stellar account address is 56 characters; this one has 55.`) or a bad checksum shows a `role="alert"` message, sets `aria-invalid="true"` on the input, and **Enter** does nothing.
- Lowercase pastes and surrounding whitespace are accepted and normalised.
- Queries longer than 256 characters are rejected with a message rather than filtered.
- No matches shows a `role="status"` "No matching commands found" message.
- If a command throws, the palette stays open and shows `Couldn't run "<command>". Please try again.`; the error is logged to the console.

### Unsupported environments

- **Blocked or full `localStorage`** (private browsing, disabled site data, quota exceeded): Recent Accounts are simply omitted, and jumping to an account still navigates — remembering it is best-effort. Corrupted Recent Accounts or template records are skipped.
- **Unknown platform**: the footer hint falls back to `Ctrl+K`.
- **Touch-only devices** have no keyboard shortcut to open the palette; all destinations remain reachable through the sidebar / mobile drawer.

### Security notes

- The palette never fetches anything: pasted addresses are validated locally and only become a URL path segment via `buildPath`, which URI-encodes the value.
- Secret keys (`S…`) are not address-shaped for the palette and are treated as plain search text — they are never navigated to, stored, or sent anywhere. Avoid pasting secrets into any search field.

## Sidebar navigation

When the sidebar is visible:

- **Arrow Up / Arrow Down** — move between nav items
- **Home / End** — jump to first / last nav item
- **Enter** — activate the focused route

Implementation: `src/hooks/useSidebarArrowNav.ts`

## Route focus management

After navigating to a new tab or URL, focus moves to `#main-content` and a screen reader announcement is emitted. Implementation: `src/hooks/useRouteFocus.ts`

## Modal focus traps

Modals use `FocusManager` with `trapFocus` and `restoreFocusOnUnmount`:

- Command palette (`KeyboardNavigation.tsx`)
- Keyboard shortcuts help
- User preferences (`DashboardLayout.tsx`)

### Nested overlays (modals and drawers)

When overlays stack (a dialog opening inside a dialog, or a drawer above a
modal), Escape must close the **topmost** overlay first and Tab must never
leak into background content. Two tools support this (#874):

**Prevention — `useOverlayKeyboardGuard`** (`src/hooks/useOverlayKeyboardGuard.ts`):
registers each open overlay in a LIFO stack so Escape always reaches the
right layer, and wraps Tab within the overlay's focusables:

```tsx
import { useOverlayKeyboardGuard } from '../hooks/useOverlayKeyboardGuard';

const containerRef = useRef<HTMLDivElement>(null);
const guard = useOverlayKeyboardGuard({ onClose: () => setOpen(false), containerRef });

return (
  <div role="dialog" aria-modal="true" ref={containerRef} {...guard}>…</div>
);
```

Use it on every overlay in a stack — including nested ones — so the guard
knows the full layer order. While disabled (overlay closed) the hook is inert.

**Detection — `auditOverlayStacks`**: audits the live DOM for trap risks
(see below) so regressions surface in CI instead of at runtime.

## Audit utilities

`src/lib/keyboardNavigationAudit.ts` provides programmatic checks:

```ts
import {
  auditRouteKeyboardNavigation,
  auditOverlayStacks,
  DASHBOARD_ROUTES,
  isKeyboardNavigationSupported,
} from '../lib/keyboardNavigationAudit';

const env = isKeyboardNavigationSupported();
if (!env.supported) {
  console.warn(env.reason); // SSR / non-browser
}

const result = auditRouteKeyboardNavigation('overview', document);
console.log(result.passed, result.tabOrderIssues);
```

### Overlay stack audit (#874)

`auditOverlayStacks(root?)` reports every modal / drawer container from
outermost to innermost — nesting `depth`, the `stackPath` of ancestor
overlays, and a `trapRisk` rating — plus these issues:

| Code | Severity | Meaning |
| --- | --- | --- |
| `no-escape-control` | error | No close/cancel affordance; Escape is blocked |
| `no-focusable-content` | error | Focus can enter an empty overlay but cannot Tab anywhere |
| `background-not-inert` | warning | `aria-modal` is open while background content is still tabbable |
| `focus-restoration-unhinted` | warning | No `data-return-focus` marker, so focus restoration could not be verified |

Overlay containers are detected via `role="dialog"`, `role="alertdialog"`,
`aria-modal="true"`, `data-overlay="drawer"`, or `data-drawer`. Class names
are intentionally ignored — backdrops like `mobile-drawer-backdrop` are not
overlays. The route-level audit (`auditRouteKeyboardNavigation`) includes the
stack audit in its `overlayStack` field and fails the route when the stack
has errors.

```ts
const stack = auditOverlayStacks(document);
if (!stack.passed) {
  console.table(stack.entries.flatMap((e) => e.issues));
}
```

### Invalid input handling

- Empty or whitespace route names return `supported: false` with reason `"Route path is empty or invalid"`.
- `auditOverlayStacks` with a missing/invalid root returns `supported: false` with a descriptive reason instead of throwing.
- Connect form sets `aria-invalid="true"` and `role="alert"` on validation errors.

### Unsupported environments

When `document` or `window` is unavailable (SSR, unit tests without DOM), audit functions return empty results and `environmentSupported: false` rather than throwing. `useOverlayKeyboardGuard` is likewise inert without a DOM.

## Dashboard routes covered

All routes in `DASHBOARD_ROUTES` (`src/lib/keyboardNavigationAudit.ts`) must maintain keyboard operability, including:

`connect`, `overview`, `account`, `transactions`, `contracts`, `network`, `builder`, `settings`, and 30+ additional tabs registered in `DashboardLayout.tsx`.

## Testing

### Unit tests

```bash
npm test -- tests/unit/lib/keyboardNavigationAudit.test.ts
```

Covers focusable element discovery, tab-order issues, modal trap detection, nested overlay stack auditing (#874), invalid route input, and environment detection.

`src/hooks/__tests__/useOverlayKeyboardGuard.test.tsx` covers the guard hook: topmost-only Escape, LIFO ordering across nested overlays, Tab wrap-around, and disabled/inert behavior.

```bash
npm test -- tests/unit/lib/commandPalette.test.ts tests/unit/components/CommandPalette.test.tsx
```

Covers command palette query classification (valid/invalid/boundary lengths), command building with corrupted storage, result filtering, account/contract/settings jumps, keyboard selection, action failures, and blocked `localStorage`.

### End-to-end tests (Playwright)

```bash
npm run test:e2e -- tests/e2e/keyboard-navigation.spec.ts
```

| Test | Type | Description |
|------|------|-------------|
| Tab order → connect → sidebar nav | Primary | Full keyboard connect and route change |
| Skip link focus | Boundary | Skip link targets main landmark |
| Command palette | Boundary | Open/close via keyboard |
| Invalid address | Failure | Error alert + recovery without pointer |
| Preferences Escape | Failure | Focus restored to trigger button |
| Per-route focusable check | Boundary | Each core route has focusable controls |

## Security and compatibility notes

- Keyboard shortcuts intentionally avoid browser-reserved combos (`Ctrl+T`, `Ctrl+W`, etc.) — see `src/lib/keyboard/shortcuts.ts` `detectBrowserConflicts()`.
- Focus indicators use `:focus-visible` per WCAG 2.4.7 — see `src/styles/accessibility.css`.
- High-contrast mode preserves focus ring visibility — see `docs/HIGH_CONTRAST_THEME.md`.

## Migration notes

If you add a new dashboard tab:

1. Register it in `DashboardLayout.tsx` `TABS` and `Sidebar.tsx` `NAV_ITEMS`.
2. Add the route id to `DASHBOARD_ROUTES` in `keyboardNavigationAudit.ts`.
3. Ensure icon-only controls have `aria-label`.
4. Wrap any new modal in `FocusManager` with focus restore on close.
5. Add the route to `tests/e2e/keyboard-navigation.spec.ts` if it is user-facing.
6. Command palette entries are generated from the route registry automatically. If the new view is settings-like, add it to `SETTINGS_ROUTES` in `src/lib/commandPalette.ts` so it is listed under **Settings** instead of **Navigation**.

**Command palette migration (#877):** the palette's placeholder, label, and option markup changed — the input is now a `combobox` controlling a `listbox`. Tests that located the input by the old placeholder (`Search commands, pages, accounts...`) should use `getByRole('combobox')`. The dialog name (`Command palette`) and `Ctrl/Cmd + K` shortcut are unchanged.

## Related files

| File | Purpose |
|------|---------|
| `src/components/accessibility/SkipLink.tsx` | Skip-to-main link |
| `src/components/accessibility/KeyboardNavigation.tsx` | Command palette + shortcuts |
| `src/lib/commandPalette.ts` | Command palette commands, query validation, targets |
| `src/components/accessibility/FocusManager.tsx` | Modal focus trap |
| `src/hooks/useRouteFocus.ts` | Post-navigation focus |
| `src/hooks/useSidebarArrowNav.ts` | Sidebar arrow-key nav |
| `tests/e2e/keyboard-navigation.spec.ts` | Playwright keyboard tests |
| `docs/WCAG_22_AA_GUIDE.md` | WCAG 2.2 AA developer workflow compliance |
