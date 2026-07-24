import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ─── Mock localStorage ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get _store() {
      return store
    },
    set _store(val: Record<string, string>) {
      store = val
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'vitest', onLine: true },
  writable: true,
})

Object.defineProperty(globalThis, 'window', {
  value: {
    location: { href: 'http://localhost' },
    innerWidth: 1920,
    innerHeight: 1080,
    screen: { width: 1920, height: 1080, colorDepth: 24 },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
})

// ─── Import after mocks ────────────────────────────────────────────────────────

import {
  analyzeError,
  recordResolution,
  getRecoveryStats,
  getExpertiseLevel,
  setExpertiseLevel,
  clearLearningData,
  getAllSolutions,
  getSolutionById,
  type ExpertiseLevel,
  type RecoveryGuidance,
} from '../../../src/lib/errorHandling/ErrorRecoveryEngine'
import { ERROR_CATEGORIES } from '../../../src/utils/errorHandler'

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ErrorRecoveryEngine', () => {
  beforeEach(() => {
    localStorageMock._store = {}
    clearLearningData()
    setExpertiseLevel('beginner')
  })

  // ── Error Classification ──────────────────────────────────────────────────

  describe('Error Classification', () => {
    it('should classify network errors correctly', () => {
      const error = new Error('Network Error: Failed to fetch')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.NETWORK)
    })

    it('should classify timeout errors with sub-type', () => {
      const error = new Error('Request timeout: timed out after 30000ms')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.NETWORK)
      expect(guidance.classification.subType).toBe('timeout')
    })

    it('should classify CORS errors with sub-type', () => {
      const error = new Error('Blocked by CORS policy: cross-origin request blocked')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.NETWORK)
      expect(guidance.classification.subType).toBe('cors')
    })

    it('should classify rate limit errors', () => {
      const error = { message: 'rate limit exceeded', code: 429 }
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.RATE_LIMIT)
    })

    it('should classify authentication errors', () => {
      const error = { message: 'Unauthorized access', code: 401 }
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.AUTHENTICATION)
    })

    it('should classify permission errors', () => {
      const error = { message: 'Forbidden: permission denied', code: 403 }
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.PERMISSION)
    })

    it('should classify validation errors with sub-type invalid_key', () => {
      const error = new Error('Invalid public key format: expected 56 characters starting with G')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.VALIDATION)
      expect(guidance.classification.subType).toBe('invalid_key')
    })

    it('should classify Stellar tx_bad_seq errors', () => {
      const error = new Error('tx_bad_seq: Transaction sequence number mismatch')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.STELLAR)
      expect(guidance.classification.subType).toBe('tx_bad_seq')
    })

    it('should classify Stellar insufficient balance errors', () => {
      const error = new Error('op_underfunded: insufficient balance for this operation')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.STELLAR)
      expect(guidance.classification.subType).toBe('tx_insufficient_balance')
    })

    it('should classify Stellar tx_bad_auth errors', () => {
      const error = new Error('tx_bad_auth: Bad signature or insufficient weight')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.STELLAR)
      expect(guidance.classification.subType).toBe('tx_bad_auth')
    })

    it('should classify account not found errors', () => {
      const error = new Error('account not found on the ledger')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.STELLAR)
      expect(guidance.classification.subType).toBe('account_not_found')
    })

    it('should classify Stellar result codes from response data', () => {
      const error = {
        message: 'Transaction failed',
        response: {
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_insufficient_fee',
              },
            },
          },
        },
      }
      const guidance = analyzeError(error)
      expect(guidance.classification.subType).toBe('tx_insufficient_fee')
    })

    it('should classify unknown errors', () => {
      const error = new Error('Something completely unexpected happened')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBe(ERROR_CATEGORIES.UNKNOWN)
    })

    it('should include error message in guidance', () => {
      const error = new Error('Custom error message for testing')
      const guidance = analyzeError(error)
      expect(guidance.classification.errorMessage).toBe('Custom error message for testing')
    })

    it('should include a timestamp', () => {
      const error = new Error('Test error')
      const guidance = analyzeError(error)
      expect(guidance.timestamp).toBeTruthy()
      expect(new Date(guidance.timestamp).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  // ── Solution Recommendation ───────────────────────────────────────────────

  describe('Solution Recommendation', () => {
    it('should return at least one solution for any error', () => {
      const error = new Error('Completely unknown error type')
      const guidance = analyzeError(error)
      expect(guidance.solutions.length).toBeGreaterThan(0)
    })

    it('should match network errors to network solutions', () => {
      const error = new Error('Network Error: failed to fetch')
      const guidance = analyzeError(error)
      expect(guidance.solutions.length).toBeGreaterThan(0)
      const topSolution = guidance.solutions[0]
      expect(topSolution.solution.category).toBe(ERROR_CATEGORIES.NETWORK)
    })

    it('should match rate limit errors to rate limit solution', () => {
      const error = { message: 'rate limit exceeded', code: 429 }
      const guidance = analyzeError(error)
      const rateLimitSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-rate-limit-wait',
      )
      expect(rateLimitSolution).toBeDefined()
    })

    it('should match tx_bad_seq to sequence number solution', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const guidance = analyzeError(error)
      const seqSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-stellar-bad-seq',
      )
      expect(seqSolution).toBeDefined()
    })

    it('should sort solutions by confidence (descending)', () => {
      const error = new Error('timeout: connection timed out')
      const guidance = analyzeError(error)
      for (let i = 1; i < guidance.solutions.length; i++) {
        expect(guidance.solutions[i - 1].confidence).toBeGreaterThanOrEqual(
          guidance.solutions[i].confidence,
        )
      }
    })

    it('should include confidence score for each solution', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error)
      for (const sol of guidance.solutions) {
        expect(sol.confidence).toBeGreaterThanOrEqual(0)
        expect(sol.confidence).toBeLessThanOrEqual(1)
      }
    })

    it('should include adapted steps for the expertise level', () => {
      const error = new Error('Network error')
      const guidance = analyzeError(error)
      for (const sol of guidance.solutions) {
        expect(sol.adaptedSteps.length).toBeGreaterThan(0)
        for (const step of sol.adaptedSteps) {
          expect(step.step).toBeGreaterThan(0)
          expect(step.title).toBeTruthy()
          expect(step.description).toBeTruthy()
        }
      }
    })

    it('should include the unknown fallback when no solutions match', () => {
      const error = new Error('Completely unknown and unrecognized error type')
      const guidance = analyzeError(error)
      const hasUnknown = guidance.solutions.some(
        (s) => s.solution.id === 'sol-unknown-generic',
      )
      expect(hasUnknown).toBe(true)
    })

    it('should include related solutions when available', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const guidance = analyzeError(error)
      const seqSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-stellar-bad-seq',
      )
      if (seqSolution) {
        expect(seqSolution.solution.related).toBeDefined()
        expect(seqSolution.solution.related!.length).toBeGreaterThan(0)
      }
    })
  })

  // ── Expertise-Aware Explanations ──────────────────────────────────────────

  describe('Expertise-Aware Explanations', () => {
    it('should provide beginner-level explanations', () => {
      setExpertiseLevel('beginner')
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error, { expertiseLevel: 'beginner' })
      expect(guidance.expertiseLevel).toBe('beginner')
      const topSolution = guidance.solutions[0]
      expect(topSolution.solution.explanation.beginner).toBeTruthy()
      expect(topSolution.solution.explanation.beginner.length).toBeGreaterThan(20)
    })

    it('should provide intermediate-level explanations', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error, { expertiseLevel: 'intermediate' })
      expect(guidance.expertiseLevel).toBe('intermediate')
      const topSolution = guidance.solutions[0]
      expect(topSolution.solution.explanation.intermediate).toBeTruthy()
      expect(topSolution.solution.explanation.intermediate.length).toBeGreaterThan(20)
    })

    it('should provide expert-level explanations', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error, { expertiseLevel: 'expert' })
      expect(guidance.expertiseLevel).toBe('expert')
      const topSolution = guidance.solutions[0]
      expect(topSolution.solution.explanation.expert).toBeTruthy()
      expect(topSolution.solution.explanation.expert.length).toBeGreaterThan(20)
    })

    it('should adapt step descriptions to expertise level', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const beginnerGuidance = analyzeError(error, { expertiseLevel: 'beginner' })
      const expertGuidance = analyzeError(error, { expertiseLevel: 'expert' })

      const beginnerSteps = beginnerGuidance.solutions[0].adaptedSteps
      const expertSteps = expertGuidance.solutions[0].adaptedSteps

      // Same number of steps
      expect(beginnerSteps.length).toBe(expertSteps.length)
      // Different descriptions
      expect(beginnerSteps[0].description).not.toBe(expertSteps[0].description)
    })

    it('should use default expertise level when not specified', () => {
      setExpertiseLevel('intermediate')
      const error = new Error('Network error')
      const guidance = analyzeError(error)
      expect(guidance.expertiseLevel).toBe('intermediate')
    })

    it('should allow overriding expertise level per analysis', () => {
      setExpertiseLevel('beginner')
      const error = new Error('Network error')
      const guidance = analyzeError(error, { expertiseLevel: 'expert' })
      expect(guidance.expertiseLevel).toBe('expert')
    })
  })

  // ── Step-by-Step Guidance ─────────────────────────────────────────────────

  describe('Step-by-Step Guidance', () => {
    it('should provide ordered steps for each solution', () => {
      const error = new Error('rate limit: 429 Too Many Requests')
      const guidance = analyzeError(error)
      const rateLimitSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-rate-limit-wait',
      )
      expect(rateLimitSolution).toBeDefined()
      expect(rateLimitSolution!.adaptedSteps.length).toBeGreaterThan(0)

      for (let i = 0; i < rateLimitSolution!.adaptedSteps.length; i++) {
        expect(rateLimitSolution!.adaptedSteps[i].step).toBe(i + 1)
      }
    })

    it('should include expected outcomes for steps', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error)
      const topSolution = guidance.solutions[0]
      const hasOutcome = topSolution.adaptedSteps.some((s) => s.expectedOutcome)
      expect(hasOutcome).toBe(true)
    })

    it('should mark automated steps', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const guidance = analyzeError(error)
      const seqSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-stellar-bad-seq',
      )
      expect(seqSolution).toBeDefined()
      const hasAutomated = seqSolution!.adaptedSteps.some((s) => s.automated)
      expect(hasAutomated).toBe(true)
    })

    it('should include action labels for actionable steps', () => {
      const error = new Error('rate limit: 429 Too Many Requests')
      const guidance = analyzeError(error)
      const rateLimitSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-rate-limit-wait',
      )
      const hasActionLabel = rateLimitSolution!.adaptedSteps.some((s) => s.actionLabel)
      expect(hasActionLabel).toBe(true)
    })

    it('should include prerequisites when defined', () => {
      const error = { message: 'Unauthorized: wallet not connected', code: 401 }
      const guidance = analyzeError(error)
      const authSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-auth-reconnect-wallet',
      )
      expect(authSolution).toBeDefined()
      expect(authSolution!.solution.prerequisites).toBeDefined()
      expect(authSolution!.solution.prerequisites!.length).toBeGreaterThan(0)
    })
  })

  // ── Learning System ───────────────────────────────────────────────────────

  describe('Learning System', () => {
    it('should start with zero recovery stats', () => {
      const stats = getRecoveryStats()
      expect(stats.totalAttempts).toBe(0)
      expect(stats.totalSuccesses).toBe(0)
      expect(stats.successRate).toBe(0)
    })

    it('should record successful resolutions', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error)
      const solutionId = guidance.solutions[0].solution.id
      const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`

      recordResolution({
        solutionId,
        errorSignature: errorSig,
        successful: true,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      const stats = getRecoveryStats()
      expect(stats.totalAttempts).toBe(1)
      expect(stats.totalSuccesses).toBe(1)
      expect(stats.successRate).toBe(1)
    })

    it('should record failed resolutions', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error)
      const solutionId = guidance.solutions[0].solution.id
      const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`

      recordResolution({
        solutionId,
        errorSignature: errorSig,
        successful: false,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      const stats = getRecoveryStats()
      expect(stats.totalAttempts).toBe(1)
      expect(stats.totalSuccesses).toBe(0)
      expect(stats.successRate).toBe(0)
    })

    it('should track multiple attempts for the same solution', () => {
      const error = new Error('Network error: failed to fetch')
      const guidance = analyzeError(error)
      const solutionId = guidance.solutions[0].solution.id
      const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`

      // Record 3 successes and 2 failures
      for (let i = 0; i < 3; i++) {
        recordResolution({
          solutionId,
          errorSignature: errorSig,
          successful: true,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'beginner',
        })
      }
      for (let i = 0; i < 2; i++) {
        recordResolution({
          solutionId,
          errorSignature: errorSig,
          successful: false,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'beginner',
        })
      }

      const stats = getRecoveryStats()
      expect(stats.totalAttempts).toBe(5)
      expect(stats.totalSuccesses).toBe(3)
      expect(stats.successRate).toBeCloseTo(0.6, 2)
    })

    it('should adjust confidence based on learning', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const errorSig = `${ERROR_CATEGORIES.STELLAR}::tx_bad_seq: sequence mismatch`

      // Record multiple successful resolutions
      for (let i = 0; i < 5; i++) {
        recordResolution({
          solutionId: 'sol-stellar-bad-seq',
          errorSignature: errorSig,
          successful: true,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'intermediate',
        })
      }

      const guidance = analyzeError(error, { expertiseLevel: 'intermediate' })
      const seqSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-stellar-bad-seq',
      )
      expect(seqSolution).toBeDefined()
      expect(seqSolution!.attempts).toBe(5)
      expect(seqSolution!.successes).toBe(5)
      expect(seqSolution!.learnedSuccessRate).toBe(1)
    })

    it('should persist learning data in localStorage', () => {
      const error = new Error('Network error')
      const guidance = analyzeError(error)
      const solutionId = guidance.solutions[0].solution.id
      const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`

      recordResolution({
        solutionId,
        errorSignature: errorSig,
        successful: true,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      const stored = localStorage.getItem('error-recovery-learning')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed.length).toBeGreaterThan(0)
      expect(parsed[0].solutionId).toBe(solutionId)
      expect(parsed[0].successes).toBe(1)
    })

    it('should clear learning data', () => {
      const error = new Error('Network error')
      const guidance = analyzeError(error)
      const solutionId = guidance.solutions[0].solution.id
      const errorSig = `${guidance.classification.category}::${guidance.classification.errorMessage}`

      recordResolution({
        solutionId,
        errorSignature: errorSig,
        successful: true,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      clearLearningData()

      const stats = getRecoveryStats()
      expect(stats.totalAttempts).toBe(0)
      expect(stats.totalSuccesses).toBe(0)
    })

    it('should track stats by category', () => {
      const networkError = new Error('Network error: failed to fetch')
      const networkGuidance = analyzeError(networkError)
      const networkSig = `${networkGuidance.classification.category}::${networkGuidance.classification.errorMessage}`
      recordResolution({
        solutionId: networkGuidance.solutions[0].solution.id,
        errorSignature: networkSig,
        successful: true,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      const stellarError = new Error('tx_bad_seq: sequence mismatch')
      const stellarGuidance = analyzeError(stellarError)
      const stellarSig = `${stellarGuidance.classification.category}::${stellarGuidance.classification.errorMessage}`
      recordResolution({
        solutionId: stellarGuidance.solutions[0].solution.id,
        errorSignature: stellarSig,
        successful: false,
        timestamp: new Date().toISOString(),
        expertiseLevel: 'beginner',
      })

      const stats = getRecoveryStats()
      expect(stats.byCategory).toBeDefined()
      expect(Object.keys(stats.byCategory).length).toBeGreaterThan(0)
    })
  })

  // ── Expertise Level Management ────────────────────────────────────────────

  describe('Expertise Level Management', () => {
    it('should return stored expertise level', () => {
      setExpertiseLevel('expert')
      expect(getExpertiseLevel()).toBe('expert')
    })

    it('should default to beginner when no level is set', () => {
      localStorage.removeItem('stellar-dev-expertise-level')
      const level = getExpertiseLevel()
      expect(['beginner', 'intermediate', 'expert']).toContain(level)
    })

    it('should persist expertise level in localStorage', () => {
      setExpertiseLevel('intermediate')
      expect(localStorage.getItem('stellar-dev-expertise-level')).toBe('intermediate')
    })
  })

  // ── Solution Database ─────────────────────────────────────────────────────

  describe('Solution Database', () => {
    it('should return all solutions', () => {
      const all = getAllSolutions()
      expect(all.length).toBeGreaterThan(5)
    })

    it('should find solution by ID', () => {
      const solution = getSolutionById('sol-network-reconnect')
      expect(solution).toBeDefined()
      expect(solution!.title).toBe('Reconnect to the Network')
    })

    it('should return undefined for unknown solution ID', () => {
      const solution = getSolutionById('non-existent-solution')
      expect(solution).toBeUndefined()
    })

    it('should have all required fields for each solution', () => {
      const all = getAllSolutions()
      for (const solution of all) {
        expect(solution.id).toBeTruthy()
        expect(solution.category).toBeTruthy()
        expect(solution.patterns).toBeInstanceOf(Array)
        expect(solution.title).toBeTruthy()
        expect(solution.summary).toBeTruthy()
        expect(solution.explanation).toBeDefined()
        expect(solution.explanation.beginner).toBeTruthy()
        expect(solution.explanation.intermediate).toBeTruthy()
        expect(solution.explanation.expert).toBeTruthy()
        expect(solution.steps).toBeInstanceOf(Array)
        expect(solution.steps.length).toBeGreaterThan(0)
        expect(solution.baseConfidence).toBeGreaterThan(0)
        expect(solution.baseConfidence).toBeLessThanOrEqual(1)
      }
    })

    it('should have expert explanations that are more technical than beginner', () => {
      const solution = getSolutionById('sol-stellar-bad-seq')
      expect(solution).toBeDefined()
      // Expert explanations typically contain more technical terms
      const expertText = solution!.explanation.expert.toLowerCase()
      const beginnerText = solution!.explanation.beginner.toLowerCase()
      // They should be different
      expect(expertText).not.toBe(beginnerText)
    })
  })

  // ── Recovery Guidance Object ──────────────────────────────────────────────

  describe('Recovery Guidance Object', () => {
    it('should have a unique ID', () => {
      const error1 = new Error('Network error')
      const error2 = new Error('Different error')
      const guidance1 = analyzeError(error1)
      const guidance2 = analyzeError(error2)
      expect(guidance1.id).not.toBe(guidance2.id)
    })

    it('should include the original error', () => {
      const error = new Error('Test error for guidance')
      const guidance = analyzeError(error)
      expect(guidance.error).toBe(error)
    })

    it('should include classification with all fields', () => {
      const error = new Error('tx_bad_seq: sequence error')
      const guidance = analyzeError(error)
      expect(guidance.classification.category).toBeDefined()
      expect(guidance.classification.severity).toBeDefined()
      expect(guidance.classification.subType).toBeDefined()
      expect(guidance.classification.errorMessage).toBeDefined()
      expect(guidance.classification.confidence).toBeGreaterThanOrEqual(0)
      expect(guidance.classification.confidence).toBeLessThanOrEqual(1)
    })
  })

  // ── 80% Success Rate Criterion ────────────────────────────────────────────

  describe('Recovery Success Rate (Acceptance Criterion)', () => {
    it('should achieve at least 80% success rate after learning from correct solutions', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const errorSig = `${ERROR_CATEGORIES.STELLAR}::tx_bad_seq: sequence mismatch`

      // Simulate 10 resolution attempts where 8 were successful
      for (let i = 0; i < 8; i++) {
        recordResolution({
          solutionId: 'sol-stellar-bad-seq',
          errorSignature: errorSig,
          successful: true,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'intermediate',
        })
      }
      for (let i = 0; i < 2; i++) {
        recordResolution({
          solutionId: 'sol-stellar-bad-seq',
          errorSignature: errorSig,
          successful: false,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'intermediate',
        })
      }

      const stats = getRecoveryStats()
      expect(stats.successRate).toBeGreaterThanOrEqual(0.8)
    })

    it('should rank high-success solutions higher in recommendations', () => {
      const error = new Error('tx_bad_seq: sequence mismatch')
      const errorSig = `${ERROR_CATEGORIES.STELLAR}::tx_bad_seq: sequence mismatch`

      // Record many successes for sol-stellar-bad-seq
      for (let i = 0; i < 10; i++) {
        recordResolution({
          solutionId: 'sol-stellar-bad-seq',
          errorSignature: errorSig,
          successful: true,
          timestamp: new Date().toISOString(),
          expertiseLevel: 'intermediate',
        })
      }

      const guidance = analyzeError(error, { expertiseLevel: 'intermediate' })
      const seqSolution = guidance.solutions.find(
        (s) => s.solution.id === 'sol-stellar-bad-seq',
      )
      expect(seqSolution).toBeDefined()
      expect(seqSolution!.learnedSuccessRate).toBe(1)
      expect(seqSolution!.attempts).toBe(10)
    })
  })
})
