import { useCallback, useEffect, useState } from 'react';

import {
  submissionTracker,
  type SubmissionRecord,
  type StatusUpdate,
  type SubmissionTracker as Tracker,
} from '../lib/submissionTracker';

/**
 * React binding for the shared submission tracker.
 *
 * The tracker itself is a module singleton so that a submission keeps being
 * observed after the view that started it unmounts. This hook only subscribes —
 * it holds no submission state of its own, which is what makes the tray
 * survive navigation.
 */

/** Subscribe to every submission, in flight or finished. */
export function useSubmissions(tracker: Tracker = submissionTracker): SubmissionRecord[] {
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>(() => tracker.list());

  useEffect(() => tracker.subscribe(setSubmissions), [tracker]);

  return submissions;
}

/** Only the submissions still working, newest last. */
export function useActiveSubmissions(tracker: Tracker = submissionTracker): SubmissionRecord[] {
  const submissions = useSubmissions(tracker);

  return submissions.filter(
    (record) => record.status !== 'SUCCESS' && record.status !== 'FAILED' && record.status !== 'EXPIRED',
  );
}

/**
 * Actions for starting and following a submission.
 *
 * The returned `track` registers a submission, `attach` records what the network
 * replied, and `follow` drives polling to a terminal state. Callers that only
 * need the tracker can import it directly; this is the ergonomic path for
 * components.
 */
export function useSubmissionActions(tracker: Tracker = submissionTracker) {
  const track = useCallback(
    (label: string, hash?: string) => tracker.track(label, hash),
    [tracker],
  );

  const attach = useCallback((id: string, update: StatusUpdate) => tracker.attach(id, update), [tracker]);

  const follow = useCallback(
    (id: string, fetchStatus: (_hash: string) => Promise<StatusUpdate>) => tracker.follow(id, fetchStatus),
    [tracker],
  );

  const clearTerminal = useCallback(() => tracker.clearTerminal(), [tracker]);

  return { track, attach, follow, clearTerminal };
}
