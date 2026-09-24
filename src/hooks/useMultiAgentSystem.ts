import { useEffect, useState, useCallback } from 'react';
import { AgentOrchestrator, type Task, type Agent } from '../lib/agents/agentFramework';
import {
  AnalyzerAgent,
  ExecutorAgent,
  CoordinatorAgent,
  ValidatorAgent,
  LearnerAgent,
  type AgentConfig,
} from '../lib/agents/specializedAgents';

interface UseMultiAgentSystemReturn {
  orchestrator: AgentOrchestrator | null;
  agents: Agent[];
  isInitialized: boolean;
  isExecuting: boolean;
  error: string | null;
  executeOperation: (operationType: 'cross-chain' | 'multisig' | 'trading' | 'generic', data: Record<string, unknown>, strategy?: string) => Promise<Record<string, unknown>>;
  registerAgent: (config: AgentConfig) => void;
  getMetrics: () => { totalAgents: number; activeAgents: number; totalTasks: number; completedTasks: number; failedTasks: number; averageTaskTime: number; collaborationSuccessRate: number };
}

export function useMultiAgentSystem(): UseMultiAgentSystemReturn {
  const [orchestrator, setOrchestrator] = useState<AgentOrchestrator | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize orchestrator and default agents
  useEffect(() => {
    try {
      const orch = new AgentOrchestrator();

      // Register default specialized agents
      const analyzerConfig: AgentConfig = {
        id: 'analyzer-default',
        name: 'Default Analyzer',
        role: 'analyzer',
        capabilities: ['analyze-chains', 'analyze-market', 'generate-signal'],
      };

      const executorConfig: AgentConfig = {
        id: 'executor-default',
        name: 'Default Executor',
        role: 'executor',
        capabilities: ['execute-swap', 'execute-trade', 'execute-transaction'],
      };

      const coordinatorConfig: AgentConfig = {
        id: 'coordinator-default',
        name: 'Default Coordinator',
        role: 'coordinator',
        capabilities: ['coordinate', 'consensus', 'strategy-selection'],
      };

      const validatorConfig: AgentConfig = {
        id: 'validator-default',
        name: 'Default Validator',
        role: 'validator',
        capabilities: ['validate-route', 'validate-signatures', 'validate-risk'],
      };

      const learnerConfig: AgentConfig = {
        id: 'learner-default',
        name: 'Default Learner',
        role: 'learner',
        capabilities: ['learn', 'optimize', 'improve'],
      };

      // Create instances (for reference, though registry uses simple Agent interface)
      new AnalyzerAgent(analyzerConfig);
      new ExecutorAgent(executorConfig);
      new CoordinatorAgent(coordinatorConfig);
      new ValidatorAgent(validatorConfig);
      new LearnerAgent(learnerConfig);

      // Register agents with orchestrator
      const agentList: Agent[] = [
        {
          id: analyzerConfig.id,
          name: analyzerConfig.name,
          role: 'analyzer',
          capabilities: analyzerConfig.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
        {
          id: executorConfig.id,
          name: executorConfig.name,
          role: 'executor',
          capabilities: executorConfig.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
        {
          id: coordinatorConfig.id,
          name: coordinatorConfig.name,
          role: 'coordinator',
          capabilities: coordinatorConfig.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
        {
          id: validatorConfig.id,
          name: validatorConfig.name,
          role: 'validator',
          capabilities: validatorConfig.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
        {
          id: learnerConfig.id,
          name: learnerConfig.name,
          role: 'learner',
          capabilities: learnerConfig.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        },
      ];

      agentList.forEach((agent) => orch.registerAgent(agent));

      setOrchestrator(orch);
      setAgents(agentList);
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize agent system';
      setError(message);
      console.error('Agent system initialization error:', message);
    }
  }, []);

  const executeOperation = useCallback(
    async (operationType: 'cross-chain' | 'multisig' | 'trading' | 'generic', data: Record<string, unknown>, strategy: string = 'sequential'): Promise<Record<string, unknown>> => {
      if (!orchestrator) {
        throw new Error('Agent system not initialized');
      }

      try {
        setIsExecuting(true);
        setError(null);
        const result = await orchestrator.executeOperation(operationType, data, strategy);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Operation execution failed';
        setError(message);
        console.error('Operation execution error:', message);
        throw err;
      } finally {
        setIsExecuting(false);
      }
    },
    [orchestrator]
  );

  const registerAgent = useCallback(
    (config: AgentConfig) => {
      if (!orchestrator) {
        setError('Agent system not initialized');
        return;
      }

      try {
        const agent: Agent = {
          id: config.id,
          name: config.name,
          role: config.role as any,
          capabilities: config.capabilities,
          status: 'idle',
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        };

        orchestrator.registerAgent(agent);
        setAgents((prev) => [...prev, agent]);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to register agent';
        setError(message);
        console.error('Agent registration error:', message);
      }
    },
    [orchestrator]
  );

  const getMetrics = useCallback(() => {
    if (!orchestrator) {
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageTaskTime: 0,
        collaborationSuccessRate: 0,
      };
    }

    return orchestrator.getMetrics();
  }, [orchestrator]);

  return {
    orchestrator,
    agents,
    isInitialized,
    isExecuting,
    error,
    executeOperation,
    registerAgent,
    getMetrics,
  };
}

export default useMultiAgentSystem;
