# Protocol Upgrade Tracker

The Network view shows a **Protocol Upgrade Tracker** that tells developers which Stellar
protocol version each network is running, which upgrades are coming, and when the next
Testnet reset will wipe their state.

It answers three questions:

1. **What version am I on?** — read live from the ledger header (`protocol_version`) returned by
   Horizon, not from a static table.
2. **What is coming, and what will it break?** — from a curated, versioned data file with CAP
   links and plain-language impact notes.
3. **When will Testnet be wiped, and how do I recover?** — a banner appears before a scheduled
   reset and links to the re-seed guide.

## How it works

| Piece | Location | Responsibility |
| --- | --- | --- |
| Curated data | `../../src/data/protocol-upgrades.json` | Upcoming upgrades, CAP links, scheduled Testnet resets |
| Loader + validator | `../../src/lib/protocolUpgrades.ts` | Parses/validates the data, reads ledger headers, selects reset banners |
| UI section | `../../src/components/dashboard/ProtocolUpgradeTracker.tsx` | Renders the section inside the Network view |
| Tests | `../../src/lib/__tests__/protocolUpgrades.test.ts`, `../../src/components/dashboard/tests/ProtocolUpgradeTracker.test.tsx` | Primary flow, boundary, and failure cases |

The active network's version is taken from the live ledger header first. `referenceProtocolVersions`
in the data file is only a **last-verified fallback** used for the other networks and when no ledger
has loaded yet.

The curated file is validated at read time. A malformed file never breaks the Network view: the
tracker renders an error card listing every validation issue, and the rest of the page keeps working.

## Data file schema

`protocol-upgrades.json` has this shape:

```jsonc
{
  "schemaVersion": 1,                 // schema revision (bump when fields change)
  "dataVersion": 3,                   // content revision (bump on every content edit)
  "lastUpdated": "2026-09-26",        // ISO date the entries were last reviewed
  "updateGuide": "docs/features/protocol-upgrade-tracker.md",
  "capIndexUrl": "https://github.com/stellar/stellar-protocol/blob/master/core/README.md",
  "referenceProtocolVersions": {
    "mainnet": { "version": 28, "lastVerified": "2026-09-26", "source": "Horizon /ledgers ledger header protocol_version" }
  },
  "upgrades": [
    {
      "protocolVersion": 29,
      "status": "in-development",     // in-development | scheduled | activated
      "networks": ["futurenet"],      // already live on these networks
      "targetNetworks": ["testnet", "mainnet"],
      "activationDate": null,         // ISO date when confirmed, otherwise null
      "activationWindow": { "start": "2026-11-01", "end": "2026-12-31" },
      "dateConfidence": "estimated",  // confirmed | estimated | unknown
      "dateNote": "No SDF activation date announced as of 2026-09-26.",
      "title": "Protocol 29 (in development on Futurenet)",
      "summary": "Plain-language description of the upgrade.",
      "impacts": ["Actions a developer must take", "Assumptions that may change"],
      "capsNote": "Shown when CAP assignments are not final.",
      "caps": [
        {
          "number": "CAP-0088",
          "title": "Millisecond-Resolution Close Times",
          "url": "https://github.com/stellar/stellar-protocol/blob/master/core/cap-0088.md",
          "assignment": "tbd"         // confirmed when the CAP index maps it to this version
        }
      ]
    }
  ],
  "testnetResets": [
    {
      "network": "testnet",
      "scheduledFor": "2026-11-05",   // ISO date, or null when not announced
      "dateConfidence": "estimated",
      "dateNote": "Update once SDF publishes the reset notice.",
      "summary": "What a reset wipes.",
      "impacts": ["Re-fund accounts with Friendbot", "Re-seed fixtures with pnpm demo:seed"],
      "reSeedGuideUrl": "https://github.com/Nanle-code/stellar-dev-dashboard/blob/master/docs/features/protocol-upgrade-tracker.md#re-seeding-testnet-fixtures",
      "reSeedCommand": "pnpm demo:seed"
    }
  ]
}
```

Validation rules enforced by `parseProtocolUpgrades()`:

- Every CAP `number` must match `CAP-0000` **and** its `url` must point at the matching
  `cap-XXXX.md` file in the [stellar-protocol repository](https://github.com/stellar/stellar-protocol).
  This blocks copy/paste mix-ups and fabricated links.
- Dates are `YYYY-MM-DD`. An `activationWindow.start` may not be after its `end`.
- `dateConfidence` is one of `confirmed`, `estimated`, `unknown`. **Never present an estimate as
  confirmed.**
- An upgrade with an empty `caps` array must include `capsNote` explaining that CAP assignment is
  still pending.

## Updating the data file (maintainers)

1. Check the [CAP index protocol-version table](https://github.com/stellar/stellar-protocol/blob/master/core/README.md)
   for the CAPs assigned to each protocol version.
2. Update `referenceProtocolVersions` for any network whose ledger header now reports a new version
   (verify against `GET /ledgers?order=desc&limit=1` on Horizon).
3. Add or edit the matching entry in `upgrades`. Set `status` to `activated` once the version is live
   on Mainnet and Testnet.
4. For a version that is only on Futurenet, keep `status` as `in-development` and use
   `activationWindow` + `dateConfidence: "estimated"` until the Core team confirms a vote.
5. Add or update `testnetResets` when SDF announces a reset. Use `dateConfidence: "confirmed"` and an
   exact `scheduledFor` once the notice is published; otherwise `"estimated"` with a `dateNote`.
6. Bump `dataVersion` and set `lastUpdated` to today.
7. Run the tests (`pnpm test -- protocolUpgrades`, or the full `pnpm test`) before opening the PR.

The banner appears when a reset's `scheduledFor` is **today or up to 14 days away**. A reset exactly
14 days out is included; 15 days out is not. Adjust the window in
`getActiveResetNotices()` in `../../src/lib/protocolUpgrades.ts` if the policy changes.

## Re-seeding Testnet fixtures

Testnet resets wipe balances, trustlines, deployed contracts, and contract data. After a reset:

1. Re-fund accounts from [Friendbot](https://friendbot.stellar.org).
2. Redeploy Soroban contracts and re-run their initialization.
3. Re-seed dashboard fixtures with `pnpm demo:seed` (implemented in
   `../../scripts/seed-demo-fixtures.mjs`). Use `pnpm demo:seed:check` to verify the fixtures are
   present without rewriting them.
4. Refresh any saved contract IDs or transaction hashes in local configs.

The reset banner links back to this section so developers can find the steps quickly.

## Related documentation

- [Soroban best practices](./../SOROBAN_BEST_PRACTICES.md)
- [Environment profiles](../ENVIRONMENT_PROFILES_INTEGRATION.md)
- [Error handling guide](../ERROR_HANDLING_GUIDE.md)
