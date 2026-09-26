/**
 * Background Job Queue (#826)
 * ===========================
 * A small, dependency-free queue for long-running dashboard work (data
 * exports, contract scans, ML batch jobs). It provides the state transitions
 * the UI needs: queued → running → succeeded / failed / cancelled, plus retry
 * and cancel controls and progress reporting.
 *
 * The queue is intentionally transport-agnostic: callers supply the async work
 * as a function, so it can drive real API jobs in production and deterministic
 * stubs in tests.
 */

export type JobKind = 'export' | 'scan' | 'ml' | 'generic';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobRunContext {
  /** Report progress in the range 0–100. Out-of-range values are clamped. */
  report: (progress: number) => void;
  /** Aborted when the job is cancelled by the user. */
  signal: AbortSignal;
}

export interface Job<T = unknown> {
  id: string;
  label: string;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
  result: T | null;
}

export interface EnqueueOptions<T = unknown> {
  /** Human-readable description shown in the queue UI. Required. */
  label: string;
  /** Category used for grouping / icons. Defaults to `generic`. */
  kind?: JobKind;
  /** The async work to run. Required and must be callable. */
  run: (context: JobRunContext) => Promise<T>;
  /** Maximum attempts (including the first). Defaults to 1. */
  maxAttempts?: number;
}

export interface JobQueueOptions {
  /** Maximum jobs running at once. Defaults to 2. */
  maxConcurrent?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface JobQueueSnapshot {
  jobs: Job[];
  running: number;
  queued: number;
}

type Listener = (snapshot: JobQueueSnapshot) => void;

const DEFAULT_MAX_CONCURRENT = 2;

let jobCounter = 0;

function nextJobId(): string {
  jobCounter += 1;
  return `job-${Date.now().toString(36)}-${jobCounter}`;
}

function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normaliseMaxAttempts(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(10, Math.floor(value)));
}

export class JobQueue {
  private jobs = new Map<string, Job & { run: (context: JobRunContext) => Promise<unknown> }>();
  private listeners = new Set<Listener>();
  private controllers = new Map<string, AbortController>();
  private readonly maxConcurrent: number;
  private readonly now: () => number;

  constructor(options: JobQueueOptions = {}) {
    const concurrency = options.maxConcurrent;
    this.maxConcurrent =
      typeof concurrency === 'number' && Number.isFinite(concurrency) && concurrency > 0
        ? Math.floor(concurrency)
        : DEFAULT_MAX_CONCURRENT;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Add a job to the queue. Throws on invalid input so programming errors
   * surface immediately rather than becoming an invisible stuck job.
   */
  enqueue<T = unknown>(options: EnqueueOptions<T>): string {
    if (!options || typeof options !== 'object') {
      throw new TypeError('enqueue(options) requires an options object');
    }
    if (typeof options.label !== 'string' || options.label.trim().length === 0) {
      throw new TypeError('enqueue requires a non-empty label');
    }
    if (typeof options.run !== 'function') {
      throw new TypeError('enqueue requires a run() function');
    }

    const id = nextJobId();
    const job = {
      id,
      label: options.label.trim(),
      kind: options.kind ?? 'generic',
      status: 'queued' as JobStatus,
      progress: 0,
      attempts: 0,
      maxAttempts: normaliseMaxAttempts(options.maxAttempts),
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      error: null,
      result: null,
      run: options.run as (context: JobRunContext) => Promise<unknown>,
    };
    this.jobs.set(id, job);
    this.notify();
    this.pump();
    return id;
  }

  /** Cancel a queued or running job. Returns false when it cannot be cancelled. */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    job.status = 'cancelled';
    job.finishedAt = this.now();
    this.notify();
    this.pump();
    return true;
  }

  /** Re-queue a failed or cancelled job. Returns false when it is not retryable. */
  retry(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status !== 'failed' && job.status !== 'cancelled') return false;

    job.status = 'queued';
    job.progress = 0;
    job.error = null;
    job.finishedAt = null;
    this.notify();
    this.pump();
    return true;
  }

  /** Remove a terminal job from the queue. */
  remove(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'running' || job.status === 'queued') return false;
    const removed = this.jobs.delete(id);
    if (removed) this.notify();
    return removed;
  }

  /** Immutable snapshot in insertion order. */
  getJobs(): Job[] {
    return [...this.jobs.values()].map(({ run: _run, ...job }) => ({ ...job }));
  }

  getSnapshot(): JobQueueSnapshot {
    const jobs = this.getJobs();
    return {
      jobs,
      running: jobs.filter((j) => j.status === 'running').length,
      queued: jobs.filter((j) => j.status === 'queued').length,
    };
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    if (typeof listener !== 'function') return () => undefined;
    this.listeners.add(listener);
    try {
      listener(this.getSnapshot());
    } catch {
      /* listener errors must not break the queue */
    }
    return () => this.listeners.delete(listener);
  }

  /** Resolve once no jobs are queued or running. */
  async whenIdle(): Promise<void> {
    if (this.getSnapshot().running === 0 && this.getSnapshot().queued === 0) return;
    await new Promise<void>((resolve) => {
      const unsubscribe = this.subscribe((snapshot) => {
        if (snapshot.running === 0 && snapshot.queued === 0) {
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private pump(): void {
    const running = [...this.jobs.values()].filter((j) => j.status === 'running').length;
    let slots = this.maxConcurrent - running;
    if (slots <= 0) return;

    for (const job of this.jobs.values()) {
      if (slots <= 0) break;
      if (job.status !== 'queued') continue;
      slots -= 1;
      void this.start(job);
    }
  }

  private async start(job: Job & { run: (context: JobRunContext) => Promise<unknown> }): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);

    job.status = 'running';
    job.attempts += 1;
    job.startedAt = this.now();
    job.error = null;
    this.notify();

    const context: JobRunContext = {
      signal: controller.signal,
      report: (progress) => {
        if (job.status !== 'running') return;
        job.progress = clampProgress(progress);
        this.notify();
      },
    };

    try {
      const result = await job.run(context);
      if (controller.signal.aborted) return; // cancelled mid-flight
      job.status = 'succeeded';
      job.progress = 100;
      job.result = result ?? null;
      job.error = null;
    } catch (error) {
      if (controller.signal.aborted) return;
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      if (job.attempts < job.maxAttempts) {
        job.status = 'queued';
      }
    } finally {
      if (job.status !== 'queued') {
        job.finishedAt = this.now();
      }
      this.controllers.delete(job.id);
      this.notify();
      this.pump();
    }
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        /* ignore */
      }
    });
  }
}

export default JobQueue;
