# Background job queue

Long-running dashboard work — data exports, contract scans, and ML batches —
used to run invisibly. The background job queue gives users visibility and
control: live progress, clear failure states, and cancel / retry buttons.

## API

`src/lib/jobQueue.ts`

```ts
const queue = new JobQueue({ maxConcurrent: 2 });

const id = queue.enqueue({
  label: 'Export ledger history',
  kind: 'export',
  maxAttempts: 3,
  run: async ({ report, signal }) => {
    report(10);
    const data = await fetchExport({ signal });
    report(100);
    return data;
  },
});

queue.cancel(id); // abort a queued/running job
queue.retry(id);  // re-queue a failed/cancelled job
await queue.whenIdle();
```

| State       | Meaning                                             |
| ----------- | --------------------------------------------------- |
| `queued`    | Waiting for a concurrency slot                      |
| `running`   | Currently executing (progress 0–100)                |
| `succeeded` | Completed successfully (progress forced to 100)     |
| `failed`    | Exhausted attempts, or failed permanently           |
| `cancelled` | Cancelled by the user (aborts the job's `signal`)   |

## React usage

```tsx
import BackgroundJobQueue from '../components/dashboard/BackgroundJobQueue';

<BackgroundJobQueue title="Long-running tasks" />;
```

`useJobQueue(existingQueue?, options?)` binds a queue to React state. Pass a
shared queue instance to render multiple views of the same jobs.

## Invalid input, unsupported environments, and failure paths

- `enqueue` throws `TypeError` for a missing label or non-function `run`.
- `maxAttempts` is clamped to `1..10`; non-numeric values become `1`.
- `report()` clamps out-of-range or non-finite progress to `0..100`.
- Cancelling aborts the supplied `AbortSignal` and is idempotent.
- Failures are captured with their message and auto-retried up to
  `maxAttempts` before settling on `failed`.
- The module has no browser-only dependencies and is safe under SSR.

## Testing

`src/lib/__tests__/jobQueue.test.ts` covers the primary flow, boundary cases
(invalid input, clamping, concurrency limit, no-op cancel/retry), and failure
paths (manual retry, automatic retry exhaustion, cancellation + abort). Run
`pnpm run test -- jobQueue`.
