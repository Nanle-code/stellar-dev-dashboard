# WCAG 2.2 AA Conformance Guide for Primary Developer Workflows

This guide outlines accessibility conformance, architecture patterns, and developer guidelines for the primary developer workflows in the Stellar Developer Dashboard: **Account**, **Transactions**, and **Contracts**.

---

## 1. Conformance Overview

The primary developer workflows meet the **Web Content Accessibility Guidelines (WCAG) 2.2 Level AA** standard. This builds upon WCAG 2.1 AA by introducing strict compliance for focus obscuration, target size minimums, accessible authentication, and resilient error recovery.

### Primary Developer Workflows Covered

| Workflow | Route | Primary Responsibilities |
| :--- | :--- | :--- |
| **Account Overview & Lookup** | `/account` | Account balances, identity, signers, reserve breakdowns, thresholds, offers, and claimable balances. |
| **Transactions & Operations** | `/transactions` | Real-time transaction history, operations stream, priority queue, filtering, and export. |
| **Soroban Contracts** | `/contracts` | Contract inspection, invocation simulation, typed argument construction, deployment planning, and execution. |

---

## 2. Key WCAG 2.2 Criteria & Implementation

### 2.1 Focus Not Obscured (Minimum) — SC 2.4.11 (Level AA)

When navigating via keyboard or assistive technology, focused elements must not be obscured by sticky headers, docked toolbars, or floating navigation bars.

- **Implementation**: `src/styles/accessibility.css`
- **Behavior**: All interactive elements with `:focus-visible` enforce `scroll-margin-top: 80px` and `scroll-margin-bottom: 80px`.
- **Developer Rule**: Do not override `:focus-visible` scroll margins on inputs, buttons, or custom widgets.

```css
:focus-visible {
  scroll-margin-top: 80px;
  scroll-margin-bottom: 80px;
}
```

### 2.2 Target Size (Minimum) — SC 2.5.8 (Level AA)

Pointer targets must have an area of at least 24 by 24 CSS pixels, except when inline in a sentence or spaced appropriately.

- **Implementation**:
  - Global interactive target enforcement in `src/styles/accessibility.css`:
    ```css
    button,
    [role="button"],
    [role="tab"],
    input[type="checkbox"],
    input[type="radio"],
    .btn {
      min-inline-size: 24px;
      min-block-size: 24px;
    }
    ```
  - Standard action buttons in Account, Transactions, and Contracts views default to `minHeight: '36px'` and `minWidth: '44px'`, exceeding requirements.
  - Micro-actions (copy buttons, external explorer links, badges) guarantee at least 24x24 px bounding boxes with touch-target padding.

### 2.3 Accessible Authentication — SC 3.3.8 (Level AA)

Cognitive function tests (such as remembering complex strings, transcription, or solving puzzles) must not be required for authentication or signing.

- **Implementation**:
  - The Soroban contract invocation secret key input supports full copy, paste, and password manager autofill.
  - Clipboard paste events are never intercepted, blocked, or prevented.
  - CSS explicitly sets `user-select: text` on all password and secret inputs:
    ```css
    input[type="password"],
    input[autocomplete*="password"],
    input[name*="secret"] {
      user-select: text !important;
      -webkit-user-select: text !important;
    }
    ```

### 2.4 Error Identification & Association — SC 3.3.1 & SC 3.3.2 (Level A / AA)

When an input error is detected, the error item is identified and described in text with programmatic linkage.

- **Account Lookup**:
  - Input: `<input id="account-address-input" aria-invalid="true" aria-describedby="account-lookup-error" />`
  - Error: `<div id="account-lookup-error" role="alert">Enter a valid 56-character Stellar public address (G...)</div>`
- **Contract Inspection**:
  - Input: `<input id="inspect-contract-input" aria-invalid="true" aria-describedby="contract-inspect-error" />`
  - Error: `<div id="contract-inspect-error" role="alert">Enter a valid 56-character C-prefixed Soroban address</div>`
- **Contract Invocation Arguments**:
  - Typed parameters with anomalies display an inline `role="alert"` message with severity indicators (`error` vs `warning`).

### 2.5 Redundant Entry — SC 3.3.7 (Level A)

Information previously entered by or provided to the user is either auto-populated or available for the user to select.

- Connected account public keys automatically pre-populate the Source Account field.
- Suggested argument values from Soroban WASM specs can be auto-filled with a single accessible button ("Autofill AI Suggestions").

---

## 3. Unsupported Environments & Resilience

### 3.1 Offline & RPC Unreachable States

When network connectivity is lost or Soroban RPC endpoints return transport errors:
- Offline detection hooks (`navigator.onLine` and `online`/`offline` window events) render an accessible status banner:
  ```html
  <div role="status" aria-live="polite">
    Offline Mode: Soroban RPC endpoints are unreachable. Contract inspection, simulation, and submission require an active network connection.
  </div>
  ```
- Submissions and simulations are cleanly disabled with accessible disabled styling and descriptive aria labels rather than throwing unhandled exceptions.

### 3.2 Non-Browser / SSR Execution

The audit utility `auditWcag22Workflow` in `src/lib/accessibilityAudit.ts` provides clean environment fallbacks:
- If `window` or `document` is missing, it returns:
  ```ts
  {
    workflow: 'account',
    environmentSupported: false,
    unsupportedReason: 'DOM environment is unavailable (SSR or non-browser execution)',
    passed: true,
    issues: [],
    checkedCount: 0
  }
  ```

---

## 4. Developer Guidance & Migration Notes

### 4.1 Running the Programmatic Workflow Audit

Developers can audit any route or container element programmatically:

```ts
import { auditWcag22Workflow } from '../lib/accessibilityAudit';

// Audit the contract workflow
const report = auditWcag22Workflow('contracts', document.getElementById('contract-root'));

if (!report.passed) {
  console.error('WCAG 2.2 violations detected:', report.issues);
}
```

### 4.2 Automated Test Coverage

The repository maintains automated test coverage across unit and end-to-end layers:

- **Unit tests**: `tests/unit/wcag22Workflows.test.ts`
  - Primary flows: Account, Transactions, and Contracts DOM validation.
  - Boundary cases: Exact 24x24px target size threshold (SC 2.5.8), password paste check (SC 3.3.8).
  - Failure cases: Missing `aria-describedby` error associations (SC 3.3.1), invalid workflow input, unsupported SSR environment.
- **E2E CI Gate**: `tests/e2e/a11y-gate.spec.ts` & `tests/e2e/accessibility.spec.ts`
  - Automated Axe-core scanning with tags: `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']`.

### 4.3 Checklist for Adding New Workflow Features

1. **Semantic HTML**: Use native `<button>`, `<input>`, `<select>`, and `<h1>`/`<h2>` headings.
2. **Explicit Labeling**: Every input must have an associated `<label htmlFor="id">` or visible label.
3. **Target Sizes**: Buttons and touchable icons must be at least 24x24 px (recommended 36x36 px or larger).
4. **Accessible Forms**: Ensure inputs with validation states set `aria-invalid="true"` and `aria-describedby="[error-id]"` pointing to a container with `role="alert"`.
5. **No Paste Blocking**: Never intercept `onPaste` or disable `user-select` on credential/secret inputs.

---

## 5. Related Documentation

- [Keyboard Navigation Guide](./KEYBOARD_NAVIGATION.md) — Comprehensive guide on tab sequence, focus traps, and shortcuts.
- [High Contrast Theme](./HIGH_CONTRAST_THEME.md) — Color contrast and theme tokens.
- [Design System](./design-system.md) — Color palette, typography, and button specifications.
