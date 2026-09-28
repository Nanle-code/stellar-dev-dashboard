## Summary

<!-- What changed and why. Keep it short; link design notes if any. -->

Closes #

## How was this tested?

<!-- Commands you ran and what they covered (primary flow, a boundary case, a failure case). -->

## Merge requirements

A PR is merged only when **every** box below is true. See
[Merge requirements](https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/contributing.md#merge-requirements) for the full policy.

- [ ] All required CI checks pass on the latest commit (not just an earlier push).
- [ ] No required checks are failing, pending, or skipped — re-run or fix them; do not ask for a merge while any are outstanding.
- [ ] The branch has no merge conflicts with the target branch (rebase or merge `master` if GitHub shows "This branch has conflicts").
- [ ] Tests were added or updated for the change (primary flow, a boundary case, and a failure case).
- [ ] Docs were updated where behaviour, configuration, or security posture changed.

## Security-sensitive changes

<!-- Delete this section if the PR touches no path listed in .github/CODEOWNERS. -->

- [ ] This PR touches a path covered by `.github/CODEOWNERS` (wallet, auth, cryptography, CI) and a code owner has been requested for review.
- [ ] I described any change to key handling, signing, session lifetime, or trusted endpoints above.
