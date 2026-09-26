import { useSyncExternalStore } from 'react';
import {
  getMlRuntimeState,
  subscribeToMlRuntime,
  type MlRuntimeStatus,
} from '../lib/mlRuntime';

export interface UseMlRuntimeReturn {
  status: MlRuntimeStatus;
  /** True while the ML runtime is being fetched — render a spinner/label. */
  isLoading: boolean;
  /** Set when the dynamic import of `@tensorflow/tfjs` failed. */
  error: Error | null;
}

/**
 * React binding for the lazy ML runtime facade (#969).
 *
 * Components that trigger ML work can use this to show a loading state instead
 * of blocking on a multi-hundred-KB download:
 *
 * ```tsx
 * const { isLoading } = useMlRuntime();
 * <button>{isLoading ? 'Loading ML runtime…' : 'Run analysis'}</button>
 * ```
 */
export function useMlRuntime(): UseMlRuntimeReturn {
  const state = useSyncExternalStore(subscribeToMlRuntime, getMlRuntimeState, getMlRuntimeState);

  return {
    status: state.status,
    isLoading: state.status === 'loading',
    error: state.error,
  };
}

export default useMlRuntime;
