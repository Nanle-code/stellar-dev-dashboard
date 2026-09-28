import { describe, it, expect, beforeEach } from 'vitest';
import {
  sorobanDebuggingTutorialService,
  assertTutorialEnvironment,
  validateSimulationInput,
  TutorialErrorCode,
  SorobanTutorialError,
  SimulationRunRequest,
} from '../sorobanDebuggingTutorial';

describe('Soroban Debugging Tutorial Service', () => {
  beforeEach(() => {
    sorobanDebuggingTutorialService.resetProgress('test-user-1', 'soroban-sim-1');
    sorobanDebuggingTutorialService.resetProgress('test-user-1', 'soroban-auth-1');
    sorobanDebuggingTutorialService.resetProgress('test-user-1', 'soroban-footprint-1');
  });

  describe('Curriculum Catalog & Structure (Primary Flow)', () => {
    it('loads all 3 progressive Soroban debugging modules with valid steps and quizzes', () => {
      const modules = sorobanDebuggingTutorialService.getModules();
      expect(modules.length).toBe(3);

      const simMod = modules.find((m) => m.slug === 'simulation-errors');
      const authMod = modules.find((m) => m.slug === 'auth-failures');
      const footMod = modules.find((m) => m.slug === 'footprint-issues');

      expect(simMod).toBeDefined();
      expect(authMod).toBeDefined();
      expect(footMod).toBeDefined();

      expect(simMod?.category).toBe('simulation');
      expect(authMod?.category).toBe('auth');
      expect(footMod?.category).toBe('footprint');

      // Verify each module has at least 3 progressive steps and at least 2 quiz questions
      for (const mod of modules) {
        expect(mod.steps.length).toBeGreaterThanOrEqual(3);
        expect(mod.quiz.length).toBeGreaterThanOrEqual(2);
        expect(mod.estimatedMinutes).toBeGreaterThan(0);
        expect(mod.prerequisites.length).toBeGreaterThan(0);

        for (const step of mod.steps) {
          expect(step.stepNumber).toBeGreaterThan(0);
          expect(step.title).toBeTruthy();
          expect(step.initialCode).toBeTruthy();
          expect(step.solutionCode).toBeTruthy();
          expect(step.diagnosticHint).toBeTruthy();
        }
      }
    });

    it('retrieves modules by id or slug interchangeably', () => {
      const byId = sorobanDebuggingTutorialService.getModule('soroban-sim-1');
      const bySlug = sorobanDebuggingTutorialService.getModule('simulation-errors');

      expect(byId).toBeDefined();
      expect(bySlug).toBeDefined();
      expect(byId?.id).toBe(bySlug?.id);
    });

    it('retrieves specific steps by module and step number', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('soroban-sim-1', 1);
      const step2 = sorobanDebuggingTutorialService.getStep('soroban-sim-1', 2);

      expect(step1?.stepNumber).toBe(1);
      expect(step2?.stepNumber).toBe(2);
      expect(step1?.title).toContain('Step 1');
    });
  });

  describe('Module 1: Simulation Errors (Primary, Boundary & Failure Paths)', () => {
    it('simulates initial buggy code and reports WASM trap with failure diagnostics', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('simulation-errors', 1)!;
      const request: SimulationRunRequest = {
        moduleId: 'simulation-errors',
        stepNumber: 1,
        contractCode: step1.initialCode,
        environment: 'sandbox',
      };

      const result = sorobanDebuggingTutorialService.runSimulation(request);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe('ERROR');
      expect(result.errorCode).toBe(TutorialErrorCode.SIMULATION_FAILED);
      expect(result.errorMessage).toContain('Simulation trapped');
      expect(result.suggestedFix).toBe(step1.diagnosticHint);
      expect(result.stepCompleted).toBe(false);
      expect(result.diagnosticLogs.some((l) => l.level === 'error')).toBe(true);
      expect(result.consumedCpuInstructions).toBeGreaterThan(90_000_000);
    });

    it('simulates corrected code and reports successful execution and unlocks next step', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('simulation-errors', 1)!;
      const request: SimulationRunRequest = {
        moduleId: 'simulation-errors',
        stepNumber: 1,
        contractCode: step1.solutionCode,
        environment: 'testnet',
      };

      const result = sorobanDebuggingTutorialService.runSimulation(request);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe('SUCCESS');
      expect(result.stepCompleted).toBe(true);
      expect(result.unlockedNextStep).toBe(2);
      expect(result.consumedCpuInstructions).toBeLessThan(10_000_000);
      expect(result.eventsEmitted.length).toBeGreaterThan(0);
    });

    it('supports partial fix using checked_mul regex pattern', () => {
      const partialFix = `pub fn calculate_reward(env: Env, base_amount: u64, multiplier: u64, divisor: u64) -> Option<u64> {
        base_amount.checked_mul(multiplier)
      }`;

      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: 'simulation-errors',
        stepNumber: 1,
        contractCode: partialFix,
        environment: 'testnet',
      });

      expect(result.success).toBe(true);
      expect(result.stepCompleted).toBe(true);
    });
  });

  describe('Module 2: Authorization Failures (Primary & Failure Paths)', () => {
    it('fails when caller authorization is missing', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('auth-failures', 1)!;
      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: 'auth-failures',
        stepNumber: 1,
        contractCode: step1.initialCode,
        environment: 'testnet',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(TutorialErrorCode.AUTH_VERIFICATION_FAILED);
      expect(result.suggestedFix).toBe(step1.diagnosticHint);
      expect(result.authState.some((a) => !a.authorized)).toBe(true);
    });

    it('succeeds when require_auth() is added to contract function', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('auth-failures', 1)!;
      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: 'auth-failures',
        stepNumber: 1,
        contractCode: step1.solutionCode,
        environment: 'testnet',
      });

      expect(result.success).toBe(true);
      expect(result.authState.every((a) => a.authorized)).toBe(true);
      expect(result.stepCompleted).toBe(true);
    });
  });

  describe('Module 3: Footprint Issues (Primary & Failure Paths)', () => {
    it('fails when modifying a read-only footprint key', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('footprint-issues', 1)!;
      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: 'footprint-issues',
        stepNumber: 1,
        contractCode: step1.initialCode,
        environment: 'local',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(TutorialErrorCode.FOOTPRINT_VIOLATION);
      expect(result.errorMessage).toContain('Footprint conflict');
    });

    it('succeeds when readWrite footprint declarations are corrected', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('footprint-issues', 1)!;
      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: 'footprint-issues',
        stepNumber: 1,
        contractCode: step1.solutionCode,
        environment: 'local',
      });

      expect(result.success).toBe(true);
      expect(result.stepCompleted).toBe(true);
      expect(result.footprintState.some((f) => f.access === 'readWrite')).toBe(true);
    });
  });

  describe('Step Progression & Boundary Cases', () => {
    it('records progress across multiple steps and completes the module', () => {
      const userId = 'dev-alice';
      const modId = 'soroban-sim-1';

      // Step 1
      const p1 = sorobanDebuggingTutorialService.recordStepCompletion(userId, modId, 1);
      expect(p1.completedSteps).toEqual([1]);
      expect(p1.currentStep).toBe(2);
      expect(p1.isModuleCompleted).toBe(false);

      // Step 2
      const p2 = sorobanDebuggingTutorialService.recordStepCompletion(userId, modId, 2);
      expect(p2.completedSteps).toEqual([1, 2]);
      expect(p2.currentStep).toBe(3);

      // Step 3 (final step)
      const p3 = sorobanDebuggingTutorialService.recordStepCompletion(userId, modId, 3);
      expect(p3.completedSteps).toEqual([1, 2, 3]);

      // Complete Quiz to finalize module
      const quizRes = sorobanDebuggingTutorialService.submitQuiz(modId, userId, [1, 1]);
      expect(quizRes.passed).toBe(true);
      expect(quizRes.score).toBe(100);

      const finalProgress = sorobanDebuggingTutorialService.getUserProgress(userId, modId);
      expect(finalProgress.isModuleCompleted).toBe(true);
      expect(finalProgress.completedAt).toBeDefined();
    });

    it('handles terminal step boundary where unlockedNextStep is undefined', () => {
      const mod = sorobanDebuggingTutorialService.getModule('soroban-sim-1')!;
      const lastStepNumber = mod.steps.length;
      const lastStep = mod.steps[lastStepNumber - 1];

      const result = sorobanDebuggingTutorialService.runSimulation({
        moduleId: mod.id,
        stepNumber: lastStepNumber,
        contractCode: lastStep.solutionCode,
        environment: 'testnet',
      });

      expect(result.success).toBe(true);
      expect(result.stepCompleted).toBe(true);
      expect(result.unlockedNextStep).toBeUndefined();
    });

    it('handles boundary CPU instruction limits (min 0 and max 200,000,000)', () => {
      const step = sorobanDebuggingTutorialService.getStep('simulation-errors', 1)!;

      // Min boundary
      expect(() => {
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: step.initialCode,
          cpuInstructionsLimit: 0,
        });
      }).not.toThrow();

      // Max boundary
      expect(() => {
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: step.initialCode,
          cpuInstructionsLimit: 200_000_000,
        });
      }).not.toThrow();

      // Exceeded limit throws INVALID_INPUT
      expect(() => {
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: step.initialCode,
          cpuInstructionsLimit: 200_000_001,
        });
      }).toThrowError(/between 0 and 200,000,000/);
    });
  });

  describe('Environment Safety Guards (Mainnet & Unsupported Environments)', () => {
    it('accepts supported testnet, futurenet, local, and sandbox environments', () => {
      expect(assertTutorialEnvironment('testnet')).toBe('testnet');
      expect(assertTutorialEnvironment('futurenet')).toBe('futurenet');
      expect(assertTutorialEnvironment('local')).toBe('local');
      expect(assertTutorialEnvironment('sandbox')).toBe('sandbox');
      expect(assertTutorialEnvironment(undefined)).toBe('sandbox');
    });

    it('rejects Mainnet by default with UNSUPPORTED_ENVIRONMENT error', () => {
      expect(() => {
        assertTutorialEnvironment('mainnet');
      }).toThrowError(SorobanTutorialError);

      try {
        assertTutorialEnvironment('mainnet');
      } catch (err) {
        expect((err as SorobanTutorialError).code).toBe(TutorialErrorCode.UNSUPPORTED_ENVIRONMENT);
      }
    });

    it('allows Mainnet when allowMainnetSimulation override is explicitly enabled', () => {
      const env = assertTutorialEnvironment('mainnet', { allowMainnetSimulation: true });
      expect(env).toBe('mainnet');
    });

    it('rejects unknown or invalid environments', () => {
      expect(() => {
        assertTutorialEnvironment('arbitrary_chain');
      }).toThrowError(/Unsupported environment/);
    });

    it('throws UNSUPPORTED_ENVIRONMENT when running simulation on Mainnet without override', () => {
      const step1 = sorobanDebuggingTutorialService.getStep('simulation-errors', 1)!;
      expect(() => {
        sorobanDebuggingTutorialService.runSimulation({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: step1.solutionCode,
          environment: 'mainnet',
        });
      }).toThrowError(/cannot be executed against Mainnet without explicit sandbox simulation override/);
    });
  });

  describe('Input Validation & Failure Paths', () => {
    it('throws INVALID_INPUT for null or empty request payload', () => {
      // @ts-expect-error test invalid input
      expect(() => validateSimulationInput(null)).toThrowError(
        /cannot be empty/
      );
    });

    it('throws INVALID_INPUT for empty or non-string moduleId', () => {
      // @ts-expect-error test invalid input
      expect(() => validateSimulationInput({ moduleId: '', stepNumber: 1, contractCode: 'fn()' })).toThrowError(
        /must be a non-empty string/
      );
    });

    it('throws INVALID_INPUT for non-positive or float step numbers', () => {
      expect(() =>
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 0,
          contractCode: 'fn()',
        })
      ).toThrowError(/must be a positive integer/);

      expect(() =>
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1.5,
          contractCode: 'fn()',
        })
      ).toThrowError(/must be a positive integer/);
    });

    it('throws INVALID_INPUT for empty contract code', () => {
      expect(() =>
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: '   ',
        })
      ).toThrowError(/non-empty code string/);
    });

    it('throws INVALID_INPUT for malformed contractId', () => {
      expect(() =>
        validateSimulationInput({
          moduleId: 'simulation-errors',
          stepNumber: 1,
          contractCode: 'fn()',
          contractId: 'INVALID_SHORT_ID',
        })
      ).toThrowError(/Invalid Soroban contract ID format/);
    });

    it('throws STEP_NOT_FOUND when requesting non-existent module or step', () => {
      expect(() => {
        sorobanDebuggingTutorialService.runSimulation({
          moduleId: 'non-existent-module',
          stepNumber: 1,
          contractCode: 'code',
          environment: 'sandbox',
        });
      }).toThrowError(/Tutorial module "non-existent-module" not found/);

      expect(() => {
        sorobanDebuggingTutorialService.runSimulation({
          moduleId: 'simulation-errors',
          stepNumber: 99,
          contractCode: 'code',
          environment: 'sandbox',
        });
      }).toThrowError(/Step 99 not found/);
    });
  });

  describe('Quiz Submission & Scoring (Primary, Boundary & Failure Paths)', () => {
    it('evaluates quiz with full score when all answers are correct', () => {
      const res = sorobanDebuggingTutorialService.submitQuiz('simulation-errors', 'user-1', [1, 1]);
      expect(res.passed).toBe(true);
      expect(res.score).toBe(100);
      expect(res.correctAnswersCount).toBe(2);
      expect(res.details.every((d) => d.isCorrect)).toBe(true);
    });

    it('fails quiz when score is below 70% threshold', () => {
      const res = sorobanDebuggingTutorialService.submitQuiz('simulation-errors', 'user-1', [0, 0]);
      expect(res.passed).toBe(false);
      expect(res.score).toBe(0);
      expect(res.details.every((d) => !d.isCorrect)).toBe(true);
    });

    it('throws INVALID_INPUT when answer count does not match question count', () => {
      expect(() => {
        sorobanDebuggingTutorialService.submitQuiz('simulation-errors', 'user-1', [1]);
      }).toThrowError(/Expected 2 answers, but received 1/);
    });

    it('throws QUIZ_NOT_FOUND for invalid module id', () => {
      expect(() => {
        sorobanDebuggingTutorialService.submitQuiz('fake-mod', 'user-1', [0, 1]);
      }).toThrowError(/Tutorial module "fake-mod" not found/);
    });
  });
});
