/**
 * src/lib/multisig/index.ts
 * Barrel that re-exports everything from multisig.js plus a synchronous
 * in-memory session API used in test environments.
 *
 * The async storage-backed functions (createSession, loadSessions, etc.)
 * are replaced with synchronous in-memory equivalents so unit tests
 * can call them without `await`.  In production the async versions in
 * multisig.js are used directly; this file is only the importable surface.
 */

export {
  MULTISIG_STORAGE_KEY,
  SIGNER_WEIGHT,
  THRESHOLD_TYPE,
  SESSION_STATUS,
  isValidPublicKey,
  validateThresholds,
  parseAccountSigners,
  checkThresholdMet,
  buildSetSignersTransaction,
  addSignatureToXdr,
  addRawSignatureToXdr,
  getSignersFromXdr,
  submitMultisigTransaction,
} from '../multisig.js'

import { SESSION_STATUS, checkThresholdMet } from '../multisig.js'

// ─── Synchronous in-memory session store ────────────────────────────────────

const STORAGE_KEY = 'stellar-multisig-sessions'

function readSessions(): object[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessions(sessions: object[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    }
  } catch {
    // non-fatal
  }
}

export function loadSessions(): object[] {
  return readSessions()
}

export function saveSessions(sessions: object[]): void {
  writeSessions(sessions)
}

export function createSession({
  txXdr,
  sourceAddress,
  description,
  requiredSigners,
  threshold,
  network,
}: {
  txXdr: string
  sourceAddress: string
  description?: string
  requiredSigners: Array<{ key: string; weight: number }>
  threshold: number
  network?: string
}): object {
  const session = {
    id: `msig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    txXdr,
    sourceAddress,
    description: description || 'Multisig Transaction',
    requiredSigners,
    threshold,
    network: network || 'testnet',
    collectedSignatures: [] as Array<{ signerKey: string; xdr: string; addedAt: string }>,
    status: SESSION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const sessions = readSessions()
  sessions.unshift(session)
  writeSessions(sessions)
  return session
}

export function updateSession(id: string, updates: Record<string, unknown>): object | null {
  const sessions = readSessions() as Array<Record<string, unknown>>
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx === -1) return null
  sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() }
  writeSessions(sessions)
  return sessions[idx]
}

export function deleteSession(id: string): void {
  const sessions = readSessions() as Array<Record<string, unknown>>
  writeSessions(sessions.filter((s) => s.id !== id))
}

export function addSignatureToSession(
  sessionId: string,
  signerKey: string,
  signedXdr: string,
): object | null {
  const sessions = readSessions() as Array<Record<string, unknown>>
  const idx = sessions.findIndex((s) => s.id === sessionId)
  if (idx === -1) return null

  const session = { ...sessions[idx] } as Record<string, unknown>
  const sigs = (session.collectedSignatures as Array<{ signerKey: string; xdr: string; addedAt: string }>) || []

  // Deduplicate
  const alreadySigned = sigs.some((s) => s.signerKey === signerKey)
  if (alreadySigned) return session

  sigs.push({ signerKey, xdr: signedXdr, addedAt: new Date().toISOString() })
  session.collectedSignatures = sigs
  session.txXdr = signedXdr

  const requiredSigners = (session.requiredSigners as Array<{ key: string; weight: number }>) || []
  const threshold = session.threshold as number
  const { met } = checkThresholdMet(
    sigs.map((s) => s.signerKey),
    requiredSigners,
    threshold,
  )
  session.status = met ? SESSION_STATUS.READY : SESSION_STATUS.COLLECTING
  session.updatedAt = new Date().toISOString()

  sessions[idx] = session
  writeSessions(sessions)
  return session
}
