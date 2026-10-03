/**
 * Tests for the shared submission tracker.
 *
 * The clock and the sleep function are injected, so retry backoff and expiry are
 * exercised without any real waiting.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SubmissionTracker,
  TERMINAL_STATUSES,
  decodeSubmissionError,
  type SubmissionRecord,
  type StatusUpdate,
} from '../submissionTracker'

/** A tracker whose clock is advanced by the test, and which never really waits. */
function makeTracker(overrides: Partial<ConstructorParameters<typeof SubmissionTracker>[0]> = {}) {
  let clock = 1_700_000_000_000
  const sleep = vi.fn(async () => {})
  const tracker = new SubmissionTracker({
    now: () => clock,
    sleep,
    baseBackoffMs: 100,
    maxBackoffMs: 800,
    expiryMs: 5_000,
    maxAttempts: 10,
    ...overrides,
  })

  return {
    tracker,
    sleep,
    advance: (ms: number) => {
      clock += ms
    },
    now: () => clock,
  }
}

describe('decodeSubmissionError', () => {
  it('decodes a known result code into a message and a fix', () => {
    const decoded = decodeSubmissionError('tx_insufficient_balance')

    expect(decoded.code).toBe('tx_insufficient_balance')
    expect(decoded.message).toMatch(/Insufficient balance/i)
    expect(decoded.suggestion).toMatch(/Top up|reduce/i)
  })

  it('uses the first error code when no top-level result code is given', () => {
    const decoded = decodeSubmissionError(undefined, ['op_underfunded', 'tx_bad_seq'])

    expect(decoded.code).toBe('op_underfunded')
    // The message comes from the shared ERROR_MESSAGES/STELLAR_ERROR_CODES map;
    // the actionable half is what this module contributes.
    expect(decoded.message).toMatch(/Insufficient balance/i)
    expect(decoded.suggestion).toMatch(/cannot cover amount plus fee|Top up|reduce/i)
  })

  it('still returns actionable copy for an unknown code', () => {
    const decoded = decodeSubmissionError('tx_something_new')

    expect(decoded.code).toBe('tx_something_new')
    expect(decoded.message).toContain('tx_something_new')
    expect(decoded.suggestion).not.toBe('')
  })

  it('handles a failure with no codes at all', () => {
    const decoded = decodeSubmissionError()

    expect(decoded.code).toBeUndefined()
    expect(decoded.suggestion).toMatch(/block explorer/i)
  })
})

describe('tracking a submission', () => {
  let harness: ReturnType<typeof makeTracker>

  beforeEach(() => {
    harness = makeTracker()
  })

  it('starts in SUBMITTING when no hash is known yet', () => {
    const record = harness.tracker.track('Send 25 USDC')

    expect(record.status).toBe('SUBMITTING')
    expect(record.hash).toBeUndefined()
    expect(record.attempts).toBe(0)
  })

  it('starts in PENDING when the hash is already known', () => {
    const record = harness.tracker.track('Send 25 USDC', 'abc123')

    expect(record.status).toBe('PENDING')
    expect(record.hash).toBe('abc123')
  })

  it('gives every submission a distinct id', () => {
    const first = harness.tracker.track('a')
    harness.advance(10)
    const second = harness.tracker.track('b')

    expect(first.id).not.toBe(second.id)
  })

  it('lists submissions oldest first', () => {
    harness.tracker.track('first')
    harness.advance(1000)
    harness.tracker.track('second')

    expect(harness.tracker.list().map((r) => r.label)).toEqual(['first', 'second'])
  })

  it('returns a copy so callers cannot mutate tracker state', () => {
    const record = harness.tracker.track('Send 25 USDC')
    record.status = 'SUCCESS'

    expect(harness.tracker.get(record.id)?.status).toBe('SUBMITTING')
  })

  it('ignores updates for an unknown submission', () => {
    expect(harness.tracker.attach('nope', { status: 'PENDING' })).toBeUndefined()
  })
})

describe('status transitions', () => {
  let harness: ReturnType<typeof makeTracker>

  beforeEach(() => {
    harness = makeTracker()
  })

  it('records acceptance of a submitted transaction', () => {
    const record = harness.tracker.track('Send 25 USDC')
    const updated = harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    expect(updated?.status).toBe('PENDING')
    expect(updated?.hash).toBe('hash-1')
  })

  it('treats DUPLICATE as still in flight, not a failure', () => {
    const record = harness.tracker.track('Send 25 USDC')
    const updated = harness.tracker.attach(record.id, {
      status: 'DUPLICATE',
      hash: 'original-hash',
    })

    // A duplicate means the transaction is already in the mempool, so polling
    // must continue rather than reporting a terminal state.
    expect(updated?.status).toBe('PENDING')
    expect(updated?.duplicateOf).toBe('original-hash')
  })

  it('fails on ERROR and attaches a decoded error', () => {
    const record = harness.tracker.track('Send 25 USDC')
    const updated = harness.tracker.attach(record.id, {
      status: 'ERROR',
      resultCode: 'tx_insufficient_balance',
    })

    expect(updated?.status).toBe('FAILED')
    expect(updated?.error?.code).toBe('tx_insufficient_balance')
    expect(updated?.error?.suggestion).toBeTruthy()
  })

  it('reaches SUCCESS and stops polling', () => {
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    expect(harness.tracker.poll(record.id, { status: 'SUCCESS' })).toBeNull()
    expect(harness.tracker.get(record.id)?.status).toBe('SUCCESS')
  })

  it('does not move a terminal record any further', () => {
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'ERROR', resultCode: 'tx_bad_seq' })

    harness.tracker.poll(record.id, { status: 'SUCCESS' })
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'late' })

    expect(harness.tracker.get(record.id)?.status).toBe('FAILED')
  })

  it('counts attempts and keeps a non-terminal status pending', () => {
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    harness.tracker.poll(record.id, { status: 'PENDING' })
    harness.tracker.poll(record.id, { status: 'PENDING' })

    expect(harness.tracker.get(record.id)?.attempts).toBe(2)
    expect(harness.tracker.get(record.id)?.status).toBe('PENDING')
  })
})

describe('TRY_AGAIN_LATER backoff', () => {
  it('backs off exponentially and caps at maxBackoffMs', () => {
    const { tracker } = makeTracker()
    const record = tracker.track('Send 25 USDC')

    const delays: (number | null)[] = [];
    for (let i = 0; i < 6; i += 1) {
      delays.push(tracker.poll(record.id, { status: 'TRY_AGAIN_LATER' }))
    }

    // base 100, doubling, capped at 800.
    expect(delays).toEqual([100, 200, 400, 800, 800, 800])
  })

  it('surfaces TRY_AGAIN_LATER in the record while backing off', () => {
    const { tracker } = makeTracker()
    const record = tracker.track('Send 25 USDC')

    tracker.poll(record.id, { status: 'TRY_AGAIN_LATER' })

    expect(tracker.get(record.id)?.status).toBe('TRY_AGAIN_LATER')
  })

  it('exposes the same backoff curve for callers polling by hand', () => {
    const { tracker } = makeTracker()

    expect([1, 2, 3, 4, 5].map((n) => tracker.backoffFor(n))).toEqual([100, 200, 400, 800, 800])
  })
})

describe('expiry', () => {
  it('expires a still-pending submission once the deadline passes', () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    harness.advance(4_000)
    expect(harness.tracker.poll(record.id, { status: 'PENDING' })).not.toBeNull()

    harness.advance(2_000) // now past expiryMs of 5_000
    expect(harness.tracker.poll(record.id, { status: 'PENDING' })).toBeNull()

    const expired = harness.tracker.get(record.id)
    expect(expired?.status).toBe('EXPIRED')
    expect(expired?.error?.message).toMatch(/still PENDING/i)
  })

  it('explains that the transaction may still finalise', () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    harness.advance(6_000)
    harness.tracker.poll(record.id, { status: 'PENDING' })

    // Resubmitting an already-landed transaction is the costly mistake, so the
    // message has to steer the user to the explorer.
    expect(harness.tracker.get(record.id)?.error?.suggestion).toMatch(/block explorer/i)
  })

  it('does not expire a transaction that succeeded', () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    harness.advance(10_000)
    harness.tracker.poll(record.id, { status: 'SUCCESS' })

    expect(harness.tracker.get(record.id)?.status).toBe('SUCCESS')
  })

  it('gives up after maxAttempts even when the deadline has not passed', () => {
    const harness = makeTracker({ maxAttempts: 3, expiryMs: 10_000_000 })
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    harness.tracker.poll(record.id, { status: 'PENDING' })
    harness.tracker.poll(record.id, { status: 'PENDING' })
    expect(harness.tracker.poll(record.id, { status: 'PENDING' })).toBeNull()

    expect(harness.tracker.get(record.id)?.status).toBe('EXPIRED')
    expect(harness.tracker.get(record.id)?.error?.message).toMatch(/Gave up after 3/i)
  })

  it('treats every terminal status as terminal', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['EXPIRED', 'FAILED', 'SUCCESS'])
  })
})

describe('follow', () => {
  it('polls until the transaction succeeds', async () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    const updates: StatusUpdate[] = [
      { status: 'PENDING' },
      { status: 'PENDING' },
      { status: 'SUCCESS' },
    ]
    const fetchStatus = vi.fn(async () => updates.shift()!)

    const final = await harness.tracker.follow(record.id, fetchStatus)

    expect(fetchStatus).toHaveBeenCalledTimes(3)
    expect(final?.status).toBe('SUCCESS')
  })

  it('keeps polling when the network asks to try again later', async () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    const updates: StatusUpdate[] = [
      { status: 'TRY_AGAIN_LATER' },
      { status: 'TRY_AGAIN_LATER' },
      { status: 'SUCCESS' },
    ]
    const fetchStatus = vi.fn(async () => updates.shift()!)

    const final = await harness.tracker.follow(record.id, fetchStatus)

    expect(final?.status).toBe('SUCCESS')
    // Waits are 100 (the ordinary poll interval before the first response),
    // then 100, then 200 — each successive TRY_AGAIN_LATER doubles the delay.
    expect(harness.sleep).toHaveBeenNthCalledWith(1, 100)
    expect(harness.sleep).toHaveBeenNthCalledWith(2, 100)
    expect(harness.sleep).toHaveBeenNthCalledWith(3, 200)
  })

  it('treats a failing poll as still pending rather than a failed transaction', async () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    const fetchStatus = vi
      .fn(async (): Promise<StatusUpdate> => ({ status: 'SUCCESS' }))
      .mockRejectedValueOnce(new Error('network down'))

    const final = await harness.tracker.follow(record.id, fetchStatus)

    // A transport error says nothing about whether the transaction landed.
    expect(final?.status).toBe('SUCCESS')
  })

  it('stops immediately when the transaction fails', async () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    harness.tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })

    const fetchStatus = vi.fn(async () => ({ status: 'ERROR' as const, resultCode: 'tx_bad_seq' }))

    const final = await harness.tracker.follow(record.id, fetchStatus)

    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(final?.status).toBe('FAILED')
    expect(final?.error?.code).toBe('tx_bad_seq')
  })

  it('does nothing when there is no hash to poll', async () => {
    const harness = makeTracker()
    const record = harness.tracker.track('Send 25 USDC')
    const fetchStatus = vi.fn(async () => ({ status: 'SUCCESS' as const }))

    await harness.tracker.follow(record.id, fetchStatus)

    expect(fetchStatus).not.toHaveBeenCalled()
  })
})

describe('subscribers and cleanup', () => {
  it('notifies subscribers on every change', () => {
    const { tracker } = makeTracker()
    const listener = vi.fn()

    tracker.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1) // immediate snapshot

    const record = tracker.track('Send 25 USDC')
    tracker.attach(record.id, { status: 'PENDING', hash: 'hash-1' })
    tracker.poll(record.id, { status: 'SUCCESS' })

    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('hands subscribers an immutable snapshot', () => {
    const { tracker } = makeTracker()
    let seen: SubmissionRecord[] = []
    tracker.subscribe((records) => {
      seen = records
    })

    tracker.track('Send 25 USDC')
    seen[0]!.status = 'SUCCESS'

    expect(tracker.list()[0]?.status).toBe('SUBMITTING')
  })

  it('stops notifying after unsubscribe', () => {
    const { tracker } = makeTracker()
    const listener = vi.fn()
    const unsubscribe = tracker.subscribe(listener)

    unsubscribe()
    tracker.track('Send 25 USDC')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clears terminal records but keeps in-flight ones', () => {
    const { tracker } = makeTracker()
    const done = tracker.track('Done')
    tracker.poll(done.id, { status: 'SUCCESS' })
    const pending = tracker.track('Pending', 'hash-1')

    tracker.clearTerminal()

    expect(tracker.list().map((r) => r.id)).toEqual([pending.id])
  })
})
