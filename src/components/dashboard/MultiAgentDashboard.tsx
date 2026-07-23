import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AgentCoordinator,
  AgentState,
  AgentTask,
  AgentMessage,
  AgentType,
  buildCrossChainWorkflow,
  buildMultisigWorkflow,
  buildTradingWorkflow,
  buildContractWorkflow,
  buildCompositeWorkflow,
} from '../../lib/multiAgent';
import { useStore } from '../../lib/store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: 'var(--accent)',
  waiting: '#f59e0b',
  done: '#10b981',
  error: 'var(--error, #ef4444)',
  pending: 'var(--text-muted)',
  in_progress: 'var(--accent)',
  completed: '#10b981',
  failed: 'var(--error, #ef4444)',
};

const AGENT_ICONS: Record<AgentType | string, string> = {
  payment: '💸',
  multisig: '🔐',
  trading: '📈',
  contract: '📜',
  coordinator: '🧠',
};

function statusDot(status: string) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: STATUS_COLOR[status] ?? 'var(--text-muted)',
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function sectionTitle(text: string) {
  return (
    <h3
      style={{
        margin: '0 0 14px',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}
    >
      {text}
    </h3>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-card, var(--bg))',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 13,
    boxSizing: 'border-box',
  };
}

function labelStyle(): React.CSSProperties {
  return { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 };
}

function field(label: string, input: React.ReactNode) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={labelStyle()}>{label}</label>
      {input}
    </div>
  );
}

// ─── Workflow Form Components ─────────────────────────────────────────────────

interface PaymentFormProps { onRun: (params: Record<string, unknown>) => void; loading: boolean; defaultAccount: string; }
function PaymentForm({ onRun, loading, defaultAccount }: PaymentFormProps) {
  const [src, setSrc] = useState(defaultAccount);
  const [dst, setDst] = useState('');
  const [asset, setAsset] = useState('native');
  const [amount, setAmount] = useState('10');
  const { network } = useStore();

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRun({ sourceAccount: src, destinationAccount: dst, asset, amount, network }); }}>
      {field('Source Account', <input style={inputStyle()} value={src} onChange={e => setSrc(e.target.value)} placeholder="G..." />)}
      {field('Destination Account', <input style={inputStyle()} value={dst} onChange={e => setDst(e.target.value)} placeholder="G..." required />)}
      {field('Asset', <input style={inputStyle()} value={asset} onChange={e => setAsset(e.target.value)} placeholder="native or CODE:ISSUER" />)}
      {field('Amount', <input style={inputStyle()} value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0.0000001" step="any" required />)}
      <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
        {loading ? 'Running…' : 'Run'}
      </button>
    </form>
  );
}

interface MultisigFormProps { onRun: (params: Record<string, unknown>) => void; loading: boolean; defaultAccount: string; }
function MultisigForm({ onRun, loading, defaultAccount }: MultisigFormProps) {
  const [accountId, setAccountId] = useState(defaultAccount);
  const [signers, setSigners] = useState('');
  const [threshold, setThreshold] = useState(2);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRun({ accountId, signers: signers.split(',').map(s => s.trim()).filter(Boolean), requiredThreshold: threshold }); }}>
      {field('Account ID', <input style={inputStyle()} value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="G..." />)}
      {field('Signers (comma-separated)', <input style={inputStyle()} value={signers} onChange={e => setSigners(e.target.value)} placeholder="GABC…, GDEF…" required />)}
      {field('Required Threshold', <input style={inputStyle()} value={threshold} onChange={e => setThreshold(Number(e.target.value))} type="number" min={1} required />)}
      <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
        {loading ? 'Running…' : 'Run'}
      </button>
    </form>
  );
}

interface TradingFormProps { onRun: (params: Record<string, unknown>) => void; loading: boolean; }
function TradingForm({ onRun, loading }: TradingFormProps) {
  const [strategy, setStrategy] = useState<'market' | 'limit' | 'twap'>('market');
  const [selling, setSelling] = useState('XLM');
  const [buying, setBuying] = useState('USDC');
  const [amount, setAmount] = useState('100');
  const [slippage, setSlippage] = useState(1);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRun({ strategy, sellingAsset: selling, buyingAsset: buying, amount, maxSlippage: slippage }); }}>
      {field('Strategy', (
        <select style={inputStyle()} value={strategy} onChange={e => setStrategy(e.target.value as 'market' | 'limit' | 'twap')}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="twap">TWAP</option>
        </select>
      ))}
      {field('Selling Asset', <input style={inputStyle()} value={selling} onChange={e => setSelling(e.target.value)} placeholder="XLM" required />)}
      {field('Buying Asset', <input style={inputStyle()} value={buying} onChange={e => setBuying(e.target.value)} placeholder="USDC" required />)}
      {field('Amount', <input style={inputStyle()} value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="any" required />)}
      {field('Max Slippage %', <input style={inputStyle()} value={slippage} onChange={e => setSlippage(Number(e.target.value))} type="number" min={0} max={100} step={0.1} />)}
      <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
        {loading ? 'Running…' : 'Run'}
      </button>
    </form>
  );
}

interface ContractFormProps { onRun: (params: Record<string, unknown>) => void; loading: boolean; }
function ContractForm({ onRun, loading }: ContractFormProps) {
  const [contractId, setContractId] = useState('');
  const [fnName, setFnName] = useState('');
  const [args, setArgs] = useState('');
  const { network } = useStore();

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRun({ contractId, functionName: fnName, args: args ? args.split(',').map(a => a.trim()) : [], network }); }}>
      {field('Contract ID', <input style={inputStyle()} value={contractId} onChange={e => setContractId(e.target.value)} placeholder="C..." required />)}
      {field('Function Name', <input style={inputStyle()} value={fnName} onChange={e => setFnName(e.target.value)} placeholder="transfer" required />)}
      {field('Arguments (comma-separated)', <input style={inputStyle()} value={args} onChange={e => setArgs(e.target.value)} placeholder="arg1, arg2" />)}
      <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
        {loading ? 'Running…' : 'Run'}
      </button>
    </form>
  );
}

interface CompositeFormProps { onRun: (params: Record<string, unknown>) => void; loading: boolean; defaultAccount: string; }
function CompositeForm({ onRun, loading, defaultAccount }: CompositeFormProps) {
  const [src, setSrc] = useState(defaultAccount);
  const [dst, setDst] = useState('');
  const [asset, setAsset] = useState('USDC');
  const [amount, setAmount] = useState('50');
  const [strategy, setStrategy] = useState<'market' | 'limit' | 'twap'>('twap');
  const { network } = useStore();

  return (
    <form onSubmit={(e) => { e.preventDefault(); onRun({ sourceAccount: src, destinationAccount: dst, asset, amount, network, strategy }); }}>
      {field('Source Account', <input style={inputStyle()} value={src} onChange={e => setSrc(e.target.value)} placeholder="G..." />)}
      {field('Destination Account', <input style={inputStyle()} value={dst} onChange={e => setDst(e.target.value)} placeholder="G..." required />)}
      {field('Asset', <input style={inputStyle()} value={asset} onChange={e => setAsset(e.target.value)} placeholder="USDC" />)}
      {field('Amount', <input style={inputStyle()} value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="any" required />)}
      {field('Trading Strategy', (
        <select style={inputStyle()} value={strategy} onChange={e => setStrategy(e.target.value as 'market' | 'limit' | 'twap')}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="twap">TWAP</option>
        </select>
      ))}
      <button type="submit" disabled={loading} style={{ marginTop: 4, padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13 }}>
        {loading ? 'Running…' : 'Run Composite Workflow'}
      </button>
    </form>
  );
}

// ─── Agent Status Panel ───────────────────────────────────────────────────────

function AgentStatusPanel({ agents }: { agents: AgentState[] }) {
  return card(
    <>
      {sectionTitle('Active Agents')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {agents.map((agent) => (
          <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{AGENT_ICONS[agent.type]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>
                {statusDot(agent.status)}
                {agent.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Status: <span style={{ color: STATUS_COLOR[agent.status] ?? 'inherit' }}>{agent.status}</span>
                {' · '}{agent.completedTaskCount} done
                {agent.errorCount > 0 && <span style={{ color: STATUS_COLOR.error }}> · {agent.errorCount} err</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Task List Panel ──────────────────────────────────────────────────────────

function TaskListPanel({ tasks, onClear }: { tasks: AgentTask[]; onClear: () => void }) {
  return card(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        {sectionTitle('Tasks')}
        {tasks.length > 0 && (
          <button
            onClick={onClear}
            style={{ fontSize: 11, padding: '3px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>
      {tasks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No tasks yet. Run a workflow to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(false);
  const duration =
    task.startedAt && task.completedAt
      ? `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
      : task.startedAt
      ? 'running…'
      : null;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'var(--bg-card, var(--bg))',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>{AGENT_ICONS[task.type]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {statusDot(task.status)}
            {task.title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {task.type} · <span style={{ color: STATUS_COLOR[task.status] }}>{task.status}</span>
            {duration && ` · ${duration}`}
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', fontSize: 12 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{task.description}</div>
          {task.error && (
            <div style={{ color: STATUS_COLOR.error, marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,0.1)', borderRadius: 5 }}>
              ✗ {task.error}
            </div>
          )}
          {task.output && (
            <pre style={{
              margin: 0,
              padding: '8px 10px',
              background: 'var(--bg)',
              borderRadius: 5,
              fontSize: 11,
              color: 'var(--text)',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {JSON.stringify(task.output, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message Log Panel ────────────────────────────────────────────────────────

function MessageLogPanel({ messages }: { messages: AgentMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return card(
    <>
      {sectionTitle('Agent Communication Log')}
      <div
        style={{
          height: 200,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        {messages.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>No messages yet.</span>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={{ color: 'var(--text)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(msg.timestamp).toLocaleTimeString()} </span>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>[{msg.from}]</span>
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: '#f59e0b' }}>[{msg.to}]</span>
              <span style={{ color: 'var(--text-muted)' }}> {msg.type}: </span>
              <span>{JSON.stringify(msg.payload).slice(0, 80)}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────

type WorkflowKey = 'payment' | 'multisig' | 'trading' | 'contract' | 'composite';

const WORKFLOWS: { key: WorkflowKey; label: string; icon: string; description: string }[] = [
  { key: 'payment',   label: 'Cross-Chain Payment',      icon: '💸', description: 'Discover optimal paths for cross-asset transfers.' },
  { key: 'multisig',  label: 'Multi-Sig Workflow',        icon: '🔐', description: 'Coordinate signers and verify threshold requirements.' },
  { key: 'trading',   label: 'Automated Trading',         icon: '📈', description: 'Analyse SDEX order book and execute a trading strategy.' },
  { key: 'contract',  label: 'Contract Invocation',       icon: '📜', description: 'Simulate a Soroban smart contract call.' },
  { key: 'composite', label: 'Composite (Pay + Trade)',   icon: '🔗', description: 'Chain payment path discovery with a trading strategy.' },
];

export default function MultiAgentDashboard() {
  const { connectedAddress } = useStore();
  const coordinatorRef = useRef<AgentCoordinator | null>(null);

  const [agents, setAgents] = useState<AgentState[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey>('payment');

  // Initialise the coordinator once
  const refresh = useCallback(() => {
    const c = coordinatorRef.current;
    if (!c) return;
    setAgents(c.getAgentStates());
    setTasks([...c.getTasks()].reverse());
    setMessages(c.getMessageLog());
  }, []);

  useEffect(() => {
    const coordinator = new AgentCoordinator();
    coordinator.setUpdateCallback(refresh);
    coordinatorRef.current = coordinator;
    refresh();
    return () => coordinator.destroy();
  }, [refresh]);

  const runWorkflow = useCallback(async (params: Record<string, unknown>) => {
    const c = coordinatorRef.current;
    if (!c || loading) return;
    setLoading(true);
    try {
      let workflow;
      if (activeWorkflow === 'payment') {
        workflow = buildCrossChainWorkflow(params as Parameters<typeof buildCrossChainWorkflow>[0]);
      } else if (activeWorkflow === 'multisig') {
        workflow = buildMultisigWorkflow(params as Parameters<typeof buildMultisigWorkflow>[0]);
      } else if (activeWorkflow === 'trading') {
        workflow = buildTradingWorkflow(params as Parameters<typeof buildTradingWorkflow>[0]);
      } else if (activeWorkflow === 'contract') {
        workflow = buildContractWorkflow(params as Parameters<typeof buildContractWorkflow>[0]);
      } else {
        workflow = buildCompositeWorkflow(params as Parameters<typeof buildCompositeWorkflow>[0]);
      }
      await c.runWorkflow(workflow);
    } finally {
      setLoading(false);
      refresh();
    }
  }, [activeWorkflow, loading, refresh]);

  const handleClear = useCallback(() => {
    coordinatorRef.current?.clearTasks();
    refresh();
  }, [refresh]);

  const defaultAccount = connectedAddress ?? '';

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          🧠 Multi-Agent System
        </h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Specialized agents collaborate on complex Stellar operations — cross-chain payments,
          multi-signature workflows, automated trading strategies, and smart contract interactions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left column: agent status + workflow selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AgentStatusPanel agents={agents} />

          {card(
            <>
              {sectionTitle('Select Workflow')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WORKFLOWS.map((wf) => (
                  <button
                    key={wf.key}
                    onClick={() => setActiveWorkflow(wf.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      background: activeWorkflow === wf.key ? 'var(--accent)' : 'transparent',
                      border: `1px solid ${activeWorkflow === wf.key ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 7,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: activeWorkflow === wf.key ? '#fff' : 'var(--text)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1.2 }}>{wf.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{wf.label}</div>
                      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{wf.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column: form + tasks + log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Workflow form */}
          {card(
            <>
              {(() => {
                const wf = WORKFLOWS.find(w => w.key === activeWorkflow)!;
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 22 }}>{wf.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{wf.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{wf.description}</div>
                      </div>
                    </div>
                    {activeWorkflow === 'payment'   && <PaymentForm   onRun={runWorkflow} loading={loading} defaultAccount={defaultAccount} />}
                    {activeWorkflow === 'multisig'  && <MultisigForm  onRun={runWorkflow} loading={loading} defaultAccount={defaultAccount} />}
                    {activeWorkflow === 'trading'   && <TradingForm   onRun={runWorkflow} loading={loading} />}
                    {activeWorkflow === 'contract'  && <ContractForm  onRun={runWorkflow} loading={loading} />}
                    {activeWorkflow === 'composite' && <CompositeForm onRun={runWorkflow} loading={loading} defaultAccount={defaultAccount} />}
                  </>
                );
              })()}
            </>
          )}

          <TaskListPanel tasks={tasks} onClear={handleClear} />
          <MessageLogPanel messages={messages} />
        </div>
      </div>
    </div>
  );
}
