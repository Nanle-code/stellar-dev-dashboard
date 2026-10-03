# Notification & Toast Severity Taxonomy

This document outlines the centralized notification and toast severity taxonomy, persistence rules, and accessibility standards for the Stellar Developer Dashboard.

---

## 1. Unified Severity Levels

All notifications in the dashboard adhere to a centralized 5-tier taxonomy defined in `src/lib/notificationTaxonomy.ts`:

| Severity | Default Auto-Dismiss | Accessibility Role | ARIA Live Mode | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`info`** | 4000 ms | `role="status"` | `aria-live="polite"` | General informational updates, network status changes, account refreshes. |
| **`success`** | 5000 ms | `role="status"` | `aria-live="polite"` | Successful transactions, signed payloads, saved settings. |
| **`warning`** | 8000 ms | `role="alert"` | `aria-live="assertive"` | Rate limit warnings, slippage risks, pending confirmations. |
| **`error`** | Persistent (0 ms) | `role="alert"` | `aria-live="assertive"` | Transaction simulation failures, RPC errors, contract execution errors. |
| **`critical`** | Persistent (0 ms) | `role="alert"` | `aria-live="assertive"` | Security events, unhandled circuit breakers, data corruption alerts. |

---

## 2. Persistence & Auto-Dismiss Rules

- **Transient Notifications (`info`, `success`, `warning`):** Auto-dismiss after the prescribed timeout to avoid cluttering the interface while giving users sufficient time to read.
- **Persistent Notifications (`error`, `critical`):** Default to `defaultAutoDismissMs: 0`, requiring manual dismissal so critical alerts are not missed.
- **Custom Overrides:** Any notification can explicitly specify `timeout: 0` to become sticky or supply a custom duration in milliseconds. Negative durations are clamped to `0`.

---

## 3. Accessibility & Screen Reader Standards

Following W3C WAI-ARIA guidelines:
1. **Polite Announcements (`info`, `success`):** Rendered with `role="status"` and `aria-live="polite"`. The screen reader will announce them at the next idle opportunity without interrupting active speech.
2. **Assertive Announcements (`warning`, `error`, `critical`):** Rendered with `role="alert"` and `aria-live="assertive"`. The screen reader announces the alert immediately to prioritize urgent feedback.
3. **Region Isolation:** The top-level `NotificationCenter` container uses `role="region" aria-label="Notifications"`, preventing duplicate or conflicting live-region announcements.

---

## 4. Legacy Type Migration & Normalization

The `normalizeSeverity` utility maps legacy notification types cleanly to the canonical taxonomy:

- `tx_confirm`, `confirmed` -> `success`
- `price_alert`, `warn` -> `warning`
- `account_change`, `network_event`, `notice` -> `info`
- `danger`, `failure` -> `error`
- `fatal`, `panic`, `emergency` -> `critical`
- Unrecognized or null inputs gracefully default to `info`.
