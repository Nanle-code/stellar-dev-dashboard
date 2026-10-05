import { describe, expect, it } from 'vitest';
import { JobQueue } from '../jobQueue';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('JobQueue — primary flow', () => {
  it('runs a job to completion and records progress + result', async () => {
    const queue = new JobQueue();
    const id = queue.enqueue({
      label: 'Export transactions',
      kind: 'export',
      run: async ({ report }) => {
        report(25);
        report(150); // clamped to 100
        return { rows: 3 };
      },
    });

    await queue.whenIdle();

    const job = queue.getJobs().find((j) => j.id === id);
    expect(job?.status).toBe('succeeded');
    expect(job?.progress).toBe(100);
    expect(job?.result).toEqual({ rows: 3 });
    expect(job?.attempts).toBe(1);
  });

  it('notifies subscribers with snapshots', async () => {
    const queue = new JobQueue();
    const states: string[] = [];
    queue.subscribe((snapshot) => {
      if (snapshot.jobs[0]) states.push(snapshot.jobs[0].status);
    });

    queue.enqueue({ label: 'Scan contracts', kind: 'scan', run: async () => undefined });
    await queue.whenIdle();

    expect(states).toContain('queued');
    expect(states).toContain('running');
    expect(states).toContain('succeeded');
  });
});

describe('JobQueue — boundary cases', () => {
  it('rejects invalid enqueue input', () => {
    const queue = new JobQueue();
    expect(() => queue.enqueue({ label: '   ', run: async () => undefined })).toThrow(TypeError);
    expect(() => queue.enqueue({ label: 'x', run: undefined as unknown as () => Promise<void> })).toThrow(TypeError);
    expect(() => queue.enqueue(null as unknown as never)).toThrow(TypeError);
  });

  it('clamps maxAttempts into the supported range', async () => {
    const queue = new JobQueue();
    const id = queue.enqueue({
      label: 'ML batch',
      kind: 'ml',
      maxAttempts: 999,
      run: async () => undefined,
    });
    await queue.whenIdle();
    expect(queue.getJobs().find((j) => j.id === id)?.maxAttempts).toBe(10);
  });

  it('refuses to cancel or remove jobs in a non-cancellable state', async () => {
    const queue = new JobQueue();
    const id = queue.enqueue({ label: 'Done already', run: async () => undefined });
    await queue.whenIdle();
    expect(queue.cancel(id)).toBe(false);
    expect(queue.retry(id)).toBe(false);
    expect(queue.cancel('does-not-exist')).toBe(false);
  });

  it('honours the concurrency limit', async () => {
    const queue = new JobQueue({ maxConcurrent: 1 });
    const gate = deferred();
    queue.enqueue({ label: 'first', run: async () => gate.promise });
    queue.enqueue({ label: 'second', run: async () => undefined });

    await new Promise((r) => setTimeout(r, 5));
    expect(queue.getSnapshot().running).toBe(1);
    expect(queue.getSnapshot().queued).toBe(1);

    gate.resolve();
    await queue.whenIdle();
    expect(queue.getSnapshot().running).toBe(0);
    expect(queue.getSnapshot().queued).toBe(0);
  });
});

describe('JobQueue — failure paths', () => {
  it('captures failures and allows a manual retry', async () => {
    const queue = new JobQueue();
    let attempt = 0;
    const id = queue.enqueue({
      label: 'Flaky export',
      run: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('upstream 503');
        return 'ok';
      },
    });

    await queue.whenIdle();
    let job = queue.getJobs().find((j) => j.id === id);
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('upstream 503');

    expect(queue.retry(id)).toBe(true);
    await queue.whenIdle();
    job = queue.getJobs().find((j) => j.id === id);
    expect(job?.status).toBe('succeeded');
    expect(job?.result).toBe('ok');
  });

  it('auto-retries up to maxAttempts before failing permanently', async () => {
    const queue = new JobQueue();
    let attempts = 0;
    queue.enqueue({
      label: 'Always failing',
      maxAttempts: 2,
      run: async () => {
        attempts += 1;
        throw new Error('nope');
      },
    });

    await queue.whenIdle();
    expect(attempts).toBe(2);
    expect(queue.getJobs()[0].status).toBe('failed');
    expect(queue.getJobs()[0].attempts).toBe(2);
  });

  it('cancels a running job and aborts its signal', async () => {
    const queue = new JobQueue({ maxConcurrent: 1 });
    const gate = deferred();
    let aborted = false;
    const id = queue.enqueue({
      label: 'Long scan',
      run: async ({ signal }) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        await gate.promise;
      },
    });

    await new Promise((r) => setTimeout(r, 5));
    expect(queue.cancel(id)).toBe(true);
    expect(aborted).toBe(true);
    expect(queue.getJobs().find((j) => j.id === id)?.status).toBe('cancelled');
    gate.resolve();
  });
});
