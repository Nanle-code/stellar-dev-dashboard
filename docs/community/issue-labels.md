# Issue Labels and Starter Issues

This guide explains how issues in Stellar Dev Dashboard are labelled by difficulty. It also sets the bar an issue must meet before it is tagged `good first issue`. It is written for contributors choosing what to work on and for maintainers triaging issues.

The label set is defined in [`.github/labels.json`](../../.github/labels.json). That file is the source of truth, and the **Governance** workflow syncs it to GitHub when it changes on `master`. Don't create or recolour labels by hand in the GitHub UI, because the next sync will overwrite the change.

## Difficulty labels

Every issue that is open for contribution carries **exactly one** `difficulty:` label.

| Label | Typical scope | Knowledge needed | Rough effort |
|-------|---------------|------------------|--------------|
| `difficulty: beginner` | One module, ≤ 3 files, no API or design decisions | JavaScript/TypeScript and React basics | 1–4 hours |
| `difficulty: intermediate` | Several modules, new tests, maybe a new hook or store field | Familiarity with Horizon/Soroban RPC responses and the store | 1–3 days |
| `difficulty: advanced` | Cross-cutting design, performance, protocol, or security-sensitive paths | Stellar protocol, wallets/signing, or CI internals | Multi-day, usually with a design note |

When the scope is unclear, choose the **higher** difficulty. Relabelling an issue downward after a contributor finds it easier costs nothing. A newcomer stuck on an under-labelled issue is a bad first experience.

## `good first issue` standards

`good first issue` is a promise to newcomers. Apply it only when **all** of the following hold:

1. **Labelled `difficulty: beginner`.** An issue can't be a starter issue at a higher difficulty.
2. **Single, testable outcome.** The acceptance criteria name the exact behaviour and the test that proves it.
3. **Entry points linked.** The issue links the files or docs to start from.
4. **No security-sensitive paths.** It does not touch anything owned in [`.github/CODEOWNERS`](../../.github/CODEOWNERS): wallet, auth, cryptography, or CI workflows. Those issues get the `security` label instead.
5. **Runs locally with no special setup.** No mainnet funds, secrets, API keys, or hardware wallets. Testnet and the built-in mocks are enough.
6. **A named mentor.** A maintainer has agreed to answer questions and review the PR.

Maintainers can open a starter issue with the **Starter issue** form (`.github/ISSUE_TEMPLATE/starter-issue.yml`). The form applies `good first issue` and `difficulty: beginner` and requires the checklist above.

### When an issue stops qualifying

If work on an issue reveals a design question or a security-sensitive change, a maintainer:

- removes `good first issue`,
- raises the `difficulty:` label,
- leaves a comment explaining why, so the contributor is not left guessing.

The contributor may keep the issue if they want to.

## Other labels

| Label | Meaning |
|-------|---------|
| `help wanted` | Maintainers welcome an outside contributor. It can be combined with any difficulty. |
| `security` | Touches wallet, auth, or crypto paths. A code owner must review, and it is never a starter issue. Report vulnerabilities privately; see [SECURITY.md](../../SECURITY.md). |
| `bug` / `enhancement` / `documentation` | Type of change. |
| `Stellar Wave` | Part of the current sprint batch. |
| `skip-bundle-check` | CI escape hatch for the bundle size budget. The PR must say why it is needed. Maintainers only. |
| `generate-bundle-report` | Uploads the bundle visualizer report as a CI artifact. |

## Claiming an issue

- Comment on the issue before you start, and wait for a maintainer to assign you. Unassigned PRs for starter issues may be closed so that the issue stays available to the person it was reserved for.
- For a starter issue, open a PR within **7 days** of being assigned, or say you need more time. Silent assignments are released after that.
- Hold only **one** open `good first issue` assignment at a time. After your first merged PR, move on to `difficulty: intermediate`.

## Changing the label set (maintainers)

1. Edit `.github/labels.json`. Each entry needs a `name` (≤ 50 characters), a 6-digit hex `color` without `#`, and a `description` (≤ 100 characters, GitHub's limit).
2. Run `pnpm run governance:check`. The check fails on duplicate names (case-insensitive), invalid colours, missing descriptions, or a required label that was removed. It also fails when an issue form applies a label that is not in the file.
3. After merge, the Governance workflow creates or updates the labels on GitHub. **The sync never deletes labels.** Delete a retired label by hand, after removing it from `labels.json` and from any issue forms.

Renaming a label through `labels.json` creates a **new** label; it does not rename the old one. To keep existing issues attached, rename the label in the GitHub UI first, then update `labels.json` to match.
