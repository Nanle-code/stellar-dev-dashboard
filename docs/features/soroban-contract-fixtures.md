# Soroban Contract Fixtures (#896)

Deterministic `simulateTransaction` responses for Soroban tests. They cover a successful simulation, an auth failure and resource exhaustion, plus archived-state and transport-error variants. Use them to test contract UI and helpers without a live RPC node.

- **Factory:** `tests/__factories__/sorobanContractFixtures.ts` (also re-exported from `tests/__factories__/index.js`)
- **Classifier:** `src/lib/stellar/simulationOutcome.ts`, which turns any raw simulation response into an outcome kind the UI can branch on
- **Tests:** `tests/unit/sorobanContractFixtures.test.ts`

## Quick start

```ts
import { createSorobanFixtureFactory } from '../__factories__/sorobanContractFixtures';
import { classifySimulationResponse } from '../../src/lib/stellar/simulationOutcome';

const soroban = createSorobanFixtureFactory({ seed: 'counter-contract' });

soroban.simulationSuccess({ returnValue: 7 });        // JSON-RPC envelope with real XDR
soroban.authFailure({ reason: 'invalid_signature' }); // HostError: Error(Auth, InvalidAction)
soroban.resourceExhaustion({ resource: 'memory' });   // HostError: Error(Budget, ExceededLimit)
soroban.restoreRequired();                             // includes restorePreamble
soroban.rpcError({ code: -32602 });                    // transport-level JSON-RPC error

classifySimulationResponse(soroban.authFailure()).kind; // 'auth_failure'
```

### With MSW (Vitest)

```ts
server.use(
  http.post('https://soroban-testnet.stellar.org', async ({ request }) =>
    HttpResponse.json(soroban.handle(await request.json(), 'resource_exhaustion'))
  )
);
```

### With Playwright

The shared E2E fixture (`tests/e2e/support/fixtures.ts`) already routes Soroban RPC through this factory:

```ts
test('shows auth failure', async ({ page, stellar }) => {
  stellar.setSorobanScenario('auth_failure');
  // …
});
```

## Scenarios

| Method / scenario | Response | `classifySimulationResponse` kind |
|---|---|---|
| `simulationSuccess()` | `transactionData`, `minResourceFee`, `results[].xdr`, `cost` | `success` (with warnings at ≥ 90% of a limit) |
| `authFailure()` | `result.error` with `Error(Auth, InvalidAction)` naming the failing address | `auth_failure` |
| `resourceExhaustion({ resource })` | `result.error` with `Error(Budget, ExceededLimit)` | `resource_exhaustion` + `exhaustedResource` |
| `restoreRequired()` | success payload plus `restorePreamble` | `restore_required` |
| `rpcError()` | top-level JSON-RPC `error` | `rpc_error` |
| `handle(body, scenario)` | routes `simulateTransaction` by scenario; answers `getNetwork`, `getLatestLedger` and `getHealth`; returns `-32601` for other methods | — |

Every XDR field (`transactionData`, `results[].xdr`, the restore preamble) is real SDK-encoded XDR, so `rpc.parseRawSimulation` accepts the fixtures just like a live response.

## Determinism

- Contract and account addresses are derived from `seed` (SHA-256), so the same seed always gives the same `C…`/`G…` strings.
- Each response advances `latestLedger` and the JSON-RPC `id` by one. `reset()` replays the sequence from the start.
- `handle()` echoes the request `id`, so fixtures work with clients that match responses to requests.

## Boundary cases

`classifySimulationResponse` compares `cost.cpuInsns` / `cost.memBytes` with `DEFAULT_SOROBAN_RESOURCE_LIMITS` (100,000,000 instructions, 41,943,040 bytes):

- Usage **equal to** the limit is `success` with a warning.
- Usage **one unit over** the limit is `resource_exhaustion`.

Pass your own limits as the second argument when a network is configured differently. The defaults mirror published network settings at the time of writing and are not fetched live.

## Invalid input and unsupported environments

- The factory throws `SorobanFixtureError` for an empty seed, a negative or non-integer `startLedger` or resource value, an unknown `resource`, or an unknown scenario passed to `handle()`.
- `network` must be `testnet`, `futurenet` or `standalone`. `public`/`mainnet` are refused on purpose, so fixtures can't pass for mainnet state in screenshots or bug reports.
- `classifySimulationResponse` never throws. Non-objects, envelopes with no result, and "successful" payloads missing `transactionData` all return `invalid_response`.

## Compatibility and security notes

- Test-only: the factory lives under `tests/` and is never bundled into the app. The classifier in `src/` reads plain JSON and never decodes XDR, so it is safe on untrusted RPC payloads.
- Error strings follow the `HostError: Error(<type>, <code>)` format that current Soroban hosts produce. If a protocol upgrade changes that format, update the patterns in `simulationOutcome.ts` and the matching fixture together.
- **Migration:** existing hand-written mocks (for example in `tests/e2e/soroban.spec.js`) keep working. Move them to the factory when you next touch them to get valid XDR and stable ids.
