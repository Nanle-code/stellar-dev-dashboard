# Keyboard Navigation Guide

This document describes keyboard navigation behavior across all dashboard routes, how to test it, and compatibility notes for developers.

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

- Command palette (`KeyboardNavigation.jsx`)
- Keyboard shortcuts help
- User preferences (`DashboardLayout.tsx`)

## Audit utilities

`src/lib/keyboardNavigationAudit.ts` provides programmatic checks:

```ts
import {
  auditRouteKeyboardNavigation,
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

### Invalid input handling

- Empty or whitespace route names return `supported: false` with reason `"Route path is empty or invalid"`.
- Connect form sets `aria-invalid="true"` and `role="alert"` on validation errors.

### Unsupported environments

When `document` or `window` is unavailable (SSR, unit tests without DOM), audit functions return empty results and `environmentSupported: false` rather than throwing.

## Dashboard routes covered

All routes in `DASHBOARD_ROUTES` (`src/lib/keyboardNavigationAudit.ts`) must maintain keyboard operability, including:

`connect`, `overview`, `account`, `transactions`, `contracts`, `network`, `builder`, `settings`, and 30+ additional tabs registered in `DashboardLayout.tsx`.

## Testing

### Unit tests

```bash
npm test -- tests/unit/lib/keyboardNavigationAudit.test.ts
```

Covers focusable element discovery, tab-order issues, modal trap detection, invalid route input, and environment detection.

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

## Related files

| File | Purpose |
|------|---------|
| `src/components/accessibility/SkipLink.tsx` | Skip-to-main link |
| `src/components/accessibility/KeyboardNavigation.jsx` | Command palette + shortcuts |
| `src/components/accessibility/FocusManager.tsx` | Modal focus trap |
| `src/hooks/useRouteFocus.ts` | Post-navigation focus |
| `src/hooks/useSidebarArrowNav.ts` | Sidebar arrow-key nav |
| `tests/e2e/keyboard-navigation.spec.ts` | Playwright keyboard tests |
