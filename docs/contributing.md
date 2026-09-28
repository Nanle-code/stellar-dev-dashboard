# Contributing to Stellar Dev Dashboard

Thank you for taking the time to contribute! This guide covers everything you need to get started.

## Table of Contents

1. [Development setup](#development-setup)
2. [Project structure](#project-structure)
3. [Coding conventions](#coding-conventions)
4. [Testing](#testing)
5. [Pull request workflow](#pull-request-workflow)
6. [Merge requirements](#merge-requirements)
7. [Code owners](#code-owners)
8. [Issue labels](#issue-labels)

---

## Development Setup

### Prerequisites

- Node.js 22–26 (enforced by `npm run check:node`; CI tests 22, 24 and 26)
- pnpm ≥ 9 (the version CI uses is pinned in `package.json` → `packageManager`)

### Install & run

```bash
git clone https://github.com/Nanle-code/stellar-dev-dashboard.git
cd stellar-dev-dashboard
pnpm install
pnpm run dev         # Vite dev server at http://localhost:5173
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

### Async data loading

Any read that depends on the selected account or network must be cancellable, so a slow
response cannot overwrite state after the user switches. Use a lease from
`accountRequests` instead of an ad-hoc `isActive` flag — see the
[Request Cancellation Guide](./REQUEST_CANCELLATION.md).

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
- See [Keyboard Navigation Guide](./KEYBOARD_NAVIGATION.md) for route focus, skip links, modal traps, and test requirements.

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
3. Run the checks CI will run: `pnpm run lint && pnpm run type-check && pnpm test && pnpm run governance:check`.
   Add `pnpm run test:e2e` when you change UI flows.
4. Open a PR targeting `master`. The [PR template](../.github/pull_request_template.md) is filled in
   automatically. Complete every section, and include:
   - A clear title referencing the issue (`fix: add export panel (#114)`).
   - A summary of **what** changed and **why**.
   - `Closes #<issue-number>` for each resolved issue.
5. Before you ask for a merge, make sure the PR meets the [merge requirements](#merge-requirements).
6. Respond to review comments within a week; otherwise the PR may be closed.

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

## Merge Requirements

A pull request can be merged only when **both** of these hold for its latest commit:

1. **All required continuous integration checks must pass.** Failing, pending, or skipped
   required checks are not acceptable for merge. Green checks on an earlier commit do not count.
2. **The branch must be free of merge conflicts with the target branch** (`master`) at the time of merge.

Do not request a merge, or re-request review, while any workflow is failing, any required
check is skipped, or conflicts are unresolved. Maintainers will not merge such a PR, even
when the change looks correct.

### Required checks

These jobs must succeed:

| Workflow | Job |
|----------|-----|
| CI | Lint & Format Check |
| CI | TypeScript Type Check |
| CI | Unit & Integration Tests (Node 22, 24, 26) |
| CI | E2E Tests |
| CI | Build |
| CI | Bundle Size Budget |
| Governance | Governance Policy |

Other workflows (visual regression, accessibility, Lighthouse, dependency checks) are
advisory unless branch protection marks them as required. If one of them fails because
of your change, fix it anyway.

### Handling each situation

| Situation | What to do |
|-----------|------------|
| A check **fails** | Open the job log, reproduce locally with the matching `pnpm run …` script, and push a fix. |
| A check is **flaky** (it passes on re-run with no code change) | Re-run it once and mention the flake in a PR comment so it can be tracked. Don't re-run repeatedly until it passes. |
| A check is **pending** | Wait. A PR from a first-time contributor's fork needs a maintainer to approve the workflow run; ask in a comment. Pending is not mergeable. |
| A required check is **skipped** | Treated as not passing. A path filter or `if:` condition may have skipped it; ask a maintainer to run the workflow manually (`workflow_dispatch`) rather than merging. |
| **Merge conflicts** | Update your branch from the target and resolve locally (see below), then re-run the checks. Don't resolve conflicts in the GitHub web editor for lockfiles. |
| `skip-bundle-check` label | Maintainers only, and only with a written reason in the PR. It bypasses the bundle budget step; it does **not** make other failing checks acceptable. |

### Resolving conflicts

```bash
git fetch origin
git rebase origin/master          # or: git merge origin/master
# fix conflicts, then
git add <files> && git rebase --continue
pnpm install --frozen-lockfile    # if pnpm-lock.yaml changed
git push --force-with-lease       # only needed after a rebase
```

If `pnpm-lock.yaml` conflicts, don't hand-edit it. Take the target branch's version
(`git checkout --theirs pnpm-lock.yaml` during a rebase), then run `pnpm install` to
regenerate it from your `package.json`.

### Maintainer settings

The policy is enforced through branch protection on `master`, not by the PR template alone.
Keep these enabled:

- **Require status checks to pass before merging**, listing the jobs in the table above.
- **Require branches to be up to date before merging**, so conflicts and stale checks are caught.
- **Require review from Code Owners** (see [Code owners](#code-owners)).
- **Do not allow bypassing the above settings**, for administrators too.

GitHub matches required checks by **job name**. If you rename a job in a workflow, update
branch protection in the same PR. Otherwise the old name stays "Expected — waiting for
status" and blocks every PR.

---

## Code Owners

[`.github/CODEOWNERS`](../.github/CODEOWNERS) assigns designated reviewers to
security-sensitive paths:

- **wallet** connectors, signing, and session handling (`src/lib/wallet/`, `WalletConnect.tsx`, multisig)
- **authentication**, identity, and access control (biometrics, DID auth, `src/accessControl/`)
- **cryptography** and trust boundaries (`encryption.ts`, endpoint allowlist, phishing detection)
- **security policy and pipeline integrity** (`SECURITY.md`, `nginx.conf` CSP headers, `.github/workflows/`)

GitHub requests a code-owner review automatically when a PR touches these paths, and the
PR cannot merge without that approval.

`pnpm run governance:check` fails CI when a security-sensitive file has no owner. It
checks the path list in `scripts/validate-governance.mjs` → `SECURITY_SENSITIVE_PATHS`
against every tracked file. It also fails when:

- a later CODEOWNERS rule has no owner, which silently removes ownership;
- an owner handle is malformed;
- a pattern uses syntax GitHub ignores (`!negation`, `[ranges]`).

If you add a wallet, auth, or crypto module outside the directories already listed, add it
to **both** CODEOWNERS and `SECURITY_SENSITIVE_PATHS`. CODEOWNERS applies the **last**
matching rule, so put narrow overrides below broad ones.

Compatibility note: CODEOWNERS entries must be users or teams with **write** access to the
repository. Otherwise GitHub ignores them silently. The validator checks handle syntax only.
It can't check permissions, so verify new owners on the repository's CODEOWNERS page on
GitHub, which flags invalid entries.

---

## Issue Labels

Every issue that is open for contribution has exactly one difficulty label:
`difficulty: beginner`, `difficulty: intermediate` or `difficulty: advanced`.
`good first issue` is reserved for beginner issues that meet the starter checklist:

- single testable outcome
- no security-sensitive paths
- runs locally with no special setup
- a named mentor

See the [Issue labels and starter issues guide](./community/issue-labels.md) for:

- the full label set;
- how to claim an issue;
- how maintainers change labels. The source of truth is `.github/labels.json`.

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

