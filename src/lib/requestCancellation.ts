/**
 * Lane-scoped request cancellation ("latest request wins").
 *
 * Horizon reads are fired from account- and network-scoped effects. When the user
 * switches account or network mid-flight, the previous request is still in the air;
 * if it resolves *after* the new one it will happily overwrite current state with
 * data for an account the user has already navigated away from (Issue #745).
 *
 * A `RequestCoordinator` gives each logical stream of work a named *lane*. Starting
 * new work on a lane invalidates every earlier lease on that lane:
 *
 *   - the earlier lease's `AbortSignal` fires, so in-flight `fetch` calls are
 *     actually cancelled at the network layer, and
 *   - the earlier lease reports `active === false`, so any response that still
 *     arrives (SDK calls that cannot observe a signal, or a race with abort) is
 *     dropped instead of being written to state.
 *
 * The signal is best-effort — the Stellar SDK's `CallBuilder` does not accept one —
 * so `active`/`commit()` are the guarantee and abort is the optimisation.
 */

/** Thrown when work is discarded because a newer request superseded it. */
export class StaleRequestError extends Error {
  /** Discriminator that survives bundling and cross-realm checks. */
  readonly isStaleRequest = true;
  readonly lane: string;
  readonly token: number;

  constructor(lane: string, token: number) {
    super(`Request on lane "${lane}" (#${token}) was superseded by a newer request`);
    this.name = 'StaleRequestError';
    this.lane = lane;
    this.token = token;
    // Preserve prototype chain when compiled down to ES5.
    Object.setPrototypeOf(this, StaleRequestError.prototype);
  }
}

/** True when `error` signals work discarded because it was superseded. */
export function isStaleRequestError(error: unknown): error is StaleRequestError {
  return (
    error instanceof StaleRequestError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as StaleRequestError).isStaleRequest === true)
  );
}

/** True when `error` is a DOM abort (`AbortController.abort()`), across realms. */
export function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const name = (error as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * True when `error` means "this result is no longer wanted" — either the request
 * was aborted or its lease went stale. Callers use this to stay silent instead of
 * surfacing a spurious error to the user.
 */
export function isCancellation(error: unknown): boolean {
  return isStaleRequestError(error) || isAbortError(error);
}

/**
 * `AbortController` is standard in browsers and Node >= 15, but the dashboard also
 * runs under SSR shims, jsdom variants and older embedded webviews. Detect once and
 * degrade to token-only invalidation rather than throwing at import time.
 */
export const supportsAbortController: boolean = (() => {
  try {
    if (typeof AbortController !== 'function') return false;
    const probe = new AbortController();
    return typeof probe.signal === 'object' && probe.signal !== null;
  } catch {
    return false;
  }
})();

/** A single unit of cancellable work on a lane. */
export interface RequestLease {
  /** The lane this lease belongs to. */
  readonly lane: string;
  /** Monotonic per-coordinator id; higher means newer. */
  readonly token: number;
  /**
   * Signal for the underlying transport. `undefined` where `AbortController` is
   * unavailable — guard with `supportsAbortController` before relying on it.
   */
  readonly signal: AbortSignal | undefined;
  /** False once a newer lease started on this lane, or this lease was aborted. */
  readonly active: boolean;
  /** Throws `StaleRequestError` when no longer `active`. */
  ensureActive(): void;
  /**
   * Runs `fn`, rejecting with `StaleRequestError` if the lease is stale either
   * before `fn` starts or by the time it settles. Guarantees a stale response can
   * never be returned to the caller.
   */
  run<T>(_fn: (_signal: AbortSignal | undefined) => Promise<T>): Promise<T>;
  /**
   * Applies a state mutation only while the lease is current. Returns whether
   * `apply` ran, so callers can skip follow-up work for a discarded response.
   */
  commit(_apply: () => void): boolean;
  /** Aborts just this lease. */
  abort(): void;
}

interface LaneRecord {
  token: number;
  controller: AbortController | null;
  /** Set when there is no AbortController to carry the aborted flag. */
  aborted: boolean;
}

function assertLane(lane: string): void {
  if (typeof lane !== 'string' || lane.trim() === '') {
    throw new TypeError('RequestCoordinator lane must be a non-empty string');
  }
}

/**
 * Tracks the newest lease per lane and invalidates the rest.
 *
 * A lane names the *state slot being written*, not the data being read — see
 * `AccountLanes`. Keying a lane by address would give each account its own lane, so
 * the previous account's slow response would never be cancelled.
 *
 * ```ts
 * const lease = accountRequests.begin(AccountLanes.Connect);
 * const account = await lease.run((signal) => fetchAccount(address, network, { signal }));
 * lease.commit(() => setAccountData(account));
 * ```
 */
export class RequestCoordinator {
  private readonly lanes = new Map<string, LaneRecord>();
  private nextToken = 0;

  /**
   * Starts new work on `lane`, cancelling whatever was in flight there.
   *
   * @throws {TypeError} when `lane` is not a non-empty string.
   */
  begin(lane: string): RequestLease {
    assertLane(lane);
    this.abort(lane);

    const token = ++this.nextToken;
    const record: LaneRecord = {
      token,
      controller: supportsAbortController ? new AbortController() : null,
      aborted: false,
    };
    this.lanes.set(lane, record);

    return this.createLease(lane, record);
  }

  /** Cancels in-flight work on `lane`. No-op when the lane is idle. */
  abort(lane: string): void {
    assertLane(lane);
    const record = this.lanes.get(lane);
    if (!record) return;
    this.abortRecord(record);
    this.lanes.delete(lane);
  }

  /** Cancels every lane. Use on unmount or global reset (e.g. wallet disconnect). */
  abortAll(): void {
    for (const record of this.lanes.values()) {
      this.abortRecord(record);
    }
    this.lanes.clear();
  }

  /** Number of lanes with work in flight. Exposed for tests and diagnostics. */
  get activeLaneCount(): number {
    return this.lanes.size;
  }

  private abortRecord(record: LaneRecord): void {
    record.aborted = true;
    if (!record.controller || record.controller.signal.aborted) return;
    try {
      record.controller.abort();
    } catch {
      // Some polyfills throw when aborting an already-settled controller; the
      // `aborted` flag above is what correctness depends on.
    }
  }

  private isCurrent(lane: string, record: LaneRecord): boolean {
    if (record.aborted) return false;
    if (record.controller?.signal.aborted) return false;
    return this.lanes.get(lane) === record;
  }

  private createLease(lane: string, record: LaneRecord): RequestLease {
    const coordinator = this;

    const lease: RequestLease = {
      lane,
      token: record.token,
      signal: record.controller?.signal,

      get active() {
        return coordinator.isCurrent(lane, record);
      },

      ensureActive() {
        if (!this.active) throw new StaleRequestError(lane, record.token);
      },

      async run<T>(fn: (_signal: AbortSignal | undefined) => Promise<T>): Promise<T> {
        lease.ensureActive();
        try {
          const value = await fn(record.controller?.signal);
          lease.ensureActive();
          return value;
        } catch (error) {
          if (isStaleRequestError(error)) throw error;
          // If the lease went stale while the work was in flight, the outcome —
          // success *or* failure — belongs to a request nobody is waiting for.
          // Report it as staleness so callers stay silent rather than surfacing
          // an error for an account the user already navigated away from.
          lease.ensureActive();
          throw error;
        }
      },

      commit(apply: () => void): boolean {
        if (!lease.active) return false;
        apply();
        return true;
      },

      abort() {
        coordinator.abortRecord(record);
        if (coordinator.lanes.get(lane) === record) coordinator.lanes.delete(lane);
      },
    };

    return lease;
  }
}

/** Shared coordinator for account-scoped Horizon reads. */
export const accountRequests = new RequestCoordinator();

/**
 * Lane names for account-scoped reads.
 *
 * A lane identifies the **state slot being written**, deliberately *not* the
 * account or network being read. There is one `accountData` in the store, so all
 * account loads share one lane and the newest always wins. Keying lanes by
 * address would give each account its own lane, and a slow response for the
 * previous account would no longer be cancelled — exactly the bug in #745.
 */
export const AccountLanes = {
  /** Whole connect flow: resolve → account → transactions → operations. */
  Connect: 'account:connect',
  /** Open offers panel. */
  Offers: 'account:offers',
  /** Account creation date lookup. */
  CreationDate: 'account:creation-date',
} as const;

export type AccountLane = (typeof AccountLanes)[keyof typeof AccountLanes];
