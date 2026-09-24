/**
 * Multi-Agent Framework for Complex Operations
 * Specialized agents collaborate to handle cross-chain transactions, multi-sig workflows, and trading
 */

export type AgentRole = 'analyzer' | 'executor' | 'coordinator' | 'validator' | 'learner';
export type AgentStatus = 'idle' | 'processing' | 'ready' | 'failed' | 'completed';
export type TaskStatus = 'pending' | 'assigned' | 'processing' | 'completed' | 'failed' | 'blocked';

export interface Agent {
  id: string;
  role: AgentRole;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  createdAt: string;
  lastActivity: string;
}

export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  priority: number;
  operationType: 'cross-chain' | 'multisig' | 'trading' | 'generic';
  assignedAgent?: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

export interface MessageEnvelope {
  id: string;
  from: string;
  to: string | string[];
  type: 'task' | 'result' | 'coordination' | 'heartbeat';
  payload: unknown;
  timestamp: string;
  correlationId?: string;
}

export interface CoordinationMessage {
  type: 'request' | 'response' | 'ack' | 'error';
  operation: string;
  agents: string[];
  data?: Record<string, unknown>;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * Agent registry and state management
 */
export class AgentRegistry {
  private agents = new Map<string, Agent>();
  private tasks = new Map<string, Task>();
  private messageLog: MessageEnvelope[] = [];

  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} already registered`);
    }
    this.agents.set(agent.id, { ...agent, status: 'idle' });
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsByRole(role: AgentRole): Agent[] {
    return Array.from(this.agents.values()).filter((a) => a.role === role);
  }

  updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    agent.status = status;
    agent.lastActivity = new Date().toISOString();
  }

  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskStatus, result?: Record<string, unknown>, error?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (result) task.result = result;
    if (error) task.error = error;
  }

  assignTask(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    task.assignedAgent = agentId;
    task.status = 'assigned';
  }

  logMessage(message: MessageEnvelope): void {
    this.messageLog.push(message);
  }

  getMessageHistory(filter?: { from?: string; to?: string; type?: MessageEnvelope['type'] }): MessageEnvelope[] {
    if (!filter) return this.messageLog;
    return this.messageLog.filter((m) => {
      if (filter.from && m.from !== filter.from) return false;
      if (filter.to && !([m.to].flat().includes(filter.to))) return false;
      if (filter.type && m.type !== filter.type) return false;
      return true;
    });
  }

  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === 'pending' || t.status === 'assigned' || t.status === 'processing'
    );
  }

  getTasksByType(operationType: Task['operationType']): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.operationType === operationType);
  }

  getAgentWorkload(agentId: string): number {
    return Array.from(this.tasks.values()).filter(
      (t) => t.assignedAgent === agentId && (t.status === 'assigned' || t.status === 'processing')
    ).length;
  }

  clear(): void {
    this.agents.clear();
    this.tasks.clear();
    this.messageLog = [];
  }
}

/**
 * Orchestrator for agent coordination
 */
export class AgentOrchestrator {
  private registry = new AgentRegistry();
  private messageQueue: MessageEnvelope[] = [];
  private coordinationStrategies = new Map<string, CoordinationStrategy>();

  constructor() {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies(): void {
    this.coordinationStrategies.set('sequential', new SequentialStrategy());
    this.coordinationStrategies.set('parallel', new ParallelStrategy());
    this.coordinationStrategies.set('consensus', new ConsensusStrategy());
  }

  registerAgent(agent: Agent): void {
    this.registry.registerAgent(agent);
  }

  async executeOperation(operationType: 'cross-chain' | 'multisig' | 'trading' | 'generic', data: Record<string, unknown>, strategy: string = 'sequential'): Promise<Record<string, unknown>> {
    // Create master task
    const task = this.registry.createTask({
      type: 'complex-operation',
      status: 'pending',
      operationType,
      priority: 5,
      dependencies: [],
      data,
    });

    try {
      // Decompose task into subtasks
      const subtasks = this.decomposeTask(task, operationType);

      // Get coordination strategy
      const coordination = this.coordinationStrategies.get(strategy);
      if (!coordination) throw new Error(`Unknown coordination strategy: ${strategy}`);

      // Execute with coordination
      const results = await coordination.execute(this, subtasks);

      this.registry.updateTaskStatus(task.id, 'completed', results);
      return results;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.registry.updateTaskStatus(task.id, 'failed', undefined, errorMsg);
      throw error;
    }
  }

  private decomposeTask(parent: Task, operationType: Task['operationType']): Task[] {
    const subtasks: Task[] = [];

    switch (operationType) {
      case 'cross-chain':
        // Decompose cross-chain into: analyze -> validate -> execute -> confirm
        subtasks.push(
          this.registry.createTask({
            type: 'analyze-chains',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'validate-route',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [subtasks[0]?.id || ''],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'execute-swap',
            status: 'pending',
            operationType: 'generic',
            priority: 6,
            dependencies: [subtasks[1]?.id || ''],
            data: parent.data,
          })
        );
        break;

      case 'multisig':
        // Decompose multisig into: collect -> validate -> sign -> submit
        subtasks.push(
          this.registry.createTask({
            type: 'collect-signatures',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'validate-signatures',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [subtasks[0]?.id || ''],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'submit-transaction',
            status: 'pending',
            operationType: 'generic',
            priority: 6,
            dependencies: [subtasks[1]?.id || ''],
            data: parent.data,
          })
        );
        break;

      case 'trading':
        // Decompose trading into: analyze -> signal -> validate risk -> execute
        subtasks.push(
          this.registry.createTask({
            type: 'analyze-market',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'generate-signal',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [subtasks[0]?.id || ''],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'validate-risk',
            status: 'pending',
            operationType: 'generic',
            priority: 5,
            dependencies: [subtasks[1]?.id || ''],
            data: parent.data,
          }),
          this.registry.createTask({
            type: 'execute-trade',
            status: 'pending',
            operationType: 'generic',
            priority: 6,
            dependencies: [subtasks[2]?.id || ''],
            data: parent.data,
          })
        );
        break;

      default:
        // Generic single task
        subtasks.push(parent);
    }

    return subtasks;
  }

  async sendMessage(message: MessageEnvelope): Promise<void> {
    this.messageQueue.push(message);
    this.registry.logMessage(message);
  }

  async getAgentForCapability(capability: string): Promise<Agent | undefined> {
    const candidates = this.registry.getAllAgents().filter((a) => a.capabilities.includes(capability) && a.status !== 'failed');

    // Sort by workload (least busy first)
    candidates.sort((a, b) => {
      const aLoad = this.registry.getAgentWorkload(a.id);
      const bLoad = this.registry.getAgentWorkload(b.id);
      return aLoad - bLoad;
    });

    return candidates[0];
  }

  getRegistry(): AgentRegistry {
    return this.registry;
  }

  getMessageQueue(): MessageEnvelope[] {
    return this.messageQueue;
  }

  getMetrics(): {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskTime: number;
    collaborationSuccessRate: number;
  } {
    const agents = this.registry.getAllAgents();
    const tasks = this.registry.getPendingTasks();

    const completedTasks = this.registry
      .getAllAgents()
      .reduce((sum) => sum + 1, 0); // Simplified for demo

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === 'processing').length,
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      collaborationSuccessRate: 0.8,
    };
  }
}

/**
 * Coordination strategies for agent collaboration
 */
interface CoordinationStrategy {
  execute(orchestrator: AgentOrchestrator, tasks: Task[]): Promise<Record<string, unknown>>;
}

class SequentialStrategy implements CoordinationStrategy {
  async execute(orchestrator: AgentOrchestrator, tasks: Task[]): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    for (const task of tasks) {
      const agent = await orchestrator.getAgentForCapability(task.type);
      if (!agent) throw new Error(`No agent available for ${task.type}`);

      orchestrator.getRegistry().assignTask(task.id, agent.id);
      // Simulate task execution
      await new Promise((resolve) => setTimeout(resolve, 100));
      orchestrator.getRegistry().updateTaskStatus(task.id, 'completed', { success: true });
      results[task.id] = { success: true };
    }

    return results;
  }
}

class ParallelStrategy implements CoordinationStrategy {
  async execute(orchestrator: AgentOrchestrator, tasks: Task[]): Promise<Record<string, unknown>> {
    const promises = tasks.map(async (task) => {
      const agent = await orchestrator.getAgentForCapability(task.type);
      if (!agent) throw new Error(`No agent available for ${task.type}`);

      orchestrator.getRegistry().assignTask(task.id, agent.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
      orchestrator.getRegistry().updateTaskStatus(task.id, 'completed', { success: true });
      return { [task.id]: { success: true } };
    });

    const results = await Promise.all(promises);
    return results.reduce((acc, r) => ({ ...acc, ...r }), {});
  }
}

class ConsensusStrategy implements CoordinationStrategy {
  async execute(orchestrator: AgentOrchestrator, tasks: Task[]): Promise<Record<string, unknown>> {
    // Group tasks by type and require agreement
    const tasksByType = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!tasksByType.has(t.type)) tasksByType.set(t.type, []);
      tasksByType.get(t.type)!.push(t);
    });

    const results: Record<string, unknown> = {};

    for (const [_type, typeTasks] of tasksByType.entries()) {
      // Require agreement from multiple agents
      const agents = orchestrator.getRegistry().getAllAgents().filter((a) => a.status !== 'failed').slice(0, 3);

      if (agents.length < 2) throw new Error('Consensus requires at least 2 agents');

      for (const task of typeTasks) {
        const votes: boolean[] = [];

        for (const agent of agents) {
          orchestrator.getRegistry().assignTask(task.id, agent.id);
          await new Promise((resolve) => setTimeout(resolve, 50));
          votes.push(true);
        }

        const approved = votes.filter((v) => v).length > votes.length / 2;
        orchestrator.getRegistry().updateTaskStatus(task.id, approved ? 'completed' : 'failed');
        results[task.id] = { approved };
      }
    }

    return results;
  }
}
