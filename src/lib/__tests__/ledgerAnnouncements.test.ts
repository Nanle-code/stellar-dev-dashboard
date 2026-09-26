/**
 * Tests for the ledger stream announcement coalescer (#872).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLedgerAnnouncement,
  createLedgerAnnouncer,
  DEFAULT_WINDOW_MS,
  isLedgerUpdate,
} from '../ledgerAnnouncements'
import type { RealTimeNotification } from '../websocket/StreamTypes'

function notif(
  id: string,
  title: string,
  message = 'message',
): RealTimeNotification {
  return {
    id,
    title,
    message,
    level: 'info',
    timestamp: Date.now(),
    read: false,
  }
}

describe('isLedgerUpdate', () => {
  it('accepts every ledger/transaction stream title', () => {
    for (const title of [
      'Incoming payment',
      'Outgoing payment',
      'Account credited',
      'Account debited',
      'Signer change',
      'New transaction',
    ]) {
      expect(isLedgerUpdate(notif('1', title))).toBe(true)
    }
  })

  it('rejects non-ledger and malformed values', () => {
    expect(isLedgerUpdate(notif('1', 'Low balance warning'))).toBe(false)
    expect(isLedgerUpdate(null)).toBe(false)
    expect(isLedgerUpdate(undefined)).toBe(false)
    expect(isLedgerUpdate({})).toBe(false)
    expect(isLedgerUpdate(42)).toBe(false)
    expect(isLedgerUpdate({ title: 123 })).toBe(false)
  })
})

describe('buildLedgerAnnouncement', () => {
  it('returns an empty string for an empty or irrelevant batch', () => {
    expect(buildLedgerAnnouncement([])).toBe('')
    expect(buildLedgerAnnouncement(null)).toBe('')
    expect(buildLedgerAnnouncement(undefined)).toBe('')
    expect(buildLedgerAnnouncement([notif('1', 'Low balance warning')])).toBe('')
  })

  it('announces a single update', () => {
    expect(buildLedgerAnnouncement([notif('1', 'Incoming payment', '10 XLM')])).toBe(
      'Ledger update. Incoming payment: 10 XLM.',
    )
  })

  it('joins a small batch (2-3) into one sentence', () => {
    const text = buildLedgerAnnouncement([
      notif('1', 'Incoming payment', '10 XLM'),
      notif('2', 'New transaction', 'tx abc'),
    ])
    expect(text).toContain('Ledger updates.')
    expect(text).toContain('Incoming payment: 10 XLM')
    expect(text).toContain('New transaction: tx abc')
  })

  it('summarises a large batch with the latest update', () => {
    const text = buildLedgerAnnouncement([
      notif('1', 'New transaction', 'tx newest'),
      notif('2', 'Incoming payment', 'a'),
      notif('3', 'Incoming payment', 'b'),
      notif('4', 'Incoming payment', 'c'),
    ])
    expect(text).toBe('4 ledger updates. Latest: New transaction: tx newest.')
  })
})

describe('createLedgerAnnouncer', () => {
  let announce: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    announce = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('never announces the primed history', () => {
    const announcer = createLedgerAnnouncer({ announce })
    const snapshot = [notif('1', 'Incoming payment', '10 XLM')]

    announcer.prime(snapshot)
    announcer.observe(snapshot)
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)

    expect(announce).not.toHaveBeenCalled()
    announcer.dispose()
  })

  it('announces a new ledger update after the coalescing window', () => {
    const announcer = createLedgerAnnouncer({ announce })
    announcer.prime([])

    announcer.observe([notif('1', 'Incoming payment', '10 XLM')])
    expect(announce).not.toHaveBeenCalled() // still coalescing

    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)

    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce.mock.calls[0][0]).toContain('Incoming payment: 10 XLM')
    announcer.dispose()
  })

  it('coalesces a burst into a single announcement', () => {
    const announcer = createLedgerAnnouncer({ announce })
    announcer.prime([])

    announcer.observe([notif('1', 'Incoming payment', 'a')])
    announcer.observe([
      notif('2', 'Account credited', 'b'),
      notif('1', 'Incoming payment', 'a'), // already seen
    ])
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)

    expect(announce).toHaveBeenCalledTimes(1)
    const message = announce.mock.calls[0][0]
    expect(message).toContain('Ledger updates.')
    expect(message).toContain('Incoming payment: a')
    expect(message).toContain('Account credited: b')
    announcer.dispose()
  })

  it('ignores duplicate snapshots and non-ledger updates', () => {
    const announcer = createLedgerAnnouncer({ announce })
    announcer.prime([])

    announcer.observe([notif('1', 'Low balance warning')])
    announcer.observe([notif('1', 'Low balance warning')])
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)

    expect(announce).not.toHaveBeenCalled()
    announcer.dispose()
  })

  it('flushes immediately once maxBatch is reached', () => {
    const announcer = createLedgerAnnouncer({ announce, maxBatch: 3 })
    announcer.prime([])

    announcer.observe([
      notif('1', 'Incoming payment', 'a'),
      notif('2', 'Incoming payment', 'b'),
      notif('3', 'Incoming payment', 'c'),
    ])

    expect(announce).toHaveBeenCalledTimes(1)
    // The pending timer must not fire a second announcement.
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    expect(announce).toHaveBeenCalledTimes(1)
    announcer.dispose()
  })

  it('survives an announcing callback that throws', () => {
    const exploding = vi.fn(() => {
      throw new Error('announcer failed')
    })
    const announcer = createLedgerAnnouncer({ announce: exploding })
    announcer.prime([])

    expect(() => {
      announcer.observe([notif('1', 'Incoming payment', 'a')])
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    }).not.toThrow()
    expect(exploding).toHaveBeenCalledTimes(1)
    announcer.dispose()
  })

  it('ignores invalid snapshots and cancels pending work on dispose', () => {
    const announcer = createLedgerAnnouncer({ announce })
    announcer.prime([])

    expect(() => announcer.observe(null)).not.toThrow()
    expect(() => announcer.observe(undefined)).not.toThrow()

    announcer.observe([notif('1', 'Incoming payment', 'a')])
    announcer.dispose()
    vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    expect(announce).not.toHaveBeenCalled()
  })
})
