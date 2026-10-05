# Roadmap Triage and Project Board Maintenance

This guide is for maintainers. It explains how to keep the public roadmap, GitHub milestones and the GitHub Project board in step, and how to triage new issues into milestones. Contributors can read the roadmap itself on the docs site (`docs-site/docs/roadmap.md`).

## Source of truth

[`.github/roadmap.json`](../../.github/roadmap.json) defines:

- **milestones**: id (`v0.2`), GitHub title, summary and exit criteria;
- **themes**: the groups shown on the Project board, each mapped to a default milestone and matched by title tag, label or keyword;
- **priorityLabels**: labels that always pull an issue into an earlier milestone (`bug`, `security` → `v0.2`);
- **project**: the board title, repository and required views.

`scripts/roadmap.mjs` reads this file. It has no dependencies, so it runs without `pnpm install`.

| Command | What it does | Writes to GitHub? |
|---------|--------------|-------------------|
| `pnpm run roadmap:check` | Validates `roadmap.json` and fails if the docs-site page is out of date. Runs in the Governance workflow. | No |
| `node scripts/roadmap.mjs --write-docs` | Regenerates the milestone section of `docs-site/docs/roadmap.md`. | No |
| `pnpm run roadmap:plan` | Lists every open issue with the milestone and theme it would get. | No (reads issues) |
| `node scripts/roadmap.mjs --apply` | Creates missing milestones, then assigns every issue that has no milestone. | **Yes** |

`--plan` and `--apply` need the [GitHub CLI](https://cli.github.com/) logged in as a maintainer (`gh auth login`). Without `gh` the script exits with code `2` and changes nothing.

## Weekly triage pass

1. Run `pnpm run roadmap:plan` and read the output.
2. Check the **To assign** list. If a suggestion is wrong, fix it at the source: add a keyword, title tag or label to the theme in `roadmap.json`. Don't just move the issue by hand, or the next run will suggest the wrong milestone again.
3. Fix anything under **On a milestone not in roadmap.json** by hand. These are usually old milestones that should be closed.
4. Run `node scripts/roadmap.mjs --apply`.
5. On the Project board, set **Theme** for newly added items (see below) and make sure every item has a **Status**.

Issues that match no theme land in the default milestone (`v1.0`) and show the theme `Unsorted` in the plan. Treat `Unsorted` as a to-do for the next triage pass.

Triage never moves an issue that already sits on a roadmap milestone. Moving it is a maintainer decision.

## Setting up the Project board

The GitHub API can't create Project views, so the board is set up once by hand:

1. Create the project: `gh project create --owner Nanle-code --title "Stellar Dev Dashboard Roadmap"`.
2. Add a single-select field **Theme** with one option per theme name in `roadmap.json`:
   `gh project field-create <number> --owner Nanle-code --name Theme --data-type SINGLE_SELECT --single-select-options "Testing & CI,Community & Docs,Security,Soroban & Protocol,Wallets & Accounts,AI & Analytics,Performance, Mobile & Accessibility"`.
   Theme names contain commas, so check the options in the UI after creating them.
3. In the project settings, turn on the built-in **Milestone** field, and keep **Status** with the options from `project.statusOptions`.
4. Create the three views listed in `project.views`: *By theme* (board, grouped by Theme), *By milestone* (table, grouped by Milestone), *By status* (board, grouped by Status).
5. Add a workflow in the project settings: **Item added to project → set Status to Todo**. Also enable **Auto-add to project** for `is:issue is:open` in this repository.

## Changing the roadmap

- **New milestone:** add it to `milestones` in version order, with a title that starts with its id (`v0.4 — …`) and at least one exit criterion. Run `--write-docs` and commit both files.
- **Closing a milestone:** close it on GitHub once every exit criterion is met. Leave it in `roadmap.json` until the next release so the docs page still shows what shipped.
- **Renaming a milestone title:** rename it on GitHub first, then in `roadmap.json`. Otherwise `--apply` creates a duplicate.

## Compatibility and security notes

- `roadmap:check` is dependency-free and read-only, so it is safe in pull-request CI from forks.
- `--apply` needs a token with `repo` scope (`project` scope too if you add board automation). Run it locally or from a manually triggered workflow. Never run it on `pull_request` events, where forked code could use the token.
- Invalid `roadmap.json` (unknown milestone ids, out-of-order versions, themes with no matchers) makes every mode exit `1` before anything is written.
