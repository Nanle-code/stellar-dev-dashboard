---
id: roadmap
title: Roadmap
sidebar_label: Roadmap
description: Where Stellar Dev Dashboard is heading, the milestones on the way, and how issues map to them.
---

# Roadmap

This page shows where Stellar Dev Dashboard is heading and how open issues fit together. It is for contributors choosing what to work on and for anyone evaluating the project.

Work is grouped into three milestones. Each has **exit criteria**: a milestone is done when every criterion is met, not when a date passes. Each issue belongs to one milestone and one **theme**, so related work lands together instead of in pieces.

- **Board:** the [GitHub Project](https://github.com/Nanle-code/stellar-dev-dashboard/projects) has views by theme, by milestone and by status.
- **Milestones:** [GitHub milestones](https://github.com/Nanle-code/stellar-dev-dashboard/milestones) show open and closed issues for each release.
- **New here?** Start with the [starter-issue guide](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/community/issue-labels.md) and filter the board by `good first issue`.

## Milestones

The section below is generated from [`.github/roadmap.json`](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/.github/roadmap.json). Edit that file, then run `node scripts/roadmap.mjs --write-docs`. CI fails if this page and the JSON disagree.

{/* roadmap:milestones:start */}

### v0.2 — Solid foundation

Reliable CI, tests and contributor workflow so every later change lands safely.

**Themes:** Testing & CI, Community & Docs, Security

**Exit criteria**

- [ ] Every required CI workflow is green on master for 14 consecutive days.
- [ ] Unit, integration and Playwright critical-path suites run on every pull request.
- [ ] No open issues labelled bug or security are assigned to this milestone.
- [ ] Contributor guide, starter-issue guide and roadmap are published and linked from the README.

### v0.3 — Protocol-current

Track the current Stellar protocol, Soroban RPC and wallet ecosystem.

**Themes:** Soroban & Protocol, Wallets & Accounts

**Exit criteria**

- [ ] The dashboard reads and simulates against the current Soroban RPC and protocol version on testnet and mainnet.
- [ ] Freighter, Ledger and wallet-adapter flows have E2E coverage for success and rejection paths.
- [ ] Soroban simulation failures (auth, resource limits, archived state) are classified and explained in the UI.
- [ ] Deprecated Horizon endpoints have an RPC-first replacement or a documented migration.

### v1.0 — Production ready

Performance, accessibility, observability and security hardening for everyday production use.

**Themes:** AI & Analytics, Performance, Mobile & Accessibility

**Exit criteria**

- [ ] Lighthouse performance and accessibility budgets pass on desktop and mobile.
- [ ] WCAG 2.2 AA audit has no open blocking findings.
- [ ] An external or maintainer-led security review of wallet, auth and audit paths is complete.
- [ ] User documentation covers every top-level dashboard tab, with a published upgrade and support policy.

{/* roadmap:milestones:end */}

## How issues are assigned

New issues are triaged into a milestone using these rules, in order:

1. **Title tag.** An issue titled `[2026 Testing] …` gets the theme whose tag matches (`Testing` → *Testing & CI*).
2. **Labels.** Theme labels such as `documentation` or `security` pick the theme next.
3. **Keywords.** Otherwise the title and body are matched against each theme's keywords.
4. **Priority labels.** `bug` and `security` always pull an issue into **v0.2**, because broken or unsafe behaviour blocks everything else.
5. **Fallback.** Issues that match nothing go to **v1.0** and are flagged for a maintainer to review.

A maintainer can always move an issue by hand. Triage never overrides a milestone that is already set to a roadmap milestone.

## Compatibility and security notes

- The roadmap describes intent, not a release date or support commitment. Milestones can be re-scoped; changes go through a pull request to `.github/roadmap.json`, so they show up in history.
- Security fixes are never held back for a milestone. Report vulnerabilities privately as described in [SECURITY.md](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/SECURITY.md).
- Moving an issue between milestones does not change its labels, assignee or linked pull requests.

## Proposing changes

Open an issue titled `[Roadmap] …` describing the change and which exit criteria it affects. Maintainers review roadmap changes in the regular triage pass described in the [triage guide](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/community/roadmap-triage.md).
