/**
 * useApiDegradation (#821)
 *
 * Thin React binding around the pure `evaluateApiDegradation` model. It keeps a
 * retry-attempt counter and recomputes the banner whenever the upstream health
 * signals change. The hook is intentionally side-effect free beyond the counter
 * so it can be unit tested without a running network.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  evaluateApiDegradation,
  type DegradationBanner,
  type ServiceStatusInput,
} from '../lib/apiDegradation';

export interface UseApiDegradationResult {
  /** Full banner model (headline, detail, retry guidance). */
  banner: DegradationBanner;
  /** True when the banner should be rendered. */
  visible: boolean;
  /** Current retry attempt (zero-based). */
  attempt: number;
  /** Increment the attempt counter — call this from a Retry button. */
  retry: () => void;
  /** Reset the attempt counter (e.g. after a successful probe). */
  reset: () => void;
}

export function useApiDegradation(statuses: ServiceStatusInput[] = []): UseApiDegradationResult {
  const [attempt, setAttempt] = useState(0);

  const banner = useMemo(
    () => evaluateApiDegradation(Array.isArray(statuses) ? statuses : [], { attempt }),
    [statuses, attempt]
  );

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const reset = useCallback(() => setAttempt(0), []);

  return { banner, visible: banner.visible, attempt, retry, reset };
}

export default useApiDegradation;
