# Feature Flag Lifecycle Management

Dashboard modules can gate experimental UI through a shared lifecycle service:

`src/lib/featureFlagLifecycle.ts` + `src/components/dashboard/FeatureFlags.tsx`

## Lifecycle

| Status | Meaning |
| --- | --- |
| `draft` | Created but not yet serving traffic |
| `active` | Eligible for evaluation in configured environments |
| `expired` | Past `expiresAt` or manually expired; evaluate returns disabled |
| `retired` | Terminal state; cannot be re-activated |

Flows: **create → activate → evaluate → expire → retire**, with append-only **audit history**.

## Compatibility

- Environments: `development`, `staging`, `production`, `test` only.
- Keys: 2–64 chars, must start with a letter, charset `[a-zA-Z0-9._-]`.
- Rollout: `rolloutPercent` 0–100. Subject bucketing is deterministic (`subjectRolloutBucket`).
- Allowlist (when set) overrides percentage rollout for membership checks.

## Security notes

- Evaluation never enables a missing, draft, expired, or retired flag.
- Unsupported environments fail closed (`unsupported_environment`).
- Invalid create/evaluate inputs throw `FeatureFlagError` with a stable `code`.
- Audit entries record actor, environment, success, and a short detail string — do not store secrets in `metadata`.

## Migration

1. Import `getFeatureFlagLifecycleService()` (or construct `FeatureFlagLifecycleService` with an injectable store/clock in tests).
2. `create()` flags as `draft`, then `activate()` before production evaluation.
3. Call `evaluate(key, { environment, subjectId })` at module boundaries.
4. Prefer `expire()` for temporary shutoff and `retire()` for permanent removal.
5. Existing stub `FeatureFlags` tab now manages flags via this service; no storage migration is required (in-memory for the session).

## Example

```ts
import { getFeatureFlagLifecycleService } from '../lib/featureFlagLifecycle';

const flags = getFeatureFlagLifecycleService();
flags.create({
  key: 'fee-forecast-v2',
  name: 'Fee Forecast v2',
  environments: ['staging', 'production'],
  rolloutPercent: 25,
});
flags.activate('fee-forecast-v2');

const { enabled } = flags.evaluate('fee-forecast-v2', {
  environment: 'production',
  subjectId: connectedAddress,
});
```
