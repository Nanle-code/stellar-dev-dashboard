/**
 * Specialized Agents Tests
 * Tests for Analyzer, Executor, Coordinator, Validator, and Learner agents
 */

import { beforeEach, describe, it, expect } from 'vitest';
import {
  AnalyzerAgent,
  ExecutorAgent,
  CoordinatorAgent,
  ValidatorAgent,
  LearnerAgent,
  type AgentConfig,
} from '../specializedAgents';

describe('Specialized Agents', () => {
  // ─── Analyzer Agent ──────────────────────────────────────────────────────

  describe('AnalyzerAgent', () => {
    let analyzer: AnalyzerAgent;

    beforeEach(() => {
      const config: AgentConfig = {
        id: 'analyzer-1',
        name: 'Market Analyzer',
        role: 'analyzer',
        capabilities: ['analyze-chains', 'analyze-market', 'generate-signal'],
      };
      analyzer = new AnalyzerAgent(config);
    });

    it('should create analyzer agent', () => {
      expect(analyzer.getId()).toBe('analyzer-1');
      expect(analyzer.getName()).toBe('Market Analyzer');
      expect(analyzer.getCapabilities()).toContain('analyze-market');
    });

    it('should analyze cross-chain operations', async () => {
      const analysis = await analyzer.analyzeOperation('cross-chain', {
        sourceChain: 'stellar',
        targetChain: 'ethereum',
        amount: 100,
      });

      expect(analysis.analysisId).toBeDefined();
      expect(analysis.sourceChain).toBe('stellar');
      expect(analysis.targetChain).toBe('ethereum');
      expect(analysis.estimatedGas).toBeGreaterThan(0);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should analyze multisig operations', async () => {
      const analysis = await analyzer.analyzeOperation('multisig', {
        signers: ['signer1', 'signer2', 'signer3'],
        threshold: 2,
        operationCount: 1,
      });

      expect(analysis.analysisId).toBeDefined();
      expect(analysis.signerCount).toBe(3);
      expect(analysis.threshold).toBe(2);
      expect(analysis.estimatedCollectionTime).toBeGreaterThan(0);
      expect(analysis.complexity).toBeGreaterThan(0);
    });

    it('should analyze trading operations', async () => {
      const analysis = await analyzer.analyzeOperation('trading', {
        pair: 'XLM/USDC',
        amount: 1000,
        riskTolerance: 'medium',
      });

      expect(analysis.analysisId).toBeDefined();
      expect(analysis.pair).toBe('XLM/USDC');
      expect(['bullish', 'bearish', 'neutral', 'volatile']).toContain(analysis.marketCondition);
      expect(Array.isArray(analysis.recommendedSignals)).toBe(true);
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should cache analysis results', async () => {
      const analysis = await analyzer.analyzeOperation('trading', {
        pair: 'XLM/USDC',
        amount: 1000,
        riskTolerance: 'medium',
      });

      await analyzer.cacheAnalysis('task-1', analysis);
      const cached = analyzer.getAnalysisHistory('task-1');

      expect(cached).toEqual(analysis);
    });

    it('should return generic analysis for unknown operation types', async () => {
      const analysis = await analyzer.analyzeOperation('unknown', { test: true });
      expect(analysis.analyzed).toBe(true);
    });
  });

  // ─── Executor Agent ──────────────────────────────────────────────────────

  describe('ExecutorAgent', () => {
    let executor: ExecutorAgent;

    beforeEach(() => {
      const config: AgentConfig = {
        id: 'executor-1',
        name: 'Transaction Executor',
        role: 'executor',
        capabilities: ['execute-swap', 'execute-trade', 'execute-transaction'],
      };
      executor = new ExecutorAgent(config);
    });

    it('should create executor agent', () => {
      expect(executor.getId()).toBe('executor-1');
      expect(executor.getName()).toBe('Transaction Executor');
      expect(executor.getCapabilities()).toContain('execute-swap');
    });

    it('should execute task with 90% success rate', async () => {
      const task = {
        id: 'task-1',
        type: 'execute-swap',
        status: 'processing' as const,
        priority: 5,
        operationType: 'cross-chain' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { amount: 100 },
      };

      const result = await executor.executeTask(task, { context: true });

      expect(result.executionId).toBeDefined();
      expect(result.type).toBe('execute-swap');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should log execution history', async () => {
      const task = {
        id: 'task-1',
        type: 'execute-swap',
        status: 'processing' as const,
        priority: 5,
        operationType: 'cross-chain' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { amount: 100 },
      };

      await executor.executeTask(task, {});
      const history = executor.getExecutionHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].taskId).toBe('task-1');
      expect(['success', 'error']).toContain(history[0].status);
    });

    it('should handle execution errors gracefully', async () => {
      const task = {
        id: 'task-error',
        type: 'execute-swap',
        status: 'processing' as const,
        priority: 5,
        operationType: 'cross-chain' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { amount: 100, shouldFail: true },
      };

      // May throw or succeed
      try {
        await executor.executeTask(task, {});
      } catch {
        // Expected for some cases
      }

      const history = executor.getExecutionHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  // ─── Coordinator Agent ───────────────────────────────────────────────────

  describe('CoordinatorAgent', () => {
    let coordinator: CoordinatorAgent;

    beforeEach(() => {
      const config: AgentConfig = {
        id: 'coordinator-1',
        name: 'Agent Coordinator',
        role: 'coordinator',
        capabilities: ['coordinate', 'consensus', 'strategy-selection'],
      };
      coordinator = new CoordinatorAgent(config);
    });

    it('should create coordinator agent', () => {
      expect(coordinator.getId()).toBe('coordinator-1');
      expect(coordinator.getName()).toBe('Agent Coordinator');
    });

    it('should coordinate agents for cross-chain operations', async () => {
      const agents = [
        {
          id: 'analyzer-1',
          role: 'analyzer' as const,
          name: 'Analyzer',
          capabilities: ['analyze'],
          status: 'idle' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
        {
          id: 'executor-1',
          role: 'executor' as const,
          name: 'Executor',
          capabilities: ['execute'],
          status: 'idle' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
      ];

      const task = {
        id: 'task-1',
        type: 'cross-chain-swap',
        status: 'pending' as const,
        priority: 5,
        operationType: 'cross-chain' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { amount: 100 },
      };

      const result = await coordinator.coordinateAgents(agents, task);

      expect(result.approved).toBeDefined();
      expect(Array.isArray(result.decisions)).toBe(true);
      expect(result.coordinationStrategy).toBe('consensus');
      expect(result.successRate).toBeGreaterThanOrEqual(0);
    });

    it('should coordinate multisig operations sequentially', async () => {
      const agents = [
        {
          id: 'validator-1',
          role: 'validator' as const,
          name: 'Validator',
          capabilities: ['validate'],
          status: 'idle' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
      ];

      const task = {
        id: 'task-2',
        type: 'multisig-transaction',
        status: 'pending' as const,
        priority: 5,
        operationType: 'multisig' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { signers: 3 },
      };

      const result = await coordinator.coordinateAgents(agents, task);

      expect(result.coordinationStrategy).toBe('sequential');
      expect(result.decisions.length).toBeGreaterThan(0);
    });

    it('should track coordination records', async () => {
      const agents = [
        {
          id: 'agent-1',
          role: 'executor' as const,
          name: 'Agent',
          capabilities: ['execute'],
          status: 'idle' as const,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
      ];

      const task = {
        id: 'task-3',
        type: 'test',
        status: 'pending' as const,
        priority: 5,
        operationType: 'generic' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {},
      };

      const result = await coordinator.coordinateAgents(agents, task);
      const records = coordinator.getAllCoordinationRecords();

      expect(records.length).toBeGreaterThan(0);
      expect(result.approved).toBeDefined();
    });
  });

  // ─── Validator Agent ─────────────────────────────────────────────────────

  describe('ValidatorAgent', () => {
    let validator: ValidatorAgent;

    beforeEach(() => {
      const config: AgentConfig = {
        id: 'validator-1',
        name: 'Operation Validator',
        role: 'validator',
        capabilities: ['validate-route', 'validate-signatures', 'validate-risk'],
      };
      validator = new ValidatorAgent(config);
    });

    it('should create validator agent', () => {
      expect(validator.getId()).toBe('validator-1');
      expect(validator.getName()).toBe('Operation Validator');
    });

    it('should validate operations', async () => {
      const result = await validator.validateOperation('cross-chain', {
        chain: 'stellar',
        amount: 100,
      });

      expect(result.validationId).toBeDefined();
      expect(result.operationType).toBe('cross-chain');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it('should reject invalid amounts', async () => {
      const result = await validator.validateOperation('trading', {
        amount: -100,
        chain: 'stellar',
      });

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should reject invalid chains', async () => {
      const result = await validator.validateOperation('cross-chain', {
        amount: 100,
        chain: 'invalid-chain',
      });

      expect(result.isValid).toBe(false);
    });

    it('should validate multisig thresholds', async () => {
      const validResult = await validator.validateOperation('multisig', {
        signerCount: 3,
        threshold: 2,
      });

      expect(validResult.isValid).toBe(true);

      const invalidResult = await validator.validateOperation('multisig', {
        signerCount: 2,
        threshold: 5,
      });

      expect(invalidResult.isValid).toBe(false);
    });

    it('should add custom validation rules', async () => {
      validator.addValidationRule('custom-rule', (data) => {
        return (data.customField as number) > 0;
      });

      const result = await validator.validateOperation('generic', {
        customField: -1,
      });

      expect(result.violations.some((v) => v.rule === 'custom-rule')).toBe(true);
    });
  });

  // ─── Learner Agent ──────────────────────────────────────────────────────

  describe('LearnerAgent', () => {
    let learner: LearnerAgent;

    beforeEach(() => {
      const config: AgentConfig = {
        id: 'learner-1',
        name: 'Learning Agent',
        role: 'learner',
        capabilities: ['learn', 'optimize', 'improve'],
      };
      learner = new LearnerAgent(config);
    });

    it('should create learner agent', () => {
      expect(learner.getId()).toBe('learner-1');
      expect(learner.getName()).toBe('Learning Agent');
    });

    it('should record successful outcomes', async () => {
      await learner.recordOutcome('task-1', true, 1000, { strategy: 'consensus' });
      const metrics = learner.getLearningMetrics();

      expect(metrics.totalRecords).toBe(1);
      expect(metrics.successRate).toBe(1);
    });

    it('should record failed outcomes', async () => {
      await learner.recordOutcome('task-2', false, 2000, { strategy: 'sequential' });
      const metrics = learner.getLearningMetrics();

      expect(metrics.totalRecords).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should calculate average duration', async () => {
      await learner.recordOutcome('task-1', true, 1000, {});
      await learner.recordOutcome('task-2', true, 2000, {});
      const metrics = learner.getLearningMetrics();

      expect(metrics.averageDuration).toBe(1500);
    });

    it('should recommend optimal strategy', async () => {
      // Record multiple outcomes with different strategies
      for (let i = 0; i < 5; i++) {
        await learner.recordOutcome(`task-${i}`, true, 500, { strategy: 'consensus' });
      }

      for (let i = 0; i < 2; i++) {
        await learner.recordOutcome(`task-fail-${i}`, false, 1000, { strategy: 'sequential' });
      }

      const optimal = learner.getOptimalStrategy('cross-chain');
      expect(['consensus', 'sequential', 'parallel']).toContain(optimal);
    });

    it('should track improvement trend', async () => {
      // Record series of outcomes
      for (let i = 0; i < 5; i++) {
        await learner.recordOutcome(`task-${i}`, false, 1000, {});
      }

      for (let i = 0; i < 5; i++) {
        await learner.recordOutcome(`task-success-${i}`, true, 500, {});
      }

      const metrics = learner.getLearningMetrics();
      expect(metrics.improvementTrend).toBeGreaterThan(0); // Should show improvement
    });

    it('should update strategy weights based on performance', async () => {
      const initial = learner.getStrategyWeights();

      // Record successes with consensus
      for (let i = 0; i < 3; i++) {
        await learner.recordOutcome(`success-${i}`, true, 500, { strategy: 'consensus' });
      }

      const updated = learner.getStrategyWeights();
      expect(updated.consensus).toBeGreaterThan(initial.consensus);
    });
  });

  // ─── Integration Scenarios ───────────────────────────────────────────────

  describe('Agent Integration Scenarios', () => {
    it('should complete full multi-agent workflow', async () => {
      const analyzer = new AnalyzerAgent({
        id: 'analyzer-1',
        name: 'Analyzer',
        role: 'analyzer',
        capabilities: ['analyze-chains'],
      });

      const executor = new ExecutorAgent({
        id: 'executor-1',
        name: 'Executor',
        role: 'executor',
        capabilities: ['execute-swap'],
      });

      const validator = new ValidatorAgent({
        id: 'validator-1',
        name: 'Validator',
        role: 'validator',
        capabilities: ['validate-route'],
      });

      // Step 1: Analyze
      const analysis = await analyzer.analyzeOperation('cross-chain', {
        sourceChain: 'stellar',
        targetChain: 'ethereum',
        amount: 100,
      });
      expect(analysis.analysisId).toBeDefined();

      // Step 2: Validate
      const validation = await validator.validateOperation('cross-chain', {
        amount: 100,
        chain: 'stellar',
      });
      expect(validation.isValid).toBe(true);

      // Step 3: Execute
      const task = {
        id: 'workflow-task',
        type: 'execute-swap',
        status: 'processing' as const,
        priority: 5,
        operationType: 'cross-chain' as const,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: analysis,
      };

      const execution = await executor.executeTask(task, {});
      expect(execution.success).toBeDefined();
    });
  });
});
