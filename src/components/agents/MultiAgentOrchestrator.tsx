import React, { useState } from 'react';
import useMultiAgentSystem from '../../hooks/useMultiAgentSystem';
import './MultiAgentOrchestrator.css';

interface OperationExecutorProps {
  onExecuteComplete?: (result: Record<string, unknown>) => void;
}

export const MultiAgentOrchestrator: React.FC<OperationExecutorProps> = ({ onExecuteComplete }) => {
  const { orchestrator, agents, isInitialized, isExecuting, error, executeOperation, getMetrics } = useMultiAgentSystem();

  const [operationType, setOperationType] = useState<'cross-chain' | 'multisig' | 'trading' | 'generic'>('cross-chain');
  const [strategy, setStrategy] = useState('sequential');
  const [operationData, setOperationData] = useState('{}');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);

  const handleExecute = async () => {
    setExecutionError(null);
    setResult(null);

    try {
      const data = JSON.parse(operationData);
      const operationResult = await executeOperation(operationType, data, strategy);
      setResult(operationResult);
      onExecuteComplete?.(operationResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Execution failed';
      setExecutionError(message);
    }
  };

  const metrics = getMetrics();

  return (
    <div className="multi-agent-orchestrator">
      <div className="orchestrator-header">
        <h2>Multi-Agent Operation Orchestrator</h2>
        <span className={`status ${isInitialized ? 'ready' : 'loading'}`}>
          {isInitialized ? 'Ready' : 'Initializing'}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="orchestrator-grid">
        {/* Agent Status Panel */}
        <div className="panel agents-panel">
          <h3>Registered Agents ({agents.length})</h3>
          <div className="agent-list">
            {agents.map((agent) => (
              <div key={agent.id} className={`agent-item ${agent.status}`}>
                <div className="agent-info">
                  <span className={`role-badge ${agent.role}`}>{agent.role}</span>
                  <span className="agent-name">{agent.name}</span>
                </div>
                <div className="agent-capabilities">
                  {agent.capabilities.slice(0, 2).map((cap) => (
                    <span key={cap} className="capability-tag">
                      {cap}
                    </span>
                  ))}
                  {agent.capabilities.length > 2 && <span className="capability-tag">+{agent.capabilities.length - 2}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operation Configuration Panel */}
        <div className="panel config-panel">
          <h3>Operation Configuration</h3>

          <div className="config-group">
            <label>Operation Type</label>
            <select value={operationType} onChange={(e) => setOperationType(e.target.value as any)} disabled={isExecuting}>
              <option value="cross-chain">Cross-Chain Transaction</option>
              <option value="multisig">Multi-Signature Workflow</option>
              <option value="trading">Automated Trading</option>
              <option value="generic">Generic Operation</option>
            </select>
          </div>

          <div className="config-group">
            <label>Coordination Strategy</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} disabled={isExecuting}>
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
              <option value="consensus">Consensus</option>
            </select>
          </div>

          <div className="config-group">
            <label>Operation Data (JSON)</label>
            <textarea
              value={operationData}
              onChange={(e) => setOperationData(e.target.value)}
              disabled={isExecuting}
              rows={6}
              placeholder='{"key": "value"}'
            />
          </div>

          <button onClick={handleExecute} disabled={isExecuting || !isInitialized} className="execute-btn">
            {isExecuting ? 'Executing...' : 'Execute Operation'}
          </button>
        </div>

        {/* Metrics Panel */}
        <div className="panel metrics-panel">
          <div className="metrics-header">
            <h3>Performance Metrics</h3>
            <button className="toggle-btn" onClick={() => setShowMetrics(!showMetrics)}>
              {showMetrics ? '−' : '+'}
            </button>
          </div>

          {showMetrics && (
            <div className="metrics-grid">
              <div className="metric">
                <div className="metric-value">{metrics.totalAgents}</div>
                <div className="metric-label">Total Agents</div>
              </div>
              <div className="metric">
                <div className="metric-value">{metrics.activeAgents}</div>
                <div className="metric-label">Active Agents</div>
              </div>
              <div className="metric">
                <div className="metric-value">{metrics.totalTasks}</div>
                <div className="metric-label">Total Tasks</div>
              </div>
              <div className="metric">
                <div className="metric-value">{(metrics.collaborationSuccessRate * 100).toFixed(1)}%</div>
                <div className="metric-label">Success Rate</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Panel */}
      {(result || executionError) && (
        <div className={`result-panel ${executionError ? 'error' : 'success'}`}>
          <h3>{executionError ? 'Execution Error' : 'Execution Result'}</h3>

          {executionError && <div className="error-message">{executionError}</div>}

          {result && (
            <pre className="result-json">
              <code>{JSON.stringify(result, null, 2)}</code>
            </pre>
          )}

          <button className="close-btn" onClick={() => setResult(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiAgentOrchestrator;
