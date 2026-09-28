/**
 * Tests for MultisigCoordinator — issue #845
 *
 * Covers:
 *  - Primary flow: create session → add signatures → threshold met → mark submitted
 *  - Boundary cases: exact-threshold weight, single-signer session, duplicate sig
 *  - Failure cases: invalid args, missing session, threshold exceeded in creation
 *  - Notification shape when threshold is unmet
 *  - getSessionsAwaitingSignatures filter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MultisigCoordinator } from '../../../src/lib/multisig/MultisigCoordinator'
import { SESSION_STATUS } from '../../../src/lib/multisig/index'
import { NOTIFICATION_TYPES } from '../../../src/lib/notifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KEY_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const KEY_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
const KEY_C = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
const XDR_0 = 'BASE_XDR'
const XDR_1 = 'SIGNED_BY_A'
const XDR_2 = 'SIGNED_BY_A_AND_B'
const SRC   = 'GSOURCE_ADDRESS_PLACEHOLDER_1234567890ABCDEFGHIJKLMN'

const defaultParams = () => ({
  txXdr:           XDR_0,
  sourceAddress:   SRC,
  description:     'Test multisig tx',
  requiredSigners: [
    { key: KEY_A, weight: 1 },
    { key: KEY_B, weight: 1 },
  ],
  threshold: 2,
  network:   'testnet',
})

beforeEach(() => {
  localStorage.clear()
})

// ─── Primary flow ─────────────────────────────────────────────────────────────

describe('MultisigCoordinator — primary flow', () => {
  it('creates a pending session with correct initial state', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    expect(session.id).toMatch(/^msig-/)
    expect(session.status).toBe(SESSION_STATUS.PENDING)
    expect(session.collectedSignatures).toHaveLength(0)
    expect(session.threshold).toBe(2)
  })

  it('addSignature transitions status to COLLECTING after first sig', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    const { session: updated, notification } = MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    expect(updated.status).toBe(SESSION_STATUS.COLLECTING)
    expect(updated.collectedSignatures).toHaveLength(1)
    // threshold not yet met — notification must be present
    expect(notification).not.toBeNull()
    expect(notification!.type).toBe(NOTIFICATION_TYPES.WARNING)
  })

  it('addSignature transitions status to READY when threshold is met', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const { session: ready, notification } = MultisigCoordinator.addSignature(session.id, KEY_B, XDR_2)
    expect(ready.status).toBe(SESSION_STATUS.READY)
    // threshold met — no warning notification
    expect(notification).toBeNull()
  })

  it('getThresholdStatus reflects accumulated weight correctly', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const status = MultisigCoordinator.getThresholdStatus(loaded)
    expect(status.met).toBe(false)
    expect(status.currentWeight).toBe(1)
    expect(status.needed).toBe(1)
    expect(status.remainingSigners.map((s) => s.key)).toContain(KEY_B)
  })

  it('markSubmitted sets status to SUBMITTED', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    MultisigCoordinator.addSignature(session.id, KEY_B, XDR_2)
    const submitted = MultisigCoordinator.markSubmitted(session.id)
    expect(submitted.status).toBe(SESSION_STATUS.SUBMITTED)
  })

  it('getPendingSessions returns only PENDING and COLLECTING sessions', () => {
    const p1 = MultisigCoordinator.createPendingSession(defaultParams())
    const p2 = MultisigCoordinator.createPendingSession({ ...defaultParams(), description: 'Second' })
    MultisigCoordinator.markSubmitted(p2.id)

    const pending = MultisigCoordinator.getPendingSessions()
    expect(pending.map((s) => s.id)).toContain(p1.id)
    expect(pending.map((s) => s.id)).not.toContain(p2.id)
  })
})

// ─── Boundary cases ───────────────────────────────────────────────────────────

describe('MultisigCoordinator — boundary cases', () => {
  it('threshold=1 is met immediately with a single signer', () => {
    const session = MultisigCoordinator.createPendingSession({
      ...defaultParams(),
      requiredSigners: [{ key: KEY_A, weight: 1 }],
      threshold: 1,
    })
    const { session: ready, notification } = MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    expect(ready.status).toBe(SESSION_STATUS.READY)
    expect(notification).toBeNull()
  })

  it('weighted threshold — one heavy signer satisfies the threshold alone', () => {
    const session = MultisigCoordinator.createPendingSession({
      ...defaultParams(),
      requiredSigners: [
        { key: KEY_A, weight: 5 },
        { key: KEY_B, weight: 1 },
      ],
      threshold: 5,
    })
    const { session: ready } = MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    expect(ready.status).toBe(SESSION_STATUS.READY)
  })

  it('duplicate signature is ignored — collectedSignatures length stays 1', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    MultisigCoordinator.addSignature(session.id, KEY_A, 'DUPLICATE_XDR')
    const loaded = MultisigCoordinator.getSession(session.id)
    expect(loaded.collectedSignatures).toHaveLength(1)
  })

  it('three-of-three scenario needs all signers', () => {
    const session = MultisigCoordinator.createPendingSession({
      ...defaultParams(),
      requiredSigners: [
        { key: KEY_A, weight: 1 },
        { key: KEY_B, weight: 1 },
        { key: KEY_C, weight: 1 },
      ],
      threshold: 3,
    })
    MultisigCoordinator.addSignature(session.id, KEY_A, 'XDR_A')
    MultisigCoordinator.addSignature(session.id, KEY_B, 'XDR_B')
    const { session: stillPending } = MultisigCoordinator.addSignature(
      session.id, KEY_B, 'XDR_B_DUPE', // duplicate — threshold still unmet
    )
    expect(stillPending.status).toBe(SESSION_STATUS.COLLECTING)
    const { session: ready } = MultisigCoordinator.addSignature(session.id, KEY_C, 'XDR_C')
    expect(ready.status).toBe(SESSION_STATUS.READY)
  })

  it('getSessionsAwaitingSignatures returns COLLECTING sessions only', () => {
    const s1 = MultisigCoordinator.createPendingSession(defaultParams())          // PENDING
    const s2 = MultisigCoordinator.createPendingSession({ ...defaultParams(), description: 'S2' })
    MultisigCoordinator.addSignature(s2.id, KEY_A, XDR_1)                         // COLLECTING

    const awaiting = MultisigCoordinator.getSessionsAwaitingSignatures()
    expect(awaiting.map((s) => s.id)).not.toContain(s1.id)
    expect(awaiting.map((s) => s.id)).toContain(s2.id)
  })

  it('removeSession deletes it from storage', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.removeSession(session.id)
    expect(() => MultisigCoordinator.getSession(session.id)).toThrow()
  })
})

// ─── Failure cases ────────────────────────────────────────────────────────────

describe('MultisigCoordinator — failure cases', () => {
  it('createPendingSession throws when txXdr is missing', () => {
    expect(() =>
      MultisigCoordinator.createPendingSession({ ...defaultParams(), txXdr: '' })
    ).toThrow('txXdr is required')
  })

  it('createPendingSession throws when sourceAddress is missing', () => {
    expect(() =>
      MultisigCoordinator.createPendingSession({ ...defaultParams(), sourceAddress: '' })
    ).toThrow('sourceAddress is required')
  })

  it('createPendingSession throws when requiredSigners is empty', () => {
    expect(() =>
      MultisigCoordinator.createPendingSession({ ...defaultParams(), requiredSigners: [] })
    ).toThrow('requiredSigners must be a non-empty array')
  })

  it('createPendingSession throws when threshold < 1', () => {
    expect(() =>
      MultisigCoordinator.createPendingSession({ ...defaultParams(), threshold: 0 })
    ).toThrow('threshold must be a positive number')
  })

  it('createPendingSession throws when threshold exceeds total signer weight', () => {
    expect(() =>
      MultisigCoordinator.createPendingSession({ ...defaultParams(), threshold: 99 })
    ).toThrow('threshold (99) exceeds total signer weight (2)')
  })

  it('addSignature throws when sessionId is missing', () => {
    expect(() =>
      MultisigCoordinator.addSignature('', KEY_A, XDR_1)
    ).toThrow('sessionId is required')
  })

  it('addSignature throws when the session does not exist', () => {
    expect(() =>
      MultisigCoordinator.addSignature('nonexistent-id', KEY_A, XDR_1)
    ).toThrow("session 'nonexistent-id' not found")
  })

  it('addSignature throws when signerKey is empty', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    expect(() =>
      MultisigCoordinator.addSignature(session.id, '', XDR_1)
    ).toThrow('signerKey is required')
  })

  it('addSignature throws when signedXdr is empty', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    expect(() =>
      MultisigCoordinator.addSignature(session.id, KEY_A, '')
    ).toThrow('signedXdr is required')
  })

  it('getSession throws for unknown id', () => {
    expect(() => MultisigCoordinator.getSession('unknown')).toThrow("session 'unknown' not found")
  })

  it('markSubmitted throws for unknown id', () => {
    expect(() => MultisigCoordinator.markSubmitted('ghost')).toThrow("session 'ghost' not found")
  })

  it('markFailed stores failure reason on session', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    const failed = MultisigCoordinator.markFailed(session.id, 'tx_bad_auth')
    expect(failed.status).toBe(SESSION_STATUS.FAILED)
    expect((failed as Record<string, unknown>).failureReason).toBe('tx_bad_auth')
  })
})

// ─── Notification shape ───────────────────────────────────────────────────────

describe('MultisigCoordinator — threshold-unmet notification', () => {
  it('notification type is WARNING', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)
    expect(notif!.type).toBe(NOTIFICATION_TYPES.WARNING)
  })

  it('notification title is "Threshold Not Yet Met"', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)
    expect(notif!.title).toBe('Threshold Not Yet Met')
  })

  it('notification message mentions "1 more signature" when needed=1', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)
    expect(notif!.message).toMatch(/1 more signature required/)
  })

  it('notification message mentions plural when needed>1', () => {
    const session = MultisigCoordinator.createPendingSession({
      ...defaultParams(),
      requiredSigners: [
        { key: KEY_A, weight: 1 },
        { key: KEY_B, weight: 1 },
        { key: KEY_C, weight: 1 },
      ],
      threshold: 3,
    })
    // no signatures yet
    const notif = MultisigCoordinator.buildThresholdNotification(session)
    expect(notif!.message).toMatch(/3 more weight/)
  })

  it('notification includes sessionId, currentWeight, needed, and remainingSigners', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)!
    expect(notif.sessionId).toBe(session.id)
    expect(notif.currentWeight).toBe(1)
    expect(notif.needed).toBe(1)
    expect(notif.remainingSigners.map((s) => s.key)).toEqual([KEY_B])
  })

  it('buildThresholdNotification returns null when threshold is already met', () => {
    const session = MultisigCoordinator.createPendingSession(defaultParams())
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    MultisigCoordinator.addSignature(session.id, KEY_B, XDR_2)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)
    expect(notif).toBeNull()
  })

  it('notification uses signer label when provided', () => {
    const session = MultisigCoordinator.createPendingSession({
      ...defaultParams(),
      requiredSigners: [
        { key: KEY_A, weight: 1, label: 'Alice' },
        { key: KEY_B, weight: 1, label: 'Bob' },
      ],
    })
    MultisigCoordinator.addSignature(session.id, KEY_A, XDR_1)
    const loaded = MultisigCoordinator.getSession(session.id)
    const notif = MultisigCoordinator.buildThresholdNotification(loaded)!
    expect(notif.message).toContain('Bob')
  })
})
