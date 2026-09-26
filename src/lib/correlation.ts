/**
 * Correlation IDs for frontend diagnostics (#823)
 * ===============================================
 * Propagates a single correlation identifier from a user action all the way
 * through the API client so support engineers can stitch together a browser
 * log line, a Horizon request, and a backend trace.
 *
 * The module is dependency-free and guarded for non-browser environments:
 *   - ID generation prefers `crypto.randomUUID`, falling back to a
 *     time + random scheme when the Web Crypto API is unavailable.
 *   - Nothing is read from `window`/`navigator` at module load time.
 *
 * Usage:
 *   await withCorrelation(async () => {
 *     const api = createCorrelationFetch();
 *     await api('/api/account'); // X-Correlation-ID header is injected
 *   });
 */

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Correlation IDs must be reasonably short and URL/header safe. */
const CORRELATION_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

function randomFallback(): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  const perf =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(36)
      : '0';
  return `${time}-${rand}${perf}`;
}

/**
 * Generate a new correlation id. Never throws, even without Web Crypto.
 */
export function generateCorrelationId(): string {
  try {
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
  } catch {
    /* fall through to the deterministic-ish fallback */
  }
  return randomFallback();
}

/** True when a value is a well-formed correlation id. */
export function isValidCorrelationId(value: unknown): boolean {
  return typeof value === 'string' && CORRELATION_ID_RE.test(value);
}

/**
 * Normalise arbitrary input into a usable correlation id. Invalid values are
 * discarded and a fresh id is generated rather than propagating junk upstream.
 */
export function normaliseCorrelationId(value: unknown): string {
  if (isValidCorrelationId(value)) return value as string;
  return generateCorrelationId();
}

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * Lightweight, stack-based correlation context. Sufficient for the dashboard's
 * request-scoped usage where work is sequential per user action.
 */
class CorrelationContext {
  private stack: string[] = [];

  /** The id for the currently executing scope, if any. */
  current(): string | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  /**
   * Run `fn` with `id` as the active correlation id. Works for sync and async
   * functions; the id is popped once the returned value settles.
   */
  run<T>(id: string, fn: () => T): T {
    const safeId = normaliseCorrelationId(id);
    this.stack.push(safeId);
    let result: T;
    try {
      result = fn();
    } catch (error) {
      this.stack.pop();
      throw error;
    }
    if (result && typeof (result as unknown as Promise<unknown>).then === 'function') {
      return (result as unknown as Promise<unknown>)
        .then((value) => {
          this.stack.pop();
          return value;
        })
        .catch((error) => {
          this.stack.pop();
          throw error;
        }) as unknown as T;
    }
    this.stack.pop();
    return result;
  }
}

export const correlationContext = new CorrelationContext();

/** Id active in the current scope, or `null`. */
export function getCorrelationId(): string | null {
  return correlationContext.current();
}

/**
 * Run a function inside a correlation scope.
 *
 * Accepts either an explicit id or a function; when called with a function the
 * id is generated automatically.
 */
export function withCorrelation<T>(idOrFn: string | (() => T), maybeFn?: () => T): T {
  if (typeof idOrFn === 'function') {
    return correlationContext.run(generateCorrelationId(), idOrFn as () => T);
  }
  if (typeof maybeFn !== 'function') {
    throw new TypeError('withCorrelation(id, fn) requires a function');
  }
  return correlationContext.run(normaliseCorrelationId(idOrFn), maybeFn);
}

// ─── Fetch instrumentation ────────────────────────────────────────────────────

export interface CorrelationFetchError extends Error {
  correlationId: string;
}

function makeCorrelationError(message: string, correlationId: string, cause?: unknown): CorrelationFetchError {
  const error = new Error(message) as CorrelationFetchError;
  error.correlationId = correlationId;
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

export interface CorrelationFetchOptions {
  /** Override the underlying fetch implementation (useful for tests / Node). */
  baseFetch?: typeof fetch;
  /** Resolve the id per call; defaults to the active correlation context. */
  getId?: () => string | null;
  /** Skip header injection entirely (e.g. for third-party origins). */
  shouldInstrument?: (input: RequestInfo | URL) => boolean;
  /** Receives the correlation id whenever a request fails. */
  onError?: (correlationId: string, error: unknown) => void;
}

/**
 * Wrap `fetch` so every instrumented request carries `X-Correlation-ID`.
 *
 * When the underlying request fails the rejected error is decorated with a
 * `correlationId` property so callers can surface it in error reports.
 */
export function createCorrelationFetch(options: CorrelationFetchOptions = {}): typeof fetch {
  const baseFetch = options.baseFetch ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const getId = options.getId ?? getCorrelationId;
  const shouldInstrument = options.shouldInstrument ?? (() => true);

  if (!baseFetch) {
    // Unsupported environment — return a reject-only stub rather than crashing.
    return ((() => Promise.reject(makeCorrelationError('fetch is unavailable in this environment', generateCorrelationId()))) as unknown) as typeof fetch;
  }

  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const correlationId = normaliseCorrelationId(getId());
    let finalInit = init;

    if (shouldInstrument(input)) {
      const headers = new Headers(init?.headers ?? undefined);
      if (!headers.has(CORRELATION_ID_HEADER)) {
        headers.set(CORRELATION_ID_HEADER, correlationId);
      }
      finalInit = { ...(init ?? {}), headers };
    }

    try {
      return await baseFetch(input, finalInit);
    } catch (error) {
      options.onError?.(correlationId, error);
      throw makeCorrelationError(
        error instanceof Error ? error.message : 'Request failed',
        correlationId,
        error
      );
    }
  }) as typeof fetch;
}

/**
 * Extract a correlation id from a response's headers, falling back to the
 * currently active context. Returns `null` when neither is available.
 */
export function extractCorrelationId(headers: Headers | null | undefined): string | null {
  try {
    const fromHeader = headers?.get?.(CORRELATION_ID_HEADER) ?? null;
    if (isValidCorrelationId(fromHeader)) return fromHeader;
  } catch {
    /* ignore malformed Headers implementations */
  }
  return getCorrelationId();
}
