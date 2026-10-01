# Security Audit Trail Analysis (#587)

`src/lib/securityAuditAnalysis.ts` analyses audit log entries for security issues. It flags unusual patterns and compliance violations, scores the risk, and returns a report with prioritised recommendations. Everything runs client-side in the browser: no model download, no network access, and no data leaves the device.

## Usage

```ts
import {
  analyzeSecurityAuditTrail,
  analyzeRecordedAuditLog,
  startLiveSecurityAnalysis,
  formatSecurityReportMarkdown,
} from '../lib/securityAuditAnalysis';

// Batch: any array of audit entries
const report = analyzeSecurityAuditTrail(entries, { trustedActors: ['ops-admin'] });
report.riskLevel;        // 'none' | 'low' | 'medium' | 'high' | 'critical'
report.recommendations;  // [{ priority, action, findingIds }]

// The log recorded through src/utils/audit.ts
const today = analyzeRecordedAuditLog({ since: '2026-09-29T00:00:00Z' });

// Real time: one callback per new finding, each reported once
const stop = startLiveSecurityAnalysis((finding) => notify(finding.title));

// Shareable report for an incident ticket
const markdown = formatSecurityReportMarkdown(report);
```

Input can be entries from `src/utils/audit.ts` (`action`, `actor`, `outcome`) or from the legacy `src/lib/auditTrail.ts` shape (`type`, `userId`).

## What it detects

Two methods run together:

- **Behavioural baselines** learned from the log itself: each actor's usual activity hours, and robust z-scores (median/MAD) over per-actor event volume. They need no training data and adapt to each deployment.
- **Pattern rules** for well-known attacks.

| Finding | Trigger (defaults) | Severity |
|---|---|---|
| `brute_force` | ≥ 5 failed auth events for one principal, each within 5 min of the previous | high |
| `credential_compromise` | a brute-force burst followed by a successful login | critical |
| `volume_anomaly` | ≥ 20 events in a 10-min bucket with robust z ≥ 6 | medium / high |
| `off_hours_activity` | sensitive action in an hour holding < 5% of the actor's history (needs ≥ 30 events of baseline) | medium |
| `privilege_escalation` | denied permission changes, or role grants by a non-admin | medium / high |
| `signer_change` | added signers or changed thresholds, which can hand over a Stellar account | high |
| `data_exfiltration` | ≥ 3 exports in an hour, or ≥ 10,000 exported records | medium / high |
| `session_anomaly` | one session used by several identities, or > 3 IPs/agents for an actor in an hour | high / medium |
| `audit_tampering` | broken hash chain, audit log cleared, or timestamps > 5 min in the future | critical / high / medium |
| `unattributed_action` | privileged action logged with no actor | medium / high |
| `high_severity_cluster` | ≥ 3 high/critical events for one actor within 10 min | medium / high |

All thresholds are options on `SecurityAnalysisOptions`. Actors listed in `trustedActors` are not flagged for expected admin work (role grants, signer changes).

## Risk scoring

- **Finding risk** = severity weight (low 20, medium 45, high 70, critical 95) × detector confidence (0–1).
- **Actor and overall risk** combine findings with a noisy-OR, `100 × (1 − Π(1 − rᵢ/100))`. Several medium findings add up to high risk, and the score never goes above 100.
- **Levels:** ≥ 85 critical, ≥ 60 high, ≥ 30 medium, > 0 low, 0 none.

Findings that touch a compliance control (SOC 2, ISO 27001, SOX, GDPR) list it in `complianceControls` and also appear in `report.complianceViolations`.

## Accuracy and performance

`src/lib/__tests__/securityAuditAnalysis.test.ts` builds a seeded, labelled audit log: 15 users over 7 days of normal activity with 22 injected incidents. The suite requires:

- **≥ 80% of the labelled incidents detected** (the acceptance target),
- **≤ 20% of findings are false positives**,
- **zero findings** on the same log with the incidents removed,
- **10,000 entries analysed in under 2 s** in CI. Locally this takes tens of milliseconds, so it is fine to run on every new entry.

The streaming analyser keeps a bounded window (`maxEntries`, default 5,000) and re-analyses it on each `ingest`, so memory use stays flat on long-lived pages.

## Invalid input and failure paths

- Non-array input throws `TypeError`. Entries with no parseable timestamp or no action are skipped and counted in `report.entriesSkipped`.
- An empty log returns `riskLevel: 'none'` with an explanatory summary.
- `createStreamingSecurityAnalyzer({ maxEntries })` throws `RangeError` for values that are not positive integers.
- Subscriber errors are swallowed by `src/utils/audit.ts`, so a throwing `onFinding` handler cannot break audit recording.

## Compatibility and security notes

- The analyser only reads entries. It never changes the audit log or its hash chain.
- Audit metadata is already redacted by `recordAudit`. Evidence strings contain only actor ids, actions and counts, never metadata values, so reports are safe to paste into tickets.
- The findings are signals for a person to review, not verdicts. Don't use them to lock accounts automatically without human confirmation.
- Timestamps are read as UTC. Off-hours baselines are per actor, so teams in different time zones don't produce false positives.
