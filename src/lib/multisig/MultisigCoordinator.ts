/**
 * MultisigCoordinator — issue #845
 *
 * Coordinates pending multi-signature sessions: tracks which signers have
 * signed, determines whether the required threshold has been reached, and
 * emits structured notifications when the threshold is still unmet so the
 * caller can surface guidance to the user.
 *
 * Design decisions:
 *  - Synchronous + localStorage so it can be used in tests without async
 *    IndexedDB setup (mirrors the pattern in src/lib/multisig/index.ts).
 *  - Notification payloads use NOTIFICATION_TYPES from src/lib/notifications.ts
 *    and contain enough detail for a UI layer to render actionable messages.
 *  - The class is stateless with respect to storage: every method reads from
 *    and writes to localStorage on each call so multiple tabs stay in sync.
 */

import { NOTIFICATION_TYPES } from '../notifications'
import {
  SESSION_STATUS,
  checkThresholdMet,
  createSession,
  loadSessions,
  updateSession,
  addSignatureToSession,
  deleteSession,
} from './index'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Signer {
  key: string
  weight: number
  label?: string
}

export interface PendingSignature {
  signerKey: string
  xdr: string
  addedAt: string
}

export interface MultisigSession {
  id: string
  txXdr: string
  sourceAddress: string
  description: string
  requiredSigners: Signer[]
  threshold: number
  network: string
  collectedSignatures: PendingSignature[]
  status: string
  createdAt: string
  updatedAt: string
}

export interface ThresholdStatus {
  met: boolean
  currentWeight: number
  needed: number
  remainingSigners: Signer[]
}

/**
 * A structured notification payload emitted when the threshold is not yet met.
 * Consumers may pass this directly to a notification system.
 */
export interface ThresholdNotification {
  type: string       // always NOTIFICATION_TYPES.WARNING
  title: string
  message: string
  sessionId: string
  currentWeight: number
  needed: number
  remainingSigners: Signer[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Cast a raw session from storage to a typed MultisigSession.
 * Throws if the required fields are missing so callers get explicit errors.
 */
function assertSession(raw: unknown): MultisigSession {
  if (!raw || typeof raw !== 'object') {
    throw new Error('MultisigCoordinator: invalid session object')
  }
  const s = raw as Record<string, unknown>
  if (typeof s.id !== 'string') throw new Error('MultisigCoordinator: session missing id')
  if (typeof s.txXdr !== 'string') throw new Error('MultisigCoordinator: session missing txXdr')
  if (!Array.isArray(s.requiredSigners)) throw new Error('MultisigCoordinator: session missing requiredSigners')
  if (typeof s.threshold !== 'number') throw new Error('MultisigCoordinator: session missing threshold')
  return raw as MultisigSession
}

// ─── MultisigCoordinator ──────────────────────────────────────────────────────

export class MultisigCoordinator {
  /**
   * Create a new pending multi-signature session.
   *
   * @param params  Session configuration.
   * @returns       The newly created session.
   */
  static createPendingSession(params: {
    txXdr: string
    sourceAddress: string
    description?: string
    requiredSigners: Signer[]
    threshold: number
    network?: string
  }): MultisigSession {
    if (!params.txXdr || typeof params.txXdr !== 'string') {
      throw new Error('MultisigCoordinator.createPendingSession: txXdr is required')
    }
    if (!params.sourceAddress || typeof params.sourceAddress !== 'string') {
      throw new Error('MultisigCoordinator.createPendingSession: sourceAddress is required')
    }
    if (!Array.isArray(params.requiredSigners) || params.requiredSigners.length === 0) {
      throw new Error('MultisigCoordinator.createPendingSession: requiredSigners must be a non-empty array')
    }
    if (typeof params.threshold !== 'number' || params.threshold < 1) {
      throw new Error('MultisigCoordinator.createPendingSession: threshold must be a positive number')
    }
    const totalWeight = params.requiredSigners.reduce((sum, s) => sum + (s.weight ?? 0), 0)
    if (params.threshold > totalWeight) {
      throw new Error(
        `MultisigCoordinator.createPendingSession: threshold (${params.threshold}) exceeds total signer weight (${totalWeight})`
      )
    }
    return assertSession(createSession(params))
  }

  /**
   * Load all sessions from storage and return those that are still pending
   * (i.e. status is PENDING or COLLECTING — not yet ready, submitted, or failed).
   */
  static getPendingSessions(): MultisigSession[] {
    const sessions = loadSessions() as unknown[]
    return sessions
      .filter((s) => {
        if (!s || typeof s !== 'object') return false
        const status = (s as Record<string, unknown>).status
        return status === SESSION_STATUS.PENDING || status === SESSION_STATUS.COLLECTING
      })
      .map((s) => assertSession(s))
  }

  /**
   * Load a single session by id.
   *
   * @throws  If the session is not found.
   */
  static getSession(sessionId: string): MultisigSession {
    const sessions = loadSessions() as unknown[]
    const found = sessions.find(
      (s) => s && typeof s === 'object' && (s as Record<string, unknown>).id === sessionId
    )
    if (!found) throw new Error(`MultisigCoordinator.getSession: session '${sessionId}' not found`)
    return assertSession(found)
  }

  /**
   * Record a new signature for a session.
   *
   * If the threshold becomes met after this signature, the session status is
   * automatically updated to READY.  If it is still unmet a ThresholdNotification
   * is returned so the caller can display a warning.
   *
   * @param sessionId   Id of the session to update.
   * @param signerKey   Public key of the signer.
   * @param signedXdr   Transaction XDR that includes this signer's signature.
   * @returns           `{ session, notification }` — notification is `null` when the
   *                    threshold is already met.
   */
  static addSignature(
    sessionId: string,
    signerKey: string,
    signedXdr: string,
  ): { session: MultisigSession; notification: ThresholdNotification | null } {
    if (!sessionId) throw new Error('MultisigCoordinator.addSignature: sessionId is required')
    if (!signerKey) throw new Error('MultisigCoordinator.addSignature: signerKey is required')
    if (!signedXdr) throw new Error('MultisigCoordinator.addSignature: signedXdr is required')

    const raw = addSignatureToSession(sessionId, signerKey, signedXdr)
    if (!raw) throw new Error(`MultisigCoordinator.addSignature: session '${sessionId}' not found`)

    const session = assertSession(raw)
    const notification = session.status !== SESSION_STATUS.READY
      ? this.buildThresholdNotification(session)
      : null

    return { session, notification }
  }

  /**
   * Calculate the current threshold status for a session without mutating it.
   */
  static getThresholdStatus(session: MultisigSession): ThresholdStatus {
    const collectedKeys = session.collectedSignatures.map((s) => s.signerKey)
    const { met, currentWeight, needed } = checkThresholdMet(
      collectedKeys,
      session.requiredSigners,
      session.threshold,
    )
    const collectedSet = new Set(collectedKeys)
    const remainingSigners = session.requiredSigners.filter((s) => !collectedSet.has(s.key))
    return { met, currentWeight, needed, remainingSigners }
  }

  /**
   * Build a structured threshold-unmet notification for a session.
   *
   * Returns `null` if the threshold is already met (nothing to warn about).
   */
  static buildThresholdNotification(session: MultisigSession): ThresholdNotification | null {
    const { met, currentWeight, needed, remainingSigners } = this.getThresholdStatus(session)
    if (met) return null

    const signerLabels = remainingSigners
      .map((s) => s.label ?? s.key.slice(0, 8) + '…')
      .join(', ')

    const message = needed === 1
      ? `1 more signature required. Waiting for: ${signerLabels || 'remaining signers'}.`
      : `${needed} more weight in signatures required. Waiting for: ${signerLabels || 'remaining signers'}.`

    return {
      type: NOTIFICATION_TYPES.WARNING,
      title: 'Threshold Not Yet Met',
      message,
      sessionId: session.id,
      currentWeight,
      needed,
      remainingSigners,
    }
  }

  /**
   * Mark a session as submitted (after the caller has successfully broadcast
   * the fully-signed transaction to the network).
   */
  static markSubmitted(sessionId: string): MultisigSession {
    const updated = updateSession(sessionId, { status: SESSION_STATUS.SUBMITTED })
    if (!updated) throw new Error(`MultisigCoordinator.markSubmitted: session '${sessionId}' not found`)
    return assertSession(updated)
  }

  /**
   * Mark a session as failed (e.g. submission rejected by the network).
   *
   * @param reason  Optional reason string stored on the session for display.
   */
  static markFailed(sessionId: string, reason?: string): MultisigSession {
    const updates: Record<string, unknown> = { status: SESSION_STATUS.FAILED }
    if (reason) updates.failureReason = reason
    const updated = updateSession(sessionId, updates)
    if (!updated) throw new Error(`MultisigCoordinator.markFailed: session '${sessionId}' not found`)
    return assertSession(updated)
  }

  /**
   * Remove a session from storage permanently.
   */
  static removeSession(sessionId: string): void {
    deleteSession(sessionId)
  }

  /**
   * Return all pending sessions that have at least one signature but have not
   * yet reached the threshold — useful for dashboard "action needed" views.
   */
  static getSessionsAwaitingSignatures(): MultisigSession[] {
    return this.getPendingSessions().filter(
      (s) => s.status === SESSION_STATUS.COLLECTING
    )
  }
}
