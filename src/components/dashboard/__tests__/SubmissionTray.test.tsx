/**
 * Component tests for the submission tray.
 *
 * The tracker is injected so each test drives a known set of submissions instead
 * of relying on module-singleton state.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import SubmissionTray from '../SubmissionTray';
import { SubmissionTracker } from '../../../lib/submissionTracker';

function makeTracker() {
  return new SubmissionTracker({ now: () => 1, sleep: async () => {} });
}

describe('SubmissionTray', () => {
  it('renders nothing when there are no submissions', () => {
    const { container } = render(<SubmissionTray tracker={makeTracker()} />);

    expect(container.firstChild).toBeNull();
  });

  it('labels the region and lists an in-flight submission', () => {
    const tracker = makeTracker();
    tracker.track('Send 25 USDC', 'hash-abc-123');

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByLabelText('Transaction submissions')).toBeTruthy();
    expect(screen.getByText('Send 25 USDC')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('shows a shortened hash rather than the full 64 characters', () => {
    const tracker = makeTracker();
    const hash = `a${'b'.repeat(60)}cdef`;
    tracker.track('Send 25 USDC', hash);

    render(<SubmissionTray tracker={tracker} />);

    // The full hash would overflow the tray; a truncated form keeps it readable.
    expect(screen.queryByText(hash)).toBeNull();
    expect(screen.getByText(`${hash.slice(0, 8)}…${hash.slice(-4)}`)).toBeTruthy();
  });

  it('announces progress politely without stealing focus', () => {
    const tracker = makeTracker();
    tracker.track('Send 25 USDC', 'hash-1');

    render(<SubmissionTray tracker={tracker} />);

    const list = screen.getByRole('list');
    expect(list.getAttribute('aria-live')).toBe('polite');
  });

  it('marks an in-flight submission as busy', () => {
    const tracker = makeTracker();
    tracker.track('Send 25 USDC', 'hash-1');

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByText('Send 25 USDC').closest('li')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows a decoded failure with its suggestion', () => {
    const tracker = makeTracker();
    const record = tracker.track('Send 25 USDC', 'hash-1');
    tracker.poll(record.id, { status: 'ERROR', resultCode: 'tx_insufficient_balance' });

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText(/Insufficient balance/i)).toBeTruthy();
    // The actionable half is the point of decoding the code at all.
    expect(screen.getByText(/Top up|reduce/i)).toBeTruthy();
  });

  it('raises an alert for a failure but not for a success', () => {
    const tracker = makeTracker();
    const failed = tracker.track('Send 25 USDC', 'hash-1');
    tracker.poll(failed.id, { status: 'ERROR', resultCode: 'tx_bad_seq' });
    const ok = tracker.track('Send 5 USDC', 'hash-2');
    tracker.poll(ok.id, { status: 'SUCCESS' });

    render(<SubmissionTray tracker={tracker} />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(within(alerts[0]!).getByText('Send 25 USDC')).toBeTruthy();
  });

  it('reports an expired submission as unconfirmed and warns against resubmitting', () => {
    const tracker = new SubmissionTracker({
      now: () => Date.now(),
      sleep: async () => {},
      expiryMs: 0,
    });
    const record = tracker.track('Send 25 USDC', 'hash-1');
    tracker.poll(record.id, { status: 'PENDING' });

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByText('Unconfirmed')).toBeTruthy();
    expect(screen.getByText(/block explorer/i)).toBeTruthy();
  });

  it('counts pending submissions in the header', () => {
    const tracker = makeTracker();
    tracker.track('Send 25 USDC', 'hash-1');
    const done = tracker.track('Send 5 USDC', 'hash-2');
    tracker.poll(done.id, { status: 'SUCCESS' });

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByText('Submissions (1 pending)')).toBeTruthy();
  });

  it('offers to clear finished submissions once any have completed', () => {
    const tracker = makeTracker();
    const done = tracker.track('Send 5 USDC', 'hash-2');
    tracker.poll(done.id, { status: 'SUCCESS' });

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.getByRole('button', { name: /Clear 1 finished/i })).toBeTruthy();
  });

  it('does not offer a clear button while everything is still in flight', () => {
    const tracker = makeTracker();
    tracker.track('Send 25 USDC', 'hash-1');

    render(<SubmissionTray tracker={tracker} />);

    expect(screen.queryByRole('button', { name: /Clear/i })).toBeNull();
  });

  it('conveys status as text, not colour alone', () => {
    const tracker = makeTracker();
    const record = tracker.track('Send 25 USDC', 'hash-1');
    tracker.poll(record.id, { status: 'SUCCESS' });

    render(<SubmissionTray tracker={tracker} />);

    // A screen reader must be able to tell the states apart.
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });
});
