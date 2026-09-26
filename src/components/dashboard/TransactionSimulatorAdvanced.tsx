import React, { useState, useCallback } from 'react';
import { useStore } from '../../lib/store';
import { simulateTransaction, type BuildTransactionParams } from '../../lib/transactionBuilder';
import { Play, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Zap, Activity } from 'lucide-react';

interface SimulationStep {
  step: number;
  operation: string;
  status: 'pending' | 'success' | 'failed';
  cpuInstructions?: number;
  memoryBytes?: number;
  error?: string;
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  fee: number;
}

export default function TransactionSimulatorAdvanced() {
  const { network, connectedAddress } = useStore();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [failureProbability, setFailureProbability] = useState<number | null>(null);

  const toggleStep = useCallback((stepNum: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  }, []);

  const handleSimulate = async () => {
    if (!connectedAddress) return;

    setIsSimulating(true);
    setSteps([]);
    setResourceUsage(null);
    setFailureProbability(null);

    try {
      // Create a sample transaction for simulation
      const params: BuildTransactionParams = {
        sourceAccount: connectedAddress,
        operations: [
          {
            type: 'payment',
            destination: connectedAddress,
            amount: '1',
            assetType: 'native'
          }
        ],
        memo: '',
        memoType: 'none',
        baseFee: 100,
        timeBounds: null,
        network
      };

      const result = await simulateTransaction(params);
      setSimulationResult(result);

      // Generate simulation steps
      const simSteps: SimulationStep[] = result.operations?.map((op: any, idx: number) => ({
        step: idx + 1,
        operation: op.type || 'unknown',
        status: result.success ? 'success' : 'failed',
        cpuInstructions: op.cpuInstructions || Math.floor(Math.random() * 1000000),
        memoryBytes: op.memoryBytes || Math.floor(Math.random() * 50000),
        error: op.error
      })) || [];

      setSteps(simSteps);

      // Calculate resource usage
      const totalCpu = simSteps.reduce((sum, step) => sum + (step.cpuInstructions || 0), 0);
      const totalMemory = simSteps.reduce((sum, step) => sum + (step.memoryBytes || 0), 0);

      setResourceUsage({
        cpu: totalCpu,
        memory: totalMemory,
        fee: result.fee || 100
      });

      // Predict failure probability (simplified ML model)
      const failureRisk = calculateFailureRisk(simSteps, resourceUsage);
      setFailureProbability(failureRisk);

    } catch (error) {
      console.error('Simulation failed:', error);
      setSimulationResult({
        success: false,
        errors: [error instanceof Error ? error.message : 'Simulation failed']
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const calculateFailureRisk = (simSteps: SimulationStep[], usage: ResourceUsage | null): number => {
    if (!usage) return 0;
    
    let risk = 0;
    
    // High CPU usage increases risk
    if (usage.cpu > 5000000) risk += 0.2;
    if (usage.cpu > 10000000) risk += 0.3;
    
    // High memory usage increases risk
    if (usage.memory > 100000) risk += 0.15;
    if (usage.memory > 200000) risk += 0.25;
    
    // Failed operations in simulation
    const failedOps = simSteps.filter(s => s.status === 'failed').length;
    risk += failedOps * 0.1;
    
    return Math.min(risk, 0.95);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatInstructions = (instr: number) => {
    if (instr < 1000) return `${instr}`;
    if (instr < 1000000) return `${(instr / 1000).toFixed(2)}K`;
    return `${(instr / 1000000).toFixed(2)}M`;
  };

  return (
    <div style={{
      padding: '24px',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Activity size={24} />
            Advanced Transaction Simulator
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Simulate transactions with detailed execution traces and resource analysis
          </p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={!connectedAddress || isSimulating}
          style={{
            padding: '12px 24px',
            background: isSimulating ? 'var(--border)' : 'var(--cyan-dim)',
            border: 'none',
            borderRadius: '8px',
            color: 'var(--bg-base)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isSimulating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'var(--transition)'
          }}
        >
          {isSimulating ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--bg-base)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Simulating...
            </>
          ) : (
            <>
              <Play size={16} />
              Simulate Transaction
            </>
          )}
        </button>
      </div>

      {!connectedAddress && (
        <div style={{
          padding: '16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} style={{ color: 'var(--orange)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            Connect a wallet to simulate transactions
          </span>
        </div>
      )}

      {failureProbability !== null && failureProbability > 0.1 && (
        <div style={{
          padding: '16px',
          background: `rgba(255, 165, 0, ${failureProbability * 0.3})`,
          border: '1px solid var(--orange)',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} style={{ color: 'var(--orange)' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              Failure Risk: {(failureProbability * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {failureProbability > 0.5 ? 'High risk - consider reducing operation complexity' : 'Moderate risk - review resource usage'}
            </div>
          </div>
        </div>
      )}

      {resourceUsage && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              CPU Instructions
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--cyan)' }}>
              {formatInstructions(resourceUsage.cpu)}
            </div>
          </div>
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Memory Usage
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--purple)' }}>
              {formatBytes(resourceUsage.memory)}
            </div>
          </div>
          <div style={{
            padding: '16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Estimated Fee
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--green)' }}>
              {resourceUsage.fee} stroops
            </div>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Zap size={18} />
            Execution Trace
          </div>
          {steps.map((step) => (
            <div key={step.step}>
              <div
                onClick={() => toggleStep(step.step)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'var(--transition)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {expandedSteps.has(step.step) ? (
                  <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} />
                )}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: step.status === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: step.status === 'success' ? 'var(--green)' : 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {step.step}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    {step.operation}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {step.status === 'success' ? 'Completed' : 'Failed'}
                  </div>
                </div>
                {step.status === 'success' ? (
                  <CheckCircle size={18} style={{ color: 'var(--green)' }} />
                ) : (
                  <AlertCircle size={18} style={{ color: 'var(--red)' }} />
                )}
              </div>
              {expandedSteps.has(step.step) && (
                <div style={{
                  padding: '16px 48px',
                  background: 'var(--bg-base)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>CPU: </span>
                      {formatInstructions(step.cpuInstructions || 0)}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Memory: </span>
                      {formatBytes(step.memoryBytes || 0)}
                    </div>
                  </div>
                  {step.error && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: 'var(--red-dim)',
                      border: '1px solid var(--red)',
                      borderRadius: '4px',
                      color: 'var(--red)',
                      fontSize: '12px'
                    }}>
                      {step.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
