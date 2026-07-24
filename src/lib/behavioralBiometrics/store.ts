/**
 * Behavioral Biometrics — Zustand Store Slice
 *
 * Manages in-memory state for the current biometric session.
 * Persistent profile data is stored in IndexedDB (see ../storage.js).
 */

import { create } from 'zustand'
import type { BehavioralProfile } from './profileBuilder'
import type { AnomalyResult } from './anomalyDetector'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BiometricAuthStatus =
  | 'idle'
  | 'collecting'
  | 'evaluating'
  | 'passed'
  | 'failed'
  | 'learning'
  | 'disabled'

export interface BiometricSession {
  sessionId: string
  startedAt: number
  status: BiometricAuthStatus
  lastResult: AnomalyResult | null
  challengeRequired: boolean
}

export interface BehavioralBiometricsState {
  // Profile state
  profile: BehavioralProfile | null
  profileLoading: boolean
  profileError: string | null

  // Session state
  currentSession: BiometricSession | null
  authStatus: BiometricAuthStatus
  lastAnomalyResult: AnomalyResult | null

  // Config
  enabled: boolean
  /** If true, block signing on anomaly. If false, warn only (default). */
  strictMode: boolean

  // Actions
  setProfile: (profile: BehavioralProfile | null) => void
  setProfileLoading: (loading: boolean) => void
  setProfileError: (error: string | null) => void
  startBiometricSession: (sessionId: string) => void
  endBiometricSession: (result: AnomalyResult | null) => void
  setAuthStatus: (status: BiometricAuthStatus) => void
  setLastAnomalyResult: (result: AnomalyResult | null) => void
  setEnabled: (enabled: boolean) => void
  setStrictMode: (strict: boolean) => void
  resetSession: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBiometricStore = create<BehavioralBiometricsState>((set) => ({
  // Profile
  profile: null,
  profileLoading: false,
  profileError: null,

  // Session
  currentSession: null,
  authStatus: 'idle',
  lastAnomalyResult: null,

  // Config — warn-only by default for good UX
  enabled: true,
  strictMode: false,

  // ─── Actions ────────────────────────────────────────────────────────────

  setProfile: (profile) => set({ profile }),
  setProfileLoading: (profileLoading) => set({ profileLoading }),
  setProfileError: (profileError) => set({ profileError }),

  startBiometricSession: (sessionId) =>
    set({
      currentSession: {
        sessionId,
        startedAt: Date.now(),
        status: 'collecting',
        lastResult: null,
        challengeRequired: false,
      },
      authStatus: 'collecting',
      lastAnomalyResult: null,
    }),

  endBiometricSession: (result) =>
    set((state) => {
      let status: BiometricAuthStatus = 'idle'
      if (result === null) {
        status = 'idle'
      } else if (result.isAnomaly) {
        status = 'failed'
      } else if (result.confidence === 0) {
        status = 'learning'
      } else {
        status = 'passed'
      }

      return {
        currentSession: state.currentSession
          ? { ...state.currentSession, status, lastResult: result }
          : null,
        authStatus: status,
        lastAnomalyResult: result,
      }
    }),

  setAuthStatus: (authStatus) => set({ authStatus }),
  setLastAnomalyResult: (lastAnomalyResult) => set({ lastAnomalyResult }),
  setEnabled: (enabled) => set({ enabled }),
  setStrictMode: (strictMode) => set({ strictMode }),

  resetSession: () =>
    set({
      currentSession: null,
      authStatus: 'idle',
      lastAnomalyResult: null,
    }),
}))
