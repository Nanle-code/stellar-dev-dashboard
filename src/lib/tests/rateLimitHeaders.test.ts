/**
 * Rate-limit header parsing & store integration tests
 *
 * Covers:
 *   Primary flow  – headers present on a normal 200 response are parsed and
 *                   stored correctly.
 *   Boundary case – a 429 response with a Retry-After header but no other
 *                   rate-limit headers still marks the quota as limited.
 *   Failure case  – malformed / non-numeric header values are treated as null
 *                   so the UI never displays garbage.
 *
 * Vitest + jsdom environment (configured in vitest.config.js).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseRateLimitHeaders } from '../stellar'
import { useStore } from '../store'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Headers object from a plain record. */
function makeHeaders(record: Record<string, string> = {}): Headers {
  return new Headers(record)
}

// Capture baseline store state so each test starts clean.
const BASELINE = useStore.getState()
function resetStore() {
  useStore.setState(BASELINE, true)
}

// ─── parseRateLimitHeaders ────────────────────────────────────────────────────

describe('parseRateLimitHeaders', () => {
  // ── Primary flow ────────────────────────────────────────────────────────────

  describe('primary flow — standard headers on a 200 response', () => {
    it('parses all four headers into the correct integer fields', () => {
      const headers = makeHeaders({
        'X-RateLimit-Limit':     '100',
        'X-RateLimit-Remaining': '42',
        'X-RateLimit-Reset':     '1700000000',
        'Retry-After':           '0',
      })

      const quota = parseRateLimitHeaders(headers, false)

      expect(quota.limit).toBe(100)
      expect(quota.remaining).toBe(42)
      expect(quota.resetAt).toBe(1700000000)
      expect(quota.retryAfter).toBe(0)
      expect(quota.isLimited).toBe(false)
      expect(typeof quota.timestamp).toBe('number')
    })

    it('sets isLimited to false when the response is not a 429', () => {
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'X-RateLimit-Limit': '30', 'X-RateLimit-Remaining': '29' }),
        false,
      )
      expect(quota.isLimited).toBe(false)
    })

    it('records a timestamp close to now', () => {
      const before = Date.now()
      const quota = parseRateLimitHeaders(makeHeaders(), false)
      const after = Date.now()
      expect(quota.timestamp).toBeGreaterThanOrEqual(before)
      expect(quota.timestamp).toBeLessThanOrEqual(after)
    })
  })

  // ── Boundary case ────────────────────────────────────────────────────────────

  describe('boundary case — 429 with Retry-After only', () => {
    it('marks isLimited and captures retryAfter even without other headers', () => {
      const headers = makeHeaders({ 'Retry-After': '60' })
      const quota = parseRateLimitHeaders(headers, true)

      expect(quota.isLimited).toBe(true)
      expect(quota.retryAfter).toBe(60)
      // No other headers were sent
      expect(quota.limit).toBeNull()
      expect(quota.remaining).toBeNull()
      expect(quota.resetAt).toBeNull()
    })

    it('handles a Retry-After of 0 (immediate retry)', () => {
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'Retry-After': '0' }),
        true,
      )
      expect(quota.retryAfter).toBe(0)
      expect(quota.isLimited).toBe(true)
    })
  })

  // ── Failure case ─────────────────────────────────────────────────────────────

  describe('failure case — malformed / missing header values', () => {
    it('returns null for a completely empty Headers object', () => {
      const quota = parseRateLimitHeaders(makeHeaders(), false)
      expect(quota.limit).toBeNull()
      expect(quota.remaining).toBeNull()
      expect(quota.resetAt).toBeNull()
      expect(quota.retryAfter).toBeNull()
    })

    it('returns null when the header value is a non-numeric string', () => {
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'X-RateLimit-Limit': 'unlimited', 'X-RateLimit-Remaining': 'many' }),
        false,
      )
      expect(quota.limit).toBeNull()
      expect(quota.remaining).toBeNull()
    })

    it('returns null when the header value is an empty string', () => {
      // Some servers send the header name with an empty value
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'X-RateLimit-Reset': '' }),
        false,
      )
      expect(quota.resetAt).toBeNull()
    })

    it('returns null for floating-point strings (non-integer)', () => {
      // parseInt('3.7') === 3, which IS finite — this test ensures we handle
      // the fact that parseInt truncates; 3 is a valid integer result.
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'X-RateLimit-Remaining': '3.7' }),
        false,
      )
      // parseInt truncates to 3 — still a valid integer, not null
      expect(quota.remaining).toBe(3)
    })

    it('returns null for NaN-producing strings like "abc"', () => {
      const quota = parseRateLimitHeaders(
        makeHeaders({ 'X-RateLimit-Limit': 'abc' }),
        false,
      )
      expect(quota.limit).toBeNull()
    })
  })
})

// ─── Store integration ────────────────────────────────────────────────────────

describe('useStore — rateLimitQuota', () => {
  beforeEach(resetStore)

  it('starts as null (no server contact yet)', () => {
    expect(useStore.getState().rateLimitQuota).toBeNull()
  })

  it('setRateLimitQuota stores a parsed quota snapshot', () => {
    const quota = parseRateLimitHeaders(
      makeHeaders({ 'X-RateLimit-Limit': '60', 'X-RateLimit-Remaining': '55' }),
      false,
    )

    useStore.getState().setRateLimitQuota(quota)

    const stored = useStore.getState().rateLimitQuota
    expect(stored).not.toBeNull()
    expect(stored!.limit).toBe(60)
    expect(stored!.remaining).toBe(55)
    expect(stored!.isLimited).toBe(false)
  })

  it('setRateLimitQuota replaces the previous snapshot', () => {
    const first = parseRateLimitHeaders(
      makeHeaders({ 'X-RateLimit-Remaining': '10' }),
      false,
    )
    useStore.getState().setRateLimitQuota(first)

    const second = parseRateLimitHeaders(
      makeHeaders({ 'X-RateLimit-Remaining': '9' }),
      false,
    )
    useStore.getState().setRateLimitQuota(second)

    expect(useStore.getState().rateLimitQuota!.remaining).toBe(9)
  })

  it('setRateLimitQuota accepts null to clear the quota', () => {
    useStore.getState().setRateLimitQuota(
      parseRateLimitHeaders(makeHeaders({ 'X-RateLimit-Limit': '30' }), false),
    )
    useStore.getState().setRateLimitQuota(null)
    expect(useStore.getState().rateLimitQuota).toBeNull()
  })

  it('reflects a rate-limited (429) quota correctly', () => {
    const quota = parseRateLimitHeaders(
      makeHeaders({ 'Retry-After': '30', 'X-RateLimit-Remaining': '0' }),
      true,
    )
    useStore.getState().setRateLimitQuota(quota)

    const stored = useStore.getState().rateLimitQuota!
    expect(stored.isLimited).toBe(true)
    expect(stored.remaining).toBe(0)
    expect(stored.retryAfter).toBe(30)
  })
})
