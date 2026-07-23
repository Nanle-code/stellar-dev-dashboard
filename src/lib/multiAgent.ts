/**
 * Multi-Agent System for Complex Stellar Operations
 * Implements specialized agents that collaborate on:
 *  - Cross-chain / path-payment transactions
 *  - Multi-signature workflows
 *  - Automated trading strategies
 *
 * Architecture:
 *  AgentCoordinator  — top-level orchestrator
 *  MessageBus        — pub/sub between agents
 *  BaseAgent         — abstract base all agents extend
 *  Specialized agents: PaymentAgent, MultisigAgent, TradingAgent, ContractAgent
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentType = 'payment' | 'multisig' | 'trading' | 'contract' | 'coordinator';

export type AgentStatus = 'idle' | 'running' | 'waiting' | 'done' | 'error';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type MessageType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_failed'
  | 'info'
  | 'request'
  | 'response'
  | 'broadcast';

export interface AgentMessage {
  id: string;
  from: string;
  to: string; // agent id or 'broadcast'
  type: MessageType;
  payload: unknown;
  timestamp: number;
}

export interface AgentTask {
  id: string;
  type: AgentType;
  title: string;
  description: string;
  status: TaskStatus;
  assignedAgentId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  dependsOn: string[]; // task ids that must complete first
}

export interface WorkflowStep {
  taskType: AgentType;
  title: string;
  description: string;
  input: Record<string, unknown>;
  dependsOnStep?: number; // index of prerequisite step
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: number;
}

export interface AgentState {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  currentTaskId: string | null;
  completedTaskCount: number;
  errorCount: number;
  lastActivity: number;
}

// ─── Message Bus ──────────────────────────────────────────────────────────────

type MessageHandler = (message: AgentMessage) => void;

export class MessageBus {
  private subscribers: Map<string, MessageHandler[]> = new Map();
  private log: AgentMessage[] = [];

  /** Subscribe an agent to messages addressed to it (or broadcast). */
  subscribe(agentId: string, handler: MessageHandler): () => void {
    const existing = this.subscribers.get(agentId) ?? [];
    this.subscribers.set(agentId, [...existing, handler]);
    return () => this.unsubscribe(agentId, handler);
  }

  unsubscribe(agentId: string, handler: MessageHandler): void {
    const existing = this.subscribers.get(agentId) ?? [];
    this.subscribers.set(agentId, existing.filter((h) => h !== handler));
  }

  publish(message: AgentMessage): void {
    this.log.push(message);
    // Deliver to addressed recipient
    const recipients = this.subscribers.get(message.to) ?? [];
    recipients.forEach((h) => h(message));
    // Also deliver to broadcast subscribers
    if (message.to !== 'broadcast') {
      const broadcastSubs = this.subscribers.get('broadcast') ?? [];
      broadcastSubs.forEach((h) => h(message));
    }
  }

  getLog(): AgentMessage[] {
    return [...this.log];
  }

  clearLog(): void {
    this.log = [];
  }
}

// ─── Base Agent ───────────────────────────────────────────────────────────────

let _agentIdCounter = 0;

function makeAgentId(type: AgentType): string {
  return `${type}-${++_agentIdCounter}`;
}

function makeMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export abstract class BaseAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;

  protected bus: MessageBus;
  protected state: AgentState;
  private unsubscribe: (() => void) | null = null;

  constructor(type: AgentType, name: string, bus: MessageBus) {
    this.id = makeAgentId(type);
    this.type = type;
    this.name = name;
    this.bus = bus;
    this.state = {
      id: this.id,
      type,
      name,
      status: 'idle',
      currentTaskId: null,
      completedTaskCount: 0,
      errorCount: 0,
      lastActivity: Date.now(),
    };
    this.unsubscribe = bus.subscribe(this.id, (msg) => this.onMessage(msg));
  }

  getState(): AgentState {
    return { ...this.state };
  }

  destroy(): void {
    this.unsubscribe?.();
  }

  protected send(to: string, type: MessageType, payload: unknown): void {
    this.bus.publish({
      id: makeMessageId(),
      from: this.id,
      to,
      type,
      payload,
      timestamp: Date.now(),
    });
  }

  protected broadcast(type: MessageType, payload: unknown): void {
    this.send('broadcast', type, payload);
  }

  protected setStatus(status: AgentStatus): void {
    this.state.status = status;
    this.state.lastActivity = Date.now();
  }

  /** Subclasses receive messages directed at them here. */
  protected abstract onMessage(message: AgentMessage): void;

  /** Execute a task assigned to this agent and return updated task. */
  abstract execute(task: AgentTask): Promise<AgentTask>;
}

// ─── Payment Agent ────────────────────────────────────────────────────────────

/**
 * Handles cross-asset path payments and standard XLM / asset transfers.
 * Validates routes via Horizon /paths and computes the best path.
 */
export class PaymentAgent extends BaseAgent {
  constructor(bus: MessageBus) {
    super('payment', 'Payment Agent', bus);
  }

  protected onMessage(message: AgentMessage): void {
    if (message.type === 'task_assigned') {
      this.state.lastActivity = Date.now();
    }
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setStatus('running');
    this.state.currentTaskId = task.id;
    const updated: AgentTask = { ...task, status: 'in_progress', startedAt: Date.now() };

    try {
      const { sourceAccount, destinationAccount, asset, amount, network } =
        task.input as {
          sourceAccount: string;
          destinationAccount: string;
          asset: string;
          amount: string;
          network: string;
        };

      // Validate addresses
      if (!sourceAccount || !destinationAccount) {
        throw new Error('Source and destination accounts are required.');
      }
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new Error('A valid positive amount is required.');
      }

      // Simulate path-payment route discovery
      const paths = await this.discoverPaths(
        sourceAccount,
        destinationAccount,
        asset,
        amount,
        network ?? 'testnet'
      );

      updated.output = {
        status: 'paths_discovered',
        paths,
        recommendedPath: paths[0] ?? null,
        message: paths.length
          ? `Found ${paths.length} path(s). Best route via ${paths[0].via}.`
          : 'No paths found. Direct payment may be possible if both accounts hold the asset.',
      };
      updated.status = 'completed';
      updated.completedAt = Date.now();
      this.state.completedTaskCount++;
      this.setStatus('idle');

      this.send('coordinator', 'task_completed', { taskId: task.id, output: updated.output });
    } catch (err) {
      updated.status = 'failed';
      updated.error = err instanceof Error ? err.message : String(err);
      updated.completedAt = Date.now();
      this.state.errorCount++;
      this.setStatus('error');
      this.send('coordinator', 'task_failed', { taskId: task.id, error: updated.error });
    }

    this.state.currentTaskId = null;
    return updated;
  }

  private async discoverPaths(
    _source: string,
    _dest: string,
    asset: string,
    amount: string,
    _network: string
  ): Promise<Array<{ via: string; fee: string; slippage: string }>> {
    // Simulate async network call
    await new Promise((r) => setTimeout(r, 600));
    if (asset === 'native' || asset === 'XLM') {
      return [{ via: 'Direct XLM', fee: '100 stroops', slippage: '0%' }];
    }
    return [
      { via: `${asset} → XLM → dest`, fee: '200 stroops', slippage: '0.1%' },
      { via: `${asset} → USDC → dest`, fee: '250 stroops', slippage: '0.15%' },
    ];
  }
}

// ─── Multisig Agent ───────────────────────────────────────────────────────────

/**
 * Manages multi-signature workflows: threshold analysis, signer coordination,
 * signature collection progress.
 */
export class MultisigAgent extends BaseAgent {
  constructor(bus: MessageBus) {
    super('multisig', 'Multisig Agent', bus);
  }

  protected onMessage(message: AgentMessage): void {
    if (message.type === 'request' && (message.payload as Record<string, unknown>)?.action === 'check_threshold') {
      this.send(message.from, 'response', {
        action: 'threshold_status',
        ready: false,
        message: 'Still collecting signatures.',
      });
    }
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setStatus('running');
    this.state.currentTaskId = task.id;
    const updated: AgentTask = { ...task, status: 'in_progress', startedAt: Date.now() };

    try {
      const { accountId, transactionXdr, signers, requiredThreshold } =
        task.input as {
          accountId: string;
          transactionXdr?: string;
          signers: string[];
          requiredThreshold: number;
        };

      if (!accountId) throw new Error('Account ID is required for multisig workflow.');
      if (!signers || signers.length === 0) throw new Error('At least one signer is required.');
      if (typeof requiredThreshold !== 'number' || requiredThreshold < 1) {
        throw new Error('Required threshold must be a positive number.');
      }

      await new Promise((r) => setTimeout(r, 500));

      const collectedSignatures = Math.min(signers.length, requiredThreshold);
      const isReady = collectedSignatures >= requiredThreshold;

      updated.output = {
        status: isReady ? 'ready_to_submit' : 'collecting_signatures',
        accountId,
        transactionXdr: transactionXdr ?? null,
        signers,
        requiredThreshold,
        collectedSignatures,
        missingSignatures: Math.max(0, requiredThreshold - collectedSignatures),
        isReady,
        message: isReady
          ? `Threshold met (${collectedSignatures}/${requiredThreshold}). Transaction ready to submit.`
          : `Collected ${collectedSignatures}/${requiredThreshold} signatures. Waiting for more signers.`,
      };
      updated.status = 'completed';
      updated.completedAt = Date.now();
      this.state.completedTaskCount++;
      this.setStatus('idle');
      this.send('coordinator', 'task_completed', { taskId: task.id, output: updated.output });
    } catch (err) {
      updated.status = 'failed';
      updated.error = err instanceof Error ? err.message : String(err);
      updated.completedAt = Date.now();
      this.state.errorCount++;
      this.setStatus('error');
      this.send('coordinator', 'task_failed', { taskId: task.id, error: updated.error });
    }

    this.state.currentTaskId = null;
    return updated;
  }
}

// ─── Trading Agent ────────────────────────────────────────────────────────────

/**
 * Handles automated trading strategies on the SDEX:
 * order book analysis, spread calculation, order placement logic.
 */
export class TradingAgent extends BaseAgent {
  constructor(bus: MessageBus) {
    super('trading', 'Trading Agent', bus);
  }

  protected onMessage(_message: AgentMessage): void {
    // React to coordinator broadcasts or other agents' outputs
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setStatus('running');
    this.state.currentTaskId = task.id;
    const updated: AgentTask = { ...task, status: 'in_progress', startedAt: Date.now() };

    try {
      const { strategy, sellingAsset, buyingAsset, amount, maxSlippage } =
        task.input as {
          strategy: 'market' | 'limit' | 'twap';
          sellingAsset: string;
          buyingAsset: string;
          amount: string;
          maxSlippage?: number;
        };

      if (!sellingAsset || !buyingAsset) throw new Error('Both selling and buying assets are required.');
      if (!amount || parseFloat(amount) <= 0) throw new Error('Amount must be a positive number.');

      await new Promise((r) => setTimeout(r, 700));

      const analysis = this.analyzeStrategy(strategy, sellingAsset, buyingAsset, amount, maxSlippage ?? 1);

      updated.output = analysis;
      updated.status = 'completed';
      updated.completedAt = Date.now();
      this.state.completedTaskCount++;
      this.setStatus('idle');
      this.send('coordinator', 'task_completed', { taskId: task.id, output: updated.output });
    } catch (err) {
      updated.status = 'failed';
      updated.error = err instanceof Error ? err.message : String(err);
      updated.completedAt = Date.now();
      this.state.errorCount++;
      this.setStatus('error');
      this.send('coordinator', 'task_failed', { taskId: task.id, error: updated.error });
    }

    this.state.currentTaskId = null;
    return updated;
  }

  private analyzeStrategy(
    strategy: string,
    sellingAsset: string,
    buyingAsset: string,
    amount: string,
    maxSlippage: number
  ): Record<string, unknown> {
    const simulatedPrice = 1.05 + Math.random() * 0.1;
    const simulatedSpread = 0.002 + Math.random() * 0.003;

    const recommendations: string[] = [];
    if (strategy === 'twap') {
      recommendations.push('Split order into 5 equal tranches over 25 minutes.');
    }
    if (simulatedSpread > 0.004) {
      recommendations.push('Spread is wide — consider limit orders for better execution.');
    }
    if (maxSlippage < simulatedSpread * 100) {
      recommendations.push(`Current spread (${(simulatedSpread * 100).toFixed(2)}%) exceeds your slippage tolerance.`);
    }

    return {
      status: 'analysis_complete',
      strategy,
      pair: `${sellingAsset}/${buyingAsset}`,
      amount,
      simulatedPrice: simulatedPrice.toFixed(6),
      simulatedSpread: (simulatedSpread * 100).toFixed(3) + '%',
      estimatedFill: (parseFloat(amount) * simulatedPrice).toFixed(7),
      maxSlippage: maxSlippage + '%',
      recommendations,
      message: `Strategy "${strategy}" analysed for ${sellingAsset}→${buyingAsset}. ${recommendations.length ? recommendations[0] : 'Conditions look good.'}`,
    };
  }
}

// ─── Contract Agent ───────────────────────────────────────────────────────────

/**
 * Handles Soroban smart-contract interactions:
 * function discovery, argument validation, simulation.
 */
export class ContractAgent extends BaseAgent {
  constructor(bus: MessageBus) {
    super('contract', 'Contract Agent', bus);
  }

  protected onMessage(_message: AgentMessage): void {
    // Respond to requests from other agents needing contract data
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setStatus('running');
    this.state.currentTaskId = task.id;
    const updated: AgentTask = { ...task, status: 'in_progress', startedAt: Date.now() };

    try {
      const { contractId, functionName, args, network } =
        task.input as {
          contractId: string;
          functionName: string;
          args?: unknown[];
          network?: string;
        };

      if (!contractId) throw new Error('Contract ID is required.');
      if (!functionName) throw new Error('Function name is required.');

      await new Promise((r) => setTimeout(r, 800));

      updated.output = {
        status: 'simulation_complete',
        contractId,
        functionName,
        args: args ?? [],
        network: network ?? 'testnet',
        simulatedReturnValue: '{ "type": "u64", "value": 42 }',
        estimatedFee: '1000 stroops',
        footprint: {
          readOnly: [`contract:${contractId}`],
          readWrite: [],
        },
        events: [],
        message: `Simulated ${functionName}() on contract ${contractId.slice(0, 8)}… — estimated fee: 1000 stroops.`,
      };
      updated.status = 'completed';
      updated.completedAt = Date.now();
      this.state.completedTaskCount++;
      this.setStatus('idle');
      this.send('coordinator', 'task_completed', { taskId: task.id, output: updated.output });
    } catch (err) {
      updated.status = 'failed';
      updated.error = err instanceof Error ? err.message : String(err);
      updated.completedAt = Date.now();
      this.state.errorCount++;
      this.setStatus('error');
      this.send('coordinator', 'task_failed', { taskId: task.id, error: updated.error });
    }

    this.state.currentTaskId = null;
    return updated;
  }
}

// ─── Agent Coordinator ────────────────────────────────────────────────────────

let _taskIdCounter = 0;
function makeTaskId(): string {
  return `task-${Date.now()}-${++_taskIdCounter}`;
}

let _workflowIdCounter = 0;
function makeWorkflowId(): string {
  return `wf-${Date.now()}-${++_workflowIdCounter}`;
}

type CoordinatorUpdateCallback = () => void;

export class AgentCoordinator {
  private bus: MessageBus;
  private agents: Map<AgentType, BaseAgent> = new Map();
  private tasks: Map<string, AgentTask> = new Map();
  private onUpdate: CoordinatorUpdateCallback | null = null;

  constructor() {
    this.bus = new MessageBus();

    // Register all specialized agents
    const payment = new PaymentAgent(this.bus);
    const multisig = new MultisigAgent(this.bus);
    const trading = new TradingAgent(this.bus);
    const contract = new ContractAgent(this.bus);

    this.agents.set('payment', payment);
    this.agents.set('multisig', multisig);
    this.agents.set('trading', trading);
    this.agents.set('contract', contract);

    // Coordinator listens on its own channel
    this.bus.subscribe('coordinator', (msg) => {
      if (msg.type === 'task_completed' || msg.type === 'task_failed') {
        this.onUpdate?.();
      }
    });
  }

  /** Register a callback that fires whenever state changes (for React setState). */
  setUpdateCallback(cb: CoordinatorUpdateCallback): void {
    this.onUpdate = cb;
  }

  getAgentStates(): AgentState[] {
    return Array.from(this.agents.values()).map((a) => a.getState());
  }

  getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  getMessageLog(): AgentMessage[] {
    return this.bus.getLog();
  }

  /**
   * Decompose a high-level workflow into individual tasks,
   * assign each to the correct specialist agent, and execute them
   * respecting dependency ordering.
   */
  async runWorkflow(workflow: Workflow): Promise<AgentTask[]> {
    const stepTasks: AgentTask[] = workflow.steps.map((step) => ({
      id: makeTaskId(),
      type: step.taskType,
      title: step.title,
      description: step.description,
      status: 'pending' as TaskStatus,
      assignedAgentId: null,
      input: step.input,
      output: null,
      error: null,
      startedAt: null,
      completedAt: null,
      dependsOn: [],
    }));

    // Wire up dependencies
    workflow.steps.forEach((step, i) => {
      if (step.dependsOnStep !== undefined && step.dependsOnStep >= 0 && step.dependsOnStep < i) {
        stepTasks[i].dependsOn = [stepTasks[step.dependsOnStep].id];
      }
    });

    // Register all tasks
    stepTasks.forEach((t) => this.tasks.set(t.id, t));
    this.onUpdate?.();

    // Execute in dependency order
    const completed = new Set<string>();
    const results: AgentTask[] = [];

    // Simple topological execution: keep iterating until all tasks done
    const maxPasses = stepTasks.length * stepTasks.length + 1;
    let passes = 0;
    while (results.length < stepTasks.length && passes++ < maxPasses) {
      const ready = stepTasks.filter(
        (t) =>
          !completed.has(t.id) &&
          t.dependsOn.every((dep) => completed.has(dep))
      );
      if (ready.length === 0) break;

      await Promise.all(
        ready.map(async (task) => {
          const agent = this.agents.get(task.type);
          if (!agent) {
            const failed: AgentTask = {
              ...task,
              status: 'failed',
              error: `No agent registered for type "${task.type}"`,
              startedAt: Date.now(),
              completedAt: Date.now(),
            };
            this.tasks.set(failed.id, failed);
            completed.add(failed.id);
            results.push(failed);
            this.onUpdate?.();
            return;
          }

          task.assignedAgentId = agent.id;
          this.tasks.set(task.id, { ...task });
          this.onUpdate?.();

          const result = await agent.execute(task);
          this.tasks.set(result.id, result);
          completed.add(result.id);
          results.push(result);
          this.onUpdate?.();
        })
      );
    }

    return results;
  }

  /** Run a single ad-hoc task without a full workflow. */
  async runTask(
    type: AgentType,
    title: string,
    description: string,
    input: Record<string, unknown>
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: makeTaskId(),
      type,
      title,
      description,
      status: 'pending',
      assignedAgentId: null,
      input,
      output: null,
      error: null,
      startedAt: null,
      completedAt: null,
      dependsOn: [],
    };

    this.tasks.set(task.id, task);
    this.onUpdate?.();

    const agent = this.agents.get(type);
    if (!agent) {
      const failed: AgentTask = {
        ...task,
        status: 'failed',
        error: `No agent registered for type "${type}"`,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      this.tasks.set(failed.id, failed);
      this.onUpdate?.();
      return failed;
    }

    task.assignedAgentId = agent.id;
    this.tasks.set(task.id, { ...task });
    this.onUpdate?.();

    const result = await agent.execute(task);
    this.tasks.set(result.id, result);
    this.onUpdate?.();
    return result;
  }

  clearTasks(): void {
    this.tasks.clear();
    this.bus.clearLog();
    this.onUpdate?.();
  }

  destroy(): void {
    this.agents.forEach((a) => a.destroy());
  }
}

// ─── Pre-built Workflows ──────────────────────────────────────────────────────

export function buildCrossChainWorkflow(params: {
  sourceAccount: string;
  destinationAccount: string;
  asset: string;
  amount: string;
  network: string;
}): Workflow {
  return {
    id: makeWorkflowId(),
    name: 'Cross-Chain Payment',
    description: 'Discover the optimal path and prepare a cross-asset payment.',
    createdAt: Date.now(),
    steps: [
      {
        taskType: 'payment',
        title: 'Discover Payment Paths',
        description: 'Analyse available paths for this asset pair.',
        input: { ...params },
      },
    ],
  };
}

export function buildMultisigWorkflow(params: {
  accountId: string;
  transactionXdr?: string;
  signers: string[];
  requiredThreshold: number;
}): Workflow {
  return {
    id: makeWorkflowId(),
    name: 'Multi-Signature Workflow',
    description: 'Coordinate signature collection and threshold verification.',
    createdAt: Date.now(),
    steps: [
      {
        taskType: 'multisig',
        title: 'Collect & Verify Signatures',
        description: 'Check threshold and coordinate signers.',
        input: { ...params },
      },
    ],
  };
}

export function buildTradingWorkflow(params: {
  strategy: 'market' | 'limit' | 'twap';
  sellingAsset: string;
  buyingAsset: string;
  amount: string;
  maxSlippage?: number;
}): Workflow {
  return {
    id: makeWorkflowId(),
    name: 'Automated Trading Strategy',
    description: 'Analyse order book and execute the selected strategy.',
    createdAt: Date.now(),
    steps: [
      {
        taskType: 'trading',
        title: 'Analyse & Execute Strategy',
        description: `Run "${params.strategy}" strategy for ${params.sellingAsset}→${params.buyingAsset}.`,
        input: { ...params },
      },
    ],
  };
}

export function buildContractWorkflow(params: {
  contractId: string;
  functionName: string;
  args?: unknown[];
  network?: string;
}): Workflow {
  return {
    id: makeWorkflowId(),
    name: 'Smart Contract Invocation',
    description: 'Simulate and prepare a Soroban contract call.',
    createdAt: Date.now(),
    steps: [
      {
        taskType: 'contract',
        title: 'Simulate Contract Call',
        description: `Simulate ${params.functionName}() on ${params.contractId?.slice(0, 8) ?? ''}…`,
        input: { ...params },
      },
    ],
  };
}

/** A demo composite workflow that chains payment path discovery → trading analysis. */
export function buildCompositeWorkflow(params: {
  sourceAccount: string;
  destinationAccount: string;
  asset: string;
  amount: string;
  network: string;
  strategy: 'market' | 'limit' | 'twap';
}): Workflow {
  return {
    id: makeWorkflowId(),
    name: 'Composite: Pay + Trade',
    description: 'Discover payment paths then analyse a trading strategy for the same pair.',
    createdAt: Date.now(),
    steps: [
      {
        taskType: 'payment',
        title: 'Discover Payment Paths',
        description: 'Find best routes for the cross-asset transfer.',
        input: {
          sourceAccount: params.sourceAccount,
          destinationAccount: params.destinationAccount,
          asset: params.asset,
          amount: params.amount,
          network: params.network,
        },
      },
      {
        taskType: 'trading',
        title: 'Analyse Trading Strategy',
        description: 'Run order-book analysis after path discovery completes.',
        input: {
          strategy: params.strategy,
          sellingAsset: params.asset,
          buyingAsset: 'XLM',
          amount: params.amount,
        },
        dependsOnStep: 0,
      },
    ],
  };
}
