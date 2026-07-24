/**
 * useBehavioralBiometrics
 *
 * Orchestration hook for behavioral biometric authentication during transaction signing.
 *
 * Usage:
 *   const bio = useBehavioralBiometrics(walletPublicKey)
 *   bio.startCollection()          // call when user starts filling in XDR
 *   const result = await bio.evaluateAndRecord()  // call just before signing
 *   bio.recordSuccessfulSign()     // call after signing completes successfully
 */

import { useCallback, useEffect, useRef } from 'react'
import { createCollector } from '../lib/behavioralBiometrics/collector'
import type { BehavioralDataCollector } from '../lib/behavioralBiometrics/collector'
import { createProfileBuilder } from '../lib/behavioralBiometrics/profileBuilder'
import type { BehavioralProfileBuilder } from '../lib/behavioralBiometrics/profileBuilder'
import type { AnomalyResult } from '../lib/behavioralBiometrics/anomalyDetector'
import { useBiometricStore } from '../lib/behavioralBiometrics/store'
import type { BehavioralProfile } from '../lib/behavioralBiometrics/profileBuilder'

// storage.js is a plain JS module; we import it with type assertions to keep TS happy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-ignore — storage.js has no declaration file; this is intentional
const storageModule = import('../lib/storage') as Promise<any>

async function loadStoredProfile(userId: string): Promise<BehavioralProfile | null> {
  const m = await storageModule
  return m.getBiometricProfile(userId) as Promise<BehavioralProfile | null>
}

async function persistProfile(profile: BehavioralProfile): Promise<void> {
  const m = await storageModule
  return m.saveBiometricProfile(profile)
}

// Module-level singletons keyed by userId so they survive re-renders
const _collectors = new Map<string, BehavioralDataCollector>()
const _builders   = new Map<string, BehavioralProfileBuilder>()

function getCollector(userId: string): BehavioralDataCollector {
  if (!_collectors.has(userId)) {
    _collectors.set(userId, createCollector())
  }
  return _collectors.get(userId)!
}

function getBuilder(userId: string): BehavioralProfileBuilder {
  if (!_builders.has(userId)) {
    _builders.set(userId, createProfileBuilder(userId))
  }
  return _builders.get(userId)!
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBehavioralBiometrics(userId: string | null) {
  const {
    enabled,
    strictMode,
    profile,
    authStatus,
    lastAnomalyResult,
    setProfile,
    setProfileLoading,
    startBiometricSession,
    endBiometricSession,
    setAuthStatus,
    resetSession,
  } = useBiometricStore()

  const sessionIdRef = useRef<string>('')

  // ─── Load profile from IndexedDB on mount / userId change ───────────────

  useEffect(() => {
    if (!userId || !enabled) return

    setProfileLoading(true)
    loadStoredProfile(userId)
      .then((saved: BehavioralProfile | null) => {
        const builder = getBuilder(userId)
        if (saved) {
          builder.loadProfile(saved)
          setProfile(builder.getProfile())
        } else {
          setProfile(builder.getProfile())
        }
      })
      .catch(() => {
        setProfile(getBuilder(userId).getProfile())
      })
      .finally(() => setProfileLoading(false))
  }, [userId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Start collecting behavioral data ────────────────────────────────────

  const startCollection = useCallback(() => {
    if (!userId || !enabled) return

    const id = `${userId}-${Date.now()}`
    sessionIdRef.current = id
    startBiometricSession(id)

    const collector = getCollector(userId)
    collector.startSession()
  }, [userId, enabled, startBiometricSession])

  // ─── Stop collection, evaluate and return result ─────────────────────────

  const evaluateAndRecord = useCallback(async (): Promise<AnomalyResult | null> => {
    if (!userId || !enabled) return null

    setAuthStatus('evaluating')
    const collector = getCollector(userId)
    const sample = collector.stopSession()

    const builder = getBuilder(userId)
    const result = builder.evaluate(sample)

    endBiometricSession(result)

    // Sync current profile state to store (sampleCount may differ)
    setProfile(builder.getProfile())

    return result
  }, [userId, enabled, setAuthStatus, endBiometricSession, setProfile])

  // ─── Record a successful sign (adds sample to profile) ───────────────────

  const recordSuccessfulSign = useCallback(async () => {
    if (!userId || !enabled) return

    const collector = getCollector(userId)
    // If collector is still active (e.g. no evaluation step ran), stop it
    const sample = collector.isActive()
      ? collector.stopSession()
      : null

    if (!sample) return

    const builder = getBuilder(userId)
    builder.addSample(sample)

    const updatedProfile = builder.getProfile()
    setProfile(updatedProfile)

    // Persist to IndexedDB
    try {
      await persistProfile(updatedProfile)
    } catch {
      // Non-critical: profile saved next time
    }
  }, [userId, enabled, setProfile])

  // ─── Record sign after evaluation (sample already collected) ─────────────

  const recordSignAfterEval = useCallback(async () => {
    if (!userId || !enabled) return

    // The collector session was already stopped during evaluateAndRecord.
    // We need the last sample — keep it separately.
    const collector = getCollector(userId)
    if (collector.isActive()) {
      const sample = collector.stopSession()
      const builder = getBuilder(userId)
      builder.addSample(sample)
      const updatedProfile = builder.getProfile()
      setProfile(updatedProfile)
      try { await persistProfile(updatedProfile) } catch { /* ignore */ }
    }
  }, [userId, enabled, setProfile])

  // ─── Abort (e.g. user cancelled signing) ─────────────────────────────────

  const abort = useCallback(() => {
    if (!userId) return
    const collector = getCollector(userId)
    if (collector.isActive()) collector.stopSession() // discard data
    resetSession()
  }, [userId, resetSession])

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (userId) {
        const collector = getCollector(userId)
        if (collector.isActive()) collector.stopSession()
      }
    }
  }, [userId])

  return {
    // State
    enabled,
    strictMode,
    profile,
    authStatus,
    lastAnomalyResult,
    isEstablished: profile?.isEstablished ?? false,
    samplesNeeded: Math.max(0, 10 - (profile?.sampleCount ?? 0)),

    // Actions
    startCollection,
    evaluateAndRecord,
    recordSuccessfulSign,
    recordSignAfterEval,
    abort,
  }
}
