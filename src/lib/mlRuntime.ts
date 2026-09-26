/**
 * Lazy ML runtime facade (#969).
 *
 * `@tensorflow/tfjs` is the heaviest dependency in the app (~1 MB pre-minify,
 * a few hundred KB gzipped). Any *static* import of it that is reachable from
 * the app shell or the Overview route pulls the whole library into the first
 * load for every user, even for people who never touch an ML feature.
 *
 * Rules for this file:
 *
 * 1. `@tensorflow/tfjs` may only be reached through `loadTfjs()` below. Never
 *    `import * as tf from '@tensorflow/tfjs'` anywhere else in `src/` — use
 *    `import type { ... } from '@tensorflow/tfjs'` for types instead, which is
 *    erased at build time and therefore free.
 * 2. `import('@tensorflow/tfjs')` is a dynamic import, so Rollup emits it as a
 *    separate chunk that is only fetched when a view actually runs inference.
 * 3. Consumers can pair the loader with `useMlRuntime()` to render a loading
 *    state while the runtime is on the wire.
 *
 * The module promise is memoized, so concurrent consumers (two panels opening
 * at once, React strict-mode double effects, ...) share a single download.
 */

export type TfjsModule = typeof import('@tensorflow/tfjs');

export type MlRuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MlRuntimeState {
  /** `idle` until something asks for the runtime. */
  status: MlRuntimeStatus;
  /** Populated when the dynamic import rejected. */
  error: Error | null;
}

let tfjsPromise: Promise<TfjsModule> | null = null;
let cachedModule: TfjsModule | null = null;
let state: MlRuntimeState = { status: 'idle', error: null };
const listeners = new Set<(state: MlRuntimeState) => void>();

function setState(next: MlRuntimeState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

/** Current ML runtime status. */
export function getMlRuntimeState(): MlRuntimeState {
  return state;
}

/**
 * Subscribe to ML runtime status changes (used by `useMlRuntime`).
 * Returns an unsubscribe function.
 */
export function subscribeToMlRuntime(listener: (state: MlRuntimeState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Load (and memoize) the TensorFlow.js runtime.
 *
 * The first call flips the facade to `loading`; every caller shares the same
 * promise so the library is downloaded exactly once per page. A failed import
 * clears the memoized promise so a later interaction can retry, and the error
 * is surfaced through `getMlRuntimeState()`.
 */
export function loadTfjs(): Promise<TfjsModule> {
  if (tfjsPromise) return tfjsPromise;

  setState({ status: 'loading', error: null });
  tfjsPromise = import('@tensorflow/tfjs')
    .then((tf) => {
      setState({ status: 'ready', error: null });
      return tf;
    })
    .catch((error: unknown) => {
      tfjsPromise = null;
      setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    });

  return tfjsPromise;
}

/** True once the runtime has been resolved. Useful for diagnostics and tests. */
export function isTfjsLoaded(): boolean {
  return state.status === 'ready';
}

/**
 * Load the runtime and remember it on the module, so the synchronous call sites
 * in the ML libraries (tensor creation, `model.predict()`) can grab it with
 * `requireTfRuntime()` / `getTfRuntime()` without turning their whole API async.
 */
export async function loadTfRuntime(): Promise<TfjsModule> {
  cachedModule = await loadTfjs();
  return cachedModule;
}

/** The runtime for synchronous call sites; throws if it was never loaded. */
export function requireTfRuntime(): TfjsModule {
  if (!cachedModule) {
    throw new Error('TensorFlow.js runtime is not loaded yet — await loadTfRuntime() first');
  }
  return cachedModule;
}

/** The runtime if loaded, otherwise `null` (callers can fall back to heuristics). */
export function getTfRuntime(): TfjsModule | null {
  return cachedModule;
}

/** Test helper: forget the memoized module, status and subscribers. */
export function resetMlRuntime(): void {
  tfjsPromise = null;
  cachedModule = null;
  state = { status: 'idle', error: null };
  listeners.clear();
}
