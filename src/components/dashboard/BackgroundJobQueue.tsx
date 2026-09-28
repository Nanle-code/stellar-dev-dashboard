/**
 * BackgroundJobQueue (#826)
 *
 * Dashboard surface for long-running tasks (exports, scans, ML batches). Shows
 * live progress, failures, and cancel/retry controls. State comes from
 * `useJobQueue`, so the component can be dropped anywhere in the layout.
 */

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Loader2, RotateCw, Trash2, X } from 'lucide-react';
import { useJobQueue } from '../../hooks/useJobQueue';
import type { Job, JobQueue } from '../../lib/jobQueue';

export interface BackgroundJobQueueProps {
  /** Optional shared queue. A private queue is created when omitted. */
  queue?: JobQueue;
  title?: string;
  /** Limit the number of rendered rows (newest first). */
  maxVisible?: number;
}

const STATUS_META: Record<Job['status'], { label: string; color: string }> = {
  queued: { label: 'Queued', color: '#9ca3af' },
  running: { label: 'Running', color: '#0ea5e9' },
  succeeded: { label: 'Succeeded', color: '#22c55e' },
  failed: { label: 'Failed', color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#f59e0b' },
};

function StatusIcon({ status }: { status: Job['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 size={14} className="animate-spin" aria-hidden="true" />;
    case 'succeeded':
      return <CheckCircle2 size={14} aria-hidden="true" />;
    case 'failed':
      return <AlertCircle size={14} aria-hidden="true" />;
    default:
      return <Clock size={14} aria-hidden="true" />;
  }
}

export default function BackgroundJobQueue({ queue, title = 'Background jobs', maxVisible = 8 }: BackgroundJobQueueProps) {
  const { jobs, cancel, retry, remove } = useJobQueue(queue);
  const visible = jobs.slice(-maxVisible).reverse();

  return (
    <section
      aria-label={title}
      data-testid="background-job-queue"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        background: 'var(--bg-elevated, #1e2327)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)' }}>
          {jobs.length} total
        </span>
      </header>

      {visible.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>
          No background tasks yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((job) => {
            const meta = STATUS_META[job.status];
            const canCancel = job.status === 'queued' || job.status === 'running';
            const canRetry = job.status === 'failed' || job.status === 'cancelled';
            const canRemove = !canCancel;

            return (
              <li
                key={job.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: meta.color, display: 'inline-flex' }}>
                    <StatusIcon status={job.status} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.label}
                  </span>
                  <span style={{ fontSize: 10, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {meta.label}
                  </span>

                  {canCancel && (
                    <button type="button" aria-label={`Cancel ${job.label}`} onClick={() => cancel(job.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  {canRetry && (
                    <button type="button" aria-label={`Retry ${job.label}`} onClick={() => retry(job.id)} style={{ background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer' }}>
                      <RotateCw size={14} aria-hidden="true" />
                    </button>
                  )}
                  {canRemove && (
                    <button type="button" aria-label={`Remove ${job.label}`} onClick={() => remove(job.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted, #6b7280)', cursor: 'pointer' }}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {job.status === 'running' && (
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(job.progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${job.label} progress`}
                    style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }}
                  >
                    <div style={{ width: `${job.progress}%`, height: '100%', borderRadius: 999, background: meta.color, transition: 'width 200ms ease' }} />
                  </div>
                )}

                {job.error && (
                  <span style={{ fontSize: 11, color: '#ef4444' }}>
                    {job.error}
                    {job.attempts > 1 ? ` (attempt ${job.attempts}/${job.maxAttempts})` : ''}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
