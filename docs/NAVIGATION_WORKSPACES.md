# Navigation Workspaces

The sidebar groups routes into four task-oriented workspaces: Explore, Build, Monitor, and Admin / Diagnostics. Workspace membership is route-registry metadata; Admin / Diagnostics is collapsed on first use and, like the other workspaces, remembers its expanded state in browser local storage under `stellar_sidebar_collapsed_groups`.

## Compatibility and migration

Route IDs, URL paths, aliases, and direct links are unchanged. Existing bookmarks and integrations do not need migration. The prior collapse preference did not exist, so users receive the new default state once; clearing the `stellar_sidebar_collapsed_groups` local-storage entry resets the workspaces to defaults. Invalid preference data and unavailable browser storage fall back to Admin / Diagnostics collapsed without blocking navigation.

## Security

Admin / Diagnostics is a navigation grouping, not an authorization boundary. Its routes remain directly addressable by URL. Any sensitive operation must continue to enforce authorization at the relevant application or API boundary; hiding or collapsing a link must never be treated as access control.

## Usability validation

A five-participant tree test is required before the navigation change is considered validated. Give each participant these tasks without explaining the workspace labels:

1. Find the account balance and recent activity.
2. Locate the transaction builder and contract tools.
3. Find live network activity and performance monitoring.
4. Open the design system and dependency management.

Record completion, first-click correctness, time to destination, and any label confusion. Report aggregated results in the pull request using this table:

| Task | Successful participants (n/5) | Median time | Common confusion |
| --- | --- | --- | --- |
| Account balance and activity | Pending | Pending | Pending |
| Transaction and contract tools | Pending | Pending | Pending |
| Live activity and monitoring | Pending | Pending | Pending |
| Design system and dependencies | Pending | Pending | Pending |

**Status:** The test has not yet been run; participant results are pending and must not be represented as completed research in the pull request.
