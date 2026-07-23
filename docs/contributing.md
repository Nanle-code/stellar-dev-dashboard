# Contributing to Stellar Dev Dashboard

Thank you for taking the time to contribute! This guide covers everything you need to get started.

## Table of Contents

1. [Development setup](#development-setup)
2. [Project structure](#project-structure)
3. [Coding conventions](#coding-conventions)
4. [Testing](#testing)
5. [Pull request workflow](#pull-request-workflow)
6. [Issue labels](#issue-labels)

---

## Development Setup

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & run

```bash
git clone https://github.com/Nanle-code/stellar-dev-dashboard.git
cd stellar-dev-dashboard
npm install
npm run dev          # Vite dev server at http://localhost:5173
```

### Environment

No `.env` file is required for local development. The app defaults to the Stellar testnet (`https://horizon-testnet.stellar.org`). You can switch networks from the sidebar.

---

## Project Structure

```
src/
├── components/
│   ├── dashboard/    # Feature panels (Account, Builder, DEXExplorer, …)
│   ├── layout/       # Sidebar, MobileSidebar, DashboardGrid, …
│   ├── charts/       # Recharts wrappers
│   ├── assets/       # Asset discovery and display
│   └── accessibility/ # Screen-reader announcer, keyboard nav
├── hooks/            # Custom React hooks
├── lib/              # Non-UI modules (stellar.js, store.js, transactionBuilder.js, …)
├── utils/            # Pure utility functions (export.js, transactionValidation.ts, …)
├── styles/           # globals.css, themes.js, accessibility.css
└── i18n/             # Translation JSON files (en, es, zh)
docs/
├── api/              # API module reference (stellar.md, storage.md, …)
├── components.md     # Component catalogue
└── contributing.md   # This file
```

---

## Coding Conventions

### JavaScript / JSX

- Use **ES modules** (`import`/`export`). No CommonJS `require()`.
- All React components are functional; no class components.
- Styling is done with inline `style` props using CSS custom properties from `globals.css`. Avoid third-party CSS-in-JS.
- Use `"` for JSX string attributes and `'` for JS string literals.
- Export components as **default exports**; export utilities as **named exports**.

### TypeScript

New utility/lib files that contain pure business logic should be `.ts`. React components remain `.jsx`. Shared type declarations go in the same file or a co-located `.d.ts`.

### Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Component file | PascalCase | `DataExport.jsx` |
| Hook file | camelCase, `use` prefix | `useDataExport.js` |
| Lib/util file | camelCase | `transactionBuilder.js` |
| CSS class | kebab-case | `.mobile-only` |
| Zustand store key | camelCase | `isMobileMenuOpen` |

### Accessibility

- All interactive elements must be reachable by keyboard.
- Use semantic HTML (`<nav>`, `<ul>`, `<button>`) over generic `<div>` + `onClick`.
- Add `aria-label` to icon-only buttons.
- Announce dynamic changes via `<ScreenReaderAnnouncer>` where appropriate.

---

## Testing

### Unit tests (Vitest + Testing Library)

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with v8 coverage
```

Test files live alongside the source they cover: `src/utils/export.test.js` tests `src/utils/export.js`.

New utility functions **must** have unit tests. New React components **should** have at least a smoke-render test.

### End-to-end tests (Playwright)

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # Playwright UI mode
```

E2E tests live in `tests/e2e/`. They rely on Playwright's network route interception (`page.route()`) to mock responses from Horizon and Soroban RPC. This guarantees fast, deterministic tests without needing valid testnet credentials or environment variables.

---

## Pull Request Workflow

1. **Fork** the repository and create a branch from `master`:
   ```bash
   git checkout -b fix/your-description
   ```
2. Make your changes, keeping each commit focused on one logical change.
3. Run tests: `npm test && npm run test:e2e`.
4. Open a PR targeting `master`. Include:
   - A clear title referencing the issue (`fix: add export panel (#114)`).
   - A summary of **what** changed and **why**.
   - `Closes #<issue-number>` for each resolved issue.
5. Respond to review comments within a week; otherwise the PR may be closed.

### Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add path-payment support to transaction builder
fix: restore focus after wallet modal closes
docs: add component reference for DataExport
refactor: extract flattenTransaction to export utils
test: add validation tests for bumpSequence op
```

---

## Issue Labels

| Label | Meaning |
|-------|---------|
| `Stellar Wave` | Active sprint / batch of issues |
| `good first issue` | Straightforward, well-scoped |
| `help wanted` | Extra attention needed |
| `bug` | Something is broken |
| `enhancement` | New feature or improvement |
| `documentation` | Docs-only change |

---

## Accessibility (WCAG) Checklist

All pull requests that touch interactive UI components must satisfy the following checklist before merge:

- [ ] All interactive elements reachable by Tab key
- [ ] Focus indicator visible on all focusable elements
- [ ] All buttons have accessible names (text or aria-label)
- [ ] All form inputs have associated labels
- [ ] Color contrast ratio >= 4.5:1 for normal text
- [ ] No keyboard traps (except intentional modal focus traps)
- [ ] Screen reader announces dynamic state changes (connect, errors, loading)
- [ ] Icons used as buttons have aria-label, not just title
- [ ] ARIA live regions present for async feedback
- [ ] Page has a logical heading hierarchy (h1 → h2 → h3)

