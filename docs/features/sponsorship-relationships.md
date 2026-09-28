# Sponsorship relationships & residual liabilities

Stellar accounts can sponsor each other's ledger entries, shifting the base
reserve liability. The account dashboard now surfaces:

- **who sponsors this account** (distinct sponsoring accounts);
- **which entries are sponsored** (signers, trustlines) and by whom;
- the **residual reserve** this account still has to cover itself;
- the **reserve it provides** for entries it sponsors on behalf of others.

## API

`src/lib/sponsorship.ts`

```ts
import { analyzeSponsorship, reserveImpactXlm } from '../lib/sponsorship';

const analysis = analyzeSponsorship(horizonAccount);
analysis.sponsoringAccounts;     // string[]
analysis.sponsoredEntries;       // { type, id, sponsor }[]
analysis.reserve.residualReserveStroops;
analysis.reserve.providedReserveStroops;
reserveImpactXlm(analysis.reserve); // { gross, relief, residual, provided } in XLM
```

### Reserve maths

| Quantity            | Formula                                                        |
| ------------------- | -------------------------------------------------------------- |
| Gross reserve       | `(2 + subentry_count) × base_reserve`                          |
| Relief              | `min(num_sponsoring, 2 + subentry_count) × base_reserve`       |
| Residual liability  | `max(0, gross − relief)`                                       |
| Provided liability  | `num_sponsored × base_reserve`                                 |

`base_reserve` defaults to `0.5 XLM` (`5_000_000` stroops) and can be overridden
for non-default networks.

## React usage

```tsx
import SponsorshipPanel from '../components/dashboard/SponsorshipPanel';
import { analyzeSponsorship } from '../lib/sponsorship';

<SponsorshipPanel analysis={analyzeSponsorship(account)} />;
```

## Invalid input, unsupported environments, and failure paths

- `null`, primitives, and arrays degrade to a zeroed, `degraded: true` summary
  with a warning instead of throwing.
- A record without `account_id` still computes reserves but is flagged.
- Negative / non-numeric `num_sponsoring`, `num_sponsored`, and `subentry_count`
  are treated as zero.
- Malformed `signers` / `balances` entries are ignored.
- `relief` is capped so a residual can never go negative.

## Testing

`src/lib/__tests__/sponsorship.test.ts` covers the primary calculation, boundary
cases (relief capping, invalid counts, malformed nested records), and failure
paths (invalid account records). Run `pnpm run test -- sponsorship`.
