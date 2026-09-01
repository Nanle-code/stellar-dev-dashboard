/**
 * Tests for StreamManager reconnect logic with jitter and online/offline awareness.
 *
 * The Horizon server is mocked so these tests never make real network calls;
 * `lastStreamHandlers` captures the onmessage/onerror callbacks the manager
 * registers so tests can drive them directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let lastStreamHandlers: { onmessage: (_ledger: unknown) => void; onerror: (_err: unknown) => void } | null = null
const streamSpy = vi.fn()
const closeSpy = vi.fn()

vi.mock('../stellar', () => ({
  getServer: vi.fn(() => ({
    ledgers: () => ({
      cursor: () => ({
        stream: (handlers: { onmessage: (_ledger: unknown) => void; onerror: (_err: unknown) => void }) => {
          lastStreamHandlers = handlers
          streamSpy(handlers)
          return closeSpy
        },
      }),
    }),
  })),
}))

const { connectLedgerStream, ledgerStreamManager } = await import('../streaming')

const TEST_NETWORK = 'testnet'

function resetManager() {
  ledgerStreamManager.disconnect()
  // @ts-ignore - accessing private properties for test setup
  ledgerStreamManager._reconnectAttempts = 0
  // @ts-ignore
  ledgerStreamManager._status = 'disconnected'
  // @ts-ignore
  ledgerStreamManager._isOnline = true
  // @ts-ignore
  ledgerStreamManager._reconnectTimer = null
  lastStreamHandlers = null
  streamSpy.mockClear()
  closeSpy.mockClear()
}

describe('StreamManager reconnect jitter and online awareness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetManager()
    // Simulated stream errors below deliberately trigger the manager's own
    // console.error/warn logging — silence it so test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    ledgerStreamManager.disconnect()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('primary flow', () => {
    it('connects, emits incoming ledgers to subscribers, and resets backoff on message', () => {
      const onLedger = vi.fn()
      const onStatus = vi.fn()

      const cleanup = connectLedgerStream(TEST_NETWORK, onLedger, onStatus)

      expect(streamSpy).toHaveBeenCalledTimes(1)
      expect(onStatus).toHaveBeenCalledWith('connecting')

      const ledger = { sequence: 42 }
      lastStreamHandlers!.onmessage(ledger)

      expect(onLedger).toHaveBeenCalledWith(ledger)
      expect(onStatus).toHaveBeenCalledWith('connected')
      expect(ledgerStreamManager.getStatus()).toBe('connected')
      // @ts-ignore - private
      expect(ledgerStreamManager._reconnectAttempts).toBe(0)

      cleanup()
      expect(closeSpy).toHaveBeenCalledTimes(1)
      expect(ledgerStreamManager.getStatus()).toBe('disconnected')
    })
  })

  describe('failure case: exponential backoff with jitter on stream error', () => {
    it('schedules a reconnect delay in [0, baseDelay) capped at the max, then reopens the stream', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())

      lastStreamHandlers!.onerror(new Error('boom'))

      expect(ledgerStreamManager.getStatus()).toBe('reconnecting')
      // attempt 0: baseDelay = 1000 * 2**0 = 1000ms; jitter 0.5 -> 500ms
      expect(vi.getTimerCount()).toBe(1)
      // @ts-ignore - private
      expect(ledgerStreamManager._reconnectAttempts).toBe(1)

      vi.advanceTimersByTime(500)

      expect(streamSpy).toHaveBeenCalledTimes(2)
      expect(ledgerStreamManager.getStatus()).toBe('connecting')
    })

    it('caps the delay at RECONNECT_MAX_DELAY_MS once exponential growth would exceed it', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1) // worst case: max jitter
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())

      // attempt 6: baseDelay = 1000 * 2**6 = 64000ms, which without a cap
      // would exceed the 30s ceiling.
      // @ts-ignore - private
      ledgerStreamManager._reconnectAttempts = 6
      lastStreamHandlers!.onerror(new Error('boom'))

      const delay = setTimeoutSpy.mock.calls[0][1] as number
      expect(delay).toBe(30_000)

      setTimeoutSpy.mockRestore()
    })

    it('applies jitter so repeated failures do not retry at a fixed interval', () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const delays: number[] = []

      for (let i = 0; i < 5; i++) {
        resetManager()
        connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())
        setTimeoutSpy.mockClear()
        lastStreamHandlers!.onerror(new Error('boom'))
        delays.push(setTimeoutSpy.mock.calls[0][1] as number)
      }

      // attempt 0: baseDelay = 1000ms, full jitter means each delay lands
      // somewhere in [0, 1000) rather than always at the same value.
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThan(1_000)
      })
      expect(new Set(delays).size).toBeGreaterThan(1)

      setTimeoutSpy.mockRestore()
    })
  })

  describe('boundary case: max reconnect attempts', () => {
    it('stops scheduling further reconnects once MAX_RECONNECT_ATTEMPTS is reached', () => {
      connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())

      // Drive 10 consecutive failures, letting each scheduled timer fire so
      // the next attempt is actually made against the real implementation.
      for (let i = 0; i < 10; i++) {
        lastStreamHandlers!.onerror(new Error('boom'))
        vi.runOnlyPendingTimers()
      }

      const attemptsAfterTen = streamSpy.mock.calls.length
      // @ts-ignore - private
      expect(ledgerStreamManager._reconnectAttempts).toBe(10)

      // The 11th failure should give up instead of scheduling another retry.
      lastStreamHandlers!.onerror(new Error('boom'))

      expect(ledgerStreamManager.getStatus()).toBe('error')
      expect(vi.getTimerCount()).toBe(0)
      expect(streamSpy.mock.calls.length).toBe(attemptsAfterTen)
    })
  })

  describe('boundary case: offline pause and resume', () => {
    it('pauses reconnection without incrementing attempts while offline', () => {
      connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())

      // @ts-ignore - private
      ledgerStreamManager._setIsOnline(false)
      lastStreamHandlers!.onerror(new Error('boom'))

      expect(ledgerStreamManager.getStatus()).toBe('reconnecting')
      // @ts-ignore - private
      expect(ledgerStreamManager._reconnectAttempts).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('resumes immediately with backoff reset when connectivity returns', () => {
      connectLedgerStream(TEST_NETWORK, vi.fn(), vi.fn())

      // @ts-ignore - private
      ledgerStreamManager._setIsOnline(false)
      lastStreamHandlers!.onerror(new Error('boom'))
      expect(ledgerStreamManager.getStatus()).toBe('reconnecting')

      // @ts-ignore - private
      ledgerStreamManager._setIsOnline(true)

      // Coming back online reopens the stream right away (no backoff wait)
      // rather than leaving the manager stuck reporting "connecting".
      expect(streamSpy).toHaveBeenCalledTimes(2)
      expect(ledgerStreamManager.getStatus()).toBe('connecting')
      // @ts-ignore - private
      expect(ledgerStreamManager._reconnectAttempts).toBe(0)
    })
  })
})
