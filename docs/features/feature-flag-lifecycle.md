# Feature Flag Lifecycle Management

The lifecycle API below manages **session-local experimental flags**. It is not the operator kill switch and must not be used as a production-wide safety control.

Dashboard modules can gate experimental UI through a shared lifecycle service:

`src/lib/featureFlagLifecycle.ts` + `src/components/dashboard/FeatureFlags.tsx`

## Lifecycle

| Status    | Meaning                                                         |
| --------- | --------------------------------------------------------------- |
| `draft`   | Created but not yet serving traffic                             |
| `active`  | Eligible for evaluation in configured environments              |
| `expired` | Past `expiresAt` or manually expired; evaluate returns disabled |
| `retired` | Terminal state; cannot be re-activated                          |

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

## Global AI panel kill switch (runtime control)

The Feature Flags screen also exposes a separate server-authoritative switch at `/api/v1/ai-controls`. `GET` reads current status; `PUT` accepts `{ "enabled": false, "reason": "incident response" }`. A configured operator bearer token is required to write. The UI holds the token in memory only, clears it after a successful change, and never persists it. The endpoint also exposes a read-only bounded audit list at `/api/v1/ai-controls/audit`.

### Compatibility and deployment

- Current API environments are `development`, `test`, and `production`. Other values (including `staging`) return an unsupported-environment error; define and validate an environment mapping before using a new deployment tier.
- Development/test may use process-local memory when Redis is not configured. That mode is neither durable nor shared across API instances and is unsuitable for production.
- Production requires shared Redis configured with `REDIS_URL` and `AI_KILL_SWITCH_STORE=redis`. The control state and bounded audit history are updated atomically in Redis. If Redis is absent or unavailable, reads and writes return `503`; the browser fails closed and suppresses AI panels. There is intentionally no process-local fallback.
- Set `AI_KILL_SWITCH_OPERATOR_TOKEN` on the API service to a randomly generated secret of at least 32 characters. Configure it through your secret manager/container environment, not source control, browser storage, or Vite's `VITE_*` variables. No operator token means no authorized mutation.
- Compose's API and web containers use the API service proxy so status and operator requests are same-origin. For standalone deployments, route `/api/` to the API server and preserve `Authorization`; deploy a shared Redis service before enabling the production control.

### Behavior and security

- AI panel state is polled every 10 seconds and refreshed when a browser tab becomes visible. Initial state and fetch/storage failures are fail-closed; the UI does not treat missing status as enabled.
- Dashboard AI routes/widgets and AI behavior endpoints are gated. Hiding a panel is not an authorization substitute; other AI backend integrations should also check the authoritative state before being considered covered by the global switch.
- The write credential is compared in constant time, never returned by the API, and not written to local storage. Audit records include transition, timestamp, fixed operator label, and optional reason (max 240 printable characters); do not put secrets or personal data in the reason.
- Existing local feature flags and their in-memory audit log are unchanged. No data migration is needed; the runtime control persists independently in Redis. Roll back by setting `enabled` to `true` with the operator credential.

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
