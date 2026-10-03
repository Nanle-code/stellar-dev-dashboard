# Wallet Session Idle Timeout

A dashboard left open on a shared or public workstation can keep a wallet connected. The idle timeout warns the user before disconnecting the wallet, and then disconnects it after a configurable period with no activity (#837).

## Behaviour

1. While a wallet is connected, the dashboard watches for activity: pointer, keyboard, wheel, touch and scroll events.
2. Shortly before the timeout, a **"Still there?"** dialog appears with a countdown. The lead time is 60 seconds, or half the timeout if that is shorter, so the 1-minute minimum gives a 30-second warning. The dialog offers two buttons:
   - **Stay connected** restarts the idle period.
   - **Disconnect now** ends the session immediately.
3. When the countdown reaches zero, the session is revoked with the reason `idle_timeout`. The wallet, connected address and loaded account data are cleared. A WalletConnect relay session is also closed. A notice explains what happened.
4. Every idle disconnect is recorded in the wallet security audit log:
   - `wallet_idle_timeout` when the countdown expires;
   - `wallet_idle_disconnect_confirmed` when the user chooses **Disconnect now**.

Moving the mouse or pressing a key does **not** dismiss an open warning. The user must choose an option. This way a bumped mouse on a shared machine can't silently keep someone else's session alive.

## Configuration

Users choose the timeout under **Wallet → Auto-disconnect when idle**. The options are Off, 5, 15, 30 or 60 minutes, and the default is **15 minutes**. The choice is stored per browser in `localStorage` under `stellar-dash:wallet-idle-timeout-minutes`.

For code, use `useStore().setWalletIdleTimeoutMinutes(minutes)`. The value is validated by `normalizeIdleTimeoutMinutes` in `src/lib/wallet/idleTimeout.ts`:

| Input | Result |
|-------|--------|
| `0` | Timeout disabled |
| Integer 1–240 | Used as-is |
| Below 1 (e.g. `0.2`) / above 240 | Clamped to 1 / 240 |
| Fractional (e.g. `7.6`) | Rounded (`8`) |
| Non-numeric, negative, `NaN`, empty, or a corrupt stored value | Falls back to the **default (15)**, never to "off" |

Invalid configuration fails safe. Corrupt or tampered storage can't turn the protection off. Only an explicit `0` disables it.

## Unsupported environments and failure handling

- **No DOM events or timers** (SSR, workers, stripped-down webviews): `isIdleTimeoutSupported()` returns `false`. The monitor does nothing, and the setting is shown disabled with an explanation. The wallet still works normally, without auto-disconnect.
- **Storage unavailable** (private mode, blocked site data, quota exceeded): reads fall back to the default, and writes still apply for the current page session.
- **Throttled or suspended tabs and sleeping laptops**: deadlines are checked against the wall clock, not a count of timer ticks. The check runs whenever the tab becomes visible again. If the machine slept past the deadline, the session expires on wake; it does not get a fresh countdown.
- **Wallet disconnected elsewhere** (wallet locked, account removed, manual disconnect): any open warning closes, and the monitor stops.
- **WalletConnect relay errors** on disconnect are ignored. The local session is revoked either way.

## Compatibility and migration notes

- **New default:** this is a behaviour change for existing users. Wallet sessions now expire after 15 minutes idle unless the user picks **Off**. No data migration is needed.
- **Per tab:** each browser tab tracks activity on its own. Activity in one tab does not extend a session in another.
- **Scope:** the timeout ends the dashboard's session only. It does **not** lock the wallet extension (Freighter, xBull, etc.) or a hardware device. Users on shared machines should also lock their wallet extension.
- **Anyone watching `walletSessionRevokedReason`** can tell idle expiry apart from other revocations: the value is `idle_timeout` (`IDLE_TIMEOUT_REVOKE_REASON`).

## Tests

- `src/lib/wallet/__tests__/idleTimeout.test.ts` covers validation, persistence, environment detection and the monitor state machine. The cases include the minimum and maximum bounds, sleep past the deadline, and an unsupported target.
- `tests/unit/components/WalletIdlePrompt.test.tsx` covers the prompt flow, **Stay connected**, **Disconnect now**, the 1-minute boundary, the disabled state and external disconnects.
