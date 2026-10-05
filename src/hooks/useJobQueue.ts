/**
 * useJobQueue (#826)
 *
 * React binding for `JobQueue`. Accepts an optional externally-created queue so
 * a single queue can be shared across the app (and injected in tests), and
 * otherwise creates its own instance tied to the component lifecycle.
 */

import { useEffect, useRef, useState } from 'react';
import {
  JobQueue,
  type EnqueueOptions,
  type Job,
  type JobQueueOptions,
  type JobQueueSnapshot,
} from '../lib/jobQueue';

export interface UseJobQueueResult {
  jobs: Job[];
  running: number;
  queued: number;
  enqueue: <T = unknown>(options: EnqueueOptions<T>) => string;
  cancel: (id: string) => boolean;
  retry: (id: string) => boolean;
  remove: (id: string) => boolean;
  whenIdle: () => Promise<void>;
}

export function useJobQueue(existing?: JobQueue, options: JobQueueOptions = {}): UseJobQueueResult {
  const internalRef = useRef<JobQueue | null>(null);
  if (!existing && !internalRef.current) {
    internalRef.current = new JobQueue(options);
  }
  const queue = existing ?? internalRef.current;

  if (!queue) {
    throw new Error('useJobQueue: failed to create a JobQueue instance');
  }

  const [snapshot, setSnapshot] = useState<JobQueueSnapshot>(() => queue.getSnapshot());

  useEffect(() => queue.subscribe(setSnapshot), [queue]);

  return {
    jobs: snapshot.jobs,
    running: snapshot.running,
    queued: snapshot.queued,
    enqueue: (opts) => queue.enqueue(opts),
    cancel: (id) => queue.cancel(id),
    retry: (id) => queue.retry(id),
    remove: (id) => queue.remove(id),
    whenIdle: () => queue.whenIdle(),
  };
}

export default useJobQueue;
