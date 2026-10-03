# Analytics and diagnostics consent

Optional analytics and diagnostics require an explicit, versioned choice. The
consent prompt appears on first use and again when the policy version changes.
The Settings page lets a user withdraw consent later.

## What the choice covers

When consent is current, configured telemetry providers may receive page
activity, browser and device details, performance measurements, redacted crash
reports, and masked session replay data for errors. The configured retention
period is up to 30 days. Local dashboard calculations and user-requested data
exports are not controlled by this setting.

Without current consent, the app does not send custom analytics, real user
monitoring (RUM), error reports, or Sentry events. A missing, malformed, stale,
or unreadable choice is treated as no consent. If browser storage cannot save a
grant, the grant is rejected and the app remains usable without telemetry. A
decline that cannot be saved remains effective for the current session and the
prompt explains that the choice should be retried before closing the app.

## Policy changes and migration

`ANALYTICS_POLICY_VERSION` in `src/utils/preferences.ts` identifies the policy
the user reviewed. Bump it whenever the collected data, purposes, providers,
retention, or controls materially change. The app disables telemetry as soon as
the saved version no longer matches and asks the user to review the updated
policy.

Existing installations that only have the old `diagnosticsConsent` preference
are not silently migrated into analytics consent. They receive the prompt once
and can grant or decline under the current policy. The `diagnosticsConsent`
field remains as a compatibility alias for consumers of the older preference
shape; new code should use `analyticsConsent` and its policy version.

## Withdrawal behavior and limits

Withdrawal blocks new event capture, discards queued analytics and error data,
aborts active fetch requests, disconnects RUM observers, clears Sentry user
context, and closes the Sentry client without waiting for queued events to
flush. Storage events propagate choices between tabs. A request that the
browser already delivered before withdrawal cannot be recalled from a provider.

Custom telemetry delivery requires `fetch` and `AbortController` so in-flight
requests can be canceled. If either is unavailable, custom analytics and RUM
delivery is skipped. Browser storage is also required to persist a choice;
when it is unavailable, consent defaults to off.

## Tests

The consent and monitoring behavior is covered by:

- `src/utils/__tests__/analyticsConsent.test.ts` — initial choice, stale policy,
  storage failure, queued-event withdrawal, and aborting an active request.
- `src/utils/__tests__/monitoring.consent.test.ts` — Sentry opt-in and opt-out.
- `src/utils/__tests__/analytics.circuitBreaker.test.ts` — analytics delivery
  through the provider failure circuit.

Run the focused suite with:

```bash
pnpm exec vitest run --config vitest.config.js src/utils/__tests__/analyticsConsent.test.ts src/utils/__tests__/monitoring.consent.test.ts src/utils/__tests__/analytics.circuitBreaker.test.ts
```
