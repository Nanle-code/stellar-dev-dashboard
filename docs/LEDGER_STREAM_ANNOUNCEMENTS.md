# Ledger stream live-region announcements

Accessibility feature for issue **#872** — announce meaningful ledger and
transaction updates to assistive-technology users **without overwhelming them**.

## What it does

The account/transaction streams (`useAccountStream`) push high-signal events
onto the global notification store (`notificationStore`). `LedgerLiveRegion`
subscribes to that store and renders a visually-hidden, polite ARIA live
region:

```html
<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  Ledger update. Incoming payment: 10 XLM.
</div>
```

Only the ledger/transaction update titles are announced:

- `Incoming payment`, `Outgoing payment`
- `Account credited`, `Account debited`
- `Signer change`
- `New transaction`

Everything else (e.g. low-balance warnings, network notices) is left to the
existing notification UI and is **not** spoken by this region.

## Why it does not overwhelm screen readers

Streams can emit several events per second. Announcing each one would flood the
screen-reader queue, so updates are **coalesced**:

| Behaviour | Default |
| --- | --- |
| Coalescing window | `4s` (`DEFAULT_WINDOW_MS`) |
| Immediate flush threshold | `5` pending updates (`DEFAULT_MAX_BATCH`) |
| Announcement stays mounted | `5s` (`DEFAULT_CLEAR_AFTER_MS`) |

- `1` update → `"Ledger update. <title>: <message>."`
- `2–3` updates → `"Ledger updates. <a>; <b>."`
- `4+` updates → `"N ledger updates. Latest: <most recent>."`

The region is **primed** with the current history on mount, so pre-existing
notifications are never re-announced. De-duplication by notification id means
removals, reorders, and repeated snapshots stay silent.

## Where it is mounted

`RealTimeNotificationCenter` renders `<LedgerLiveRegion />` unconditionally
(even while the slide-over panel is closed) and keeps the panel itself behind
the `open` prop. This guarantees updates that arrive while the panel is closed
are still announced.

## Usage

```tsx
import LedgerLiveRegion from '../components/notifications/LedgerLiveRegion'

// Defaults
<LedgerLiveRegion />

// Opt out (e.g. a user preference)
<LedgerLiveRegion enabled={false} />
```

Lower-level pieces are exported for reuse and testing:

- `src/lib/ledgerAnnouncements.ts` — pure, dependency-free detection +
  coalescing (`isLedgerUpdate`, `buildLedgerAnnouncement`,
  `createLedgerAnnouncer`). Timers are injectable.
- `src/hooks/useLedgerAnnouncements.ts` — React binding returning the latest
  announcement string.

## Compatibility & failure paths

- **SSR / unsupported environments:** the hook is a no-op when `window` is
  undefined; the announcer never touches `window` directly.
- **Invalid input:** `isLedgerUpdate` and `buildLedgerAnnouncement` accept
  `null`/malformed values and return `false`/`''`; the announcer ignores
  non-array snapshots.
- **Announcer failure:** if the `announce` callback throws, the error is
  swallowed so the real-time stream keeps working.
- **Cleanup:** unmounting unsubscribes from the store and cancels any pending
  timer.

## Tests

- `src/lib/__tests__/ledgerAnnouncements.test.ts` — detection, batch
  formatting (boundary sizes), and the coalescer (history priming, burst
  coalescing, immediate flush, throwing callback, dispose).
- `src/components/notifications/__tests__/LedgerLiveRegion.test.tsx` —
  primary flow, burst coalescing, pre-mount history, non-ledger filtering, and
  the disabled path.
