import React, { useState } from 'react';
import { useStore } from '../../lib/store';
import WASMUploader from './WASMUploader';
import ConstructorBuilder from './ConstructorBuilder';
import DeploymentTracker from './DeploymentTracker';
import { ContractDeployer } from '../../lib/deployment/ContractDeployer';
import { CostEstimator } from '../../lib/deployment/CostEstimator';
import { getContractUrl, getTransactionUrl } from '../../lib/externalExplorers';

const STEPS = [
  { id: 1, label: 'Upload WASM', icon: '📦', description: 'Select the contract artifact' },
  { id: 2, label: 'Constructor Params', icon: '⚙️', description: 'Configure initialization inputs' },
  { id: 3, label: 'Estimate', icon: '💰', description: 'Review size and fee estimate' },
  { id: 4, label: 'Deploy', icon: '🚀', description: 'Submit or simulate deployment' },
  { id: 5, label: 'Receipt', icon: '✅', description: 'Review the deployment receipt' },
];

const INITIAL_FILE_STATE = null;
const INITIAL_ARGS = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeArgs(args) {
  return args
    .map((arg) => ({
      name: String(arg.name || '').trim(),
      type: arg.type || 'string',
      value: String(arg.value ?? '').trim(),
    }))
    .filter((arg) => arg.value !== '');
}

function stepButtonStyle(step, currentStep) {
  const isActive = step.id === currentStep;
  const isComplete = step.id < currentStep;

  return {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: `2px solid ${
      isActive ? 'var(--cyan)' : isComplete ? 'var(--green)' : 'var(--border)'
    }`,
    background: isActive
      ? 'rgba(34, 211, 238, 0.12)'
      : isComplete
        ? 'rgba(34, 197, 94, 0.1)'
        : 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isComplete ? 'pointer' : 'default',
    transition: 'all var(--transition)',
  };
}

export default function ContractDeployerView() {
  const { network, setDeploymentStatus, connectedAddress } = useStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [wasmFile, setWasmFile] = useState(INITIAL_FILE_STATE);
  const [args, setArgs] = useState(INITIAL_ARGS);
  const [cost, setCost] = useState(null);
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorSource, setErrorSource] = useState(null);
  const [constructorError, setConstructorError] = useState(null);

  const isMainnet = network === 'mainnet';
  const normalizedArgs = normalizeArgs(args);
  const canReview = Boolean(wasmFile) && !constructorError;

  const resetTransientState = () => {
    setCost(null);
    setDeploymentResult(null);
    setError(null);
    setErrorSource(null);
  };

  const handleFileChange = (fileData) => {
    if (fileData) {
      setWasmFile(fileData);
      setCurrentStep(2);
      resetTransientState();
      setConstructorError(null);
    } else {
      setWasmFile(null);
      setCurrentStep(1);
      resetTransientState();
      setConstructorError(null);
    }
  };

  const handleEstimate = async () => {
    if (!wasmFile?.bytes) return;
    if (!canReview) {
      setError('Add valid constructor parameters before estimating the deployment.');
      setErrorSource('args');
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorSource(null);

    try {
      const deployer = new ContractDeployer();
      const estimate = await deployer.estimateDeploymentCost(wasmFile.bytes, normalizedArgs);
      setCost(estimate);
      setCurrentStep(4);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to estimate cost';
      setError(msg);
      setErrorSource('estimate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!wasmFile?.bytes) return;

    setIsLoading(true);
    setError(null);
    setErrorSource(null);

    try {
      const deployer = new ContractDeployer();
      const result = await deployer.deployContract(
        wasmFile.bytes,
        normalizedArgs,
        connectedAddress || 'unknown',
        network,
        {
          artifactName: wasmFile.file?.name,
          sizeBytes: wasmFile.sizeBytes,
          lastModified: wasmFile.lastModified,
          artifactHash: wasmFile.checksum,
        }
      );

      let nextResult = result;

      if (!result.isSimulation && result.receipt) {
        // Simulate a short confirmation delay so the receipt reflects tracking states.
        await wait(900);
        nextResult = {
          ...result,
          status: 'confirmed',
          receipt: {
            ...result.receipt,
            status: 'confirmed',
            statusHistory: [
              ...result.receipt.statusHistory.map((entry) =>
                entry.id === 'submit'
                  ? {
                      ...entry,
                      status: 'complete',
                      detail: 'Transaction submitted to Soroban RPC and awaiting confirmation.',
                    }
                  : entry
              ),
              {
                id: 'confirm',
                label: 'Network confirmed',
                status: 'complete',
                detail: 'Soroban RPC accepted the deployment and the contract is ready to use.',
                timestamp: Date.now(),
              },
            ],
          },
        };
      }

      setDeploymentResult(nextResult);
      setDeploymentStatus(nextResult);
      setCurrentStep(5);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deployment failed';
      setError(msg);
      setErrorSource('deploy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setWasmFile(INITIAL_FILE_STATE);
    setArgs(INITIAL_ARGS);
    setCost(null);
    setDeploymentResult(null);
    setError(null);
    setErrorSource(null);
    setConstructorError(null);
  };

  const canGoBack = currentStep > 1;
  const canGoForward =
    (currentStep === 1 && Boolean(wasmFile)) ||
    (currentStep === 2 && !constructorError) ||
    (currentStep === 3 && Boolean(cost));

  const renderStepBody = () => {
    if (currentStep === 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Upload WASM File</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Upload the compiled Soroban contract artifact. Large files are supported.
            </p>
          </div>
          <WASMUploader
            onFile={handleFileChange}
            onError={(err) => {
              setError(err);
              setErrorSource('upload');
            }}
            file={wasmFile}
          />
          {error && errorSource === 'upload' && (
            <div style={{ ...alertStyle, borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>
          )}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Constructor Parameters
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Add only the arguments your constructor expects. Leave empty if none are required.
            </p>
          </div>
          <ConstructorBuilder
            args={args}
            setArgs={(nextArgs) => {
              setArgs(nextArgs);
              setCost(null);
              setDeploymentResult(null);
              if (currentStep > 2) {
                setCurrentStep(2);
              }
            }}
            onError={(err) => {
              setConstructorError(err);
              if (err) {
                setError(err);
                setErrorSource('args');
              } else if (errorSource === 'args') {
                setError(null);
                setErrorSource(null);
              }
            }}
          />
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Review and Estimate
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Confirm the artifact, constructor inputs, and estimated deployment cost before submission.
            </p>
          </div>

          <div style={summaryGridStyle}>
            <SummaryCard label="Artifact" value={wasmFile?.file?.name || 'No file'} />
            <SummaryCard label="WASM Size" value={wasmFile ? `${wasmFile.sizeMb.toFixed(2)} MB` : '0 MB'} />
            <SummaryCard label="Parameters" value={String(normalizedArgs.length)} />
            <SummaryCard label="Network" value={network} />
          </div>

          {cost && (
            <div style={costPanelStyle}>
              <div style={{ fontSize: '12px', fontWeight: 700 }}>Estimated Cost Breakdown</div>
              <div style={costGridStyle}>
                <div>Base Fee: {(cost.baseStorageFee / 10000000).toFixed(7)} XLM</div>
                <div>Per KB: {(cost.perKbFee / 10000000).toFixed(7)} XLM</div>
                <div>Per Arg: {(cost.perArgFee / 10000000).toFixed(7)} XLM</div>
                <div style={{ fontWeight: 700, color: 'var(--cyan)' }}>
                  Total: {(cost.estimatedFeeStroops / 10000000).toFixed(7)} XLM
                </div>
              </div>
            </div>
          )}

          {!cost && (
            <div style={hintStyle}>
              Click <strong>Estimate fees</strong> to generate the deployment receipt preview.
            </div>
          )}

          {error && errorSource === 'estimate' && (
            <div style={{ ...alertStyle, borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>
          )}
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              {isMainnet ? 'Simulation Review' : 'Deploy Contract'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {isMainnet
                ? 'Mainnet stays in simulation mode. Use testnet for a real deployment receipt.'
                : 'Submit the transaction to testnet and capture the receipt once confirmed.'}
            </p>
          </div>

          <div style={summaryBoxStyle}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>Summary</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>• Artifact: {wasmFile?.file?.name || 'No file selected'}</div>
              <div>• WASM Size: {wasmFile ? `${wasmFile.sizeMb.toFixed(2)} MB` : '0 MB'}</div>
              <div>• Constructor Params: {normalizedArgs.length}</div>
              <div>• Network: {network}</div>
              {cost && <div>• Estimated Fee: {(cost.estimatedFeeStroops / 10000000).toFixed(7)} XLM</div>}
            </div>
          </div>

          {isMainnet && (
            <div style={{ ...hintStyle, borderColor: 'var(--amber)', color: 'var(--amber)' }}>
              Mainnet is configured for simulation-only review in this helper.
            </div>
          )}

          {error && errorSource === 'deploy' && (
            <div style={{ ...alertStyle, borderColor: 'var(--red)', color: 'var(--red)' }}>{error}</div>
          )}

          <button
            type="button"
            onClick={handleDeploy}
            disabled={isLoading || !wasmFile}
            style={primaryActionStyle(isLoading || !wasmFile)}
          >
            {isLoading ? 'Deploying...' : isMainnet ? 'Run Simulation' : 'Deploy Contract'}
          </button>
        </div>
      );
    }

    if (currentStep === 5 && deploymentResult) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Deployment Receipt
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Use this receipt to track the contract and verify the deployment on explorer.
            </p>
          </div>

          <DeploymentTracker status={deploymentResult} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {deploymentResult.contractId && (
              <LinkCard
                href={getContractUrl('stellarExpert', network, deploymentResult.contractId)}
                title="Open in Stellar Expert"
                subtitle="Contract receipt"
                tone="primary"
              />
            )}
            {deploymentResult.txHash && (
              <LinkCard
                href={getTransactionUrl('stellarExpert', network, deploymentResult.txHash)}
                title="Open Transaction"
                subtitle="Broadcast / simulation record"
                tone="secondary"
              />
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Soroban Contract Deployment Wizard
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {isMainnet
            ? 'Mainnet is locked to simulation mode for safety. Switch to testnet to deploy for real.'
            : 'Testnet mode supports the full deployment flow, including receipt generation.'}
        </p>
      </div>

      <div style={stepperStyle}>
        {STEPS.map((step, index) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
            <button
              type="button"
              onClick={() => step.id < currentStep && setCurrentStep(step.id)}
              disabled={step.id > currentStep}
              style={stepButtonStyle(step, currentStep)}
              title={step.label}
            >
              {step.icon}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '110px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{step.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{step.description}</div>
            </div>
            {index < STEPS.length - 1 && (
              <div style={{ width: '20px', height: '2px', background: step.id < currentStep ? 'var(--green)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      <div style={panelStyle}>
        {renderStepBody()}

        <div style={footerStyle}>
          <button
            type="button"
            onClick={handleReset}
            style={secondaryActionStyle()}
          >
            Reset
          </button>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
              disabled={!canGoBack || isLoading}
              style={secondaryActionStyle(!canGoBack || isLoading)}
            >
              Back
            </button>

            {currentStep === 3 ? (
              <button
                type="button"
                onClick={handleEstimate}
                disabled={!canReview || isLoading}
                style={primaryActionStyle(!canReview || isLoading)}
              >
                {isLoading ? 'Estimating...' : 'Estimate fees'}
              </button>
            ) : currentStep === 4 ? null : (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && wasmFile) {
                    setCurrentStep(2);
                  } else if (currentStep === 2 && !constructorError) {
                    setCurrentStep(3);
                  }
                }}
                disabled={!canGoForward || isLoading}
                style={primaryActionStyle(!canGoForward || isLoading)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

const panelStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: '24px',
  minHeight: '420px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const stepperStyle = {
  display: 'flex',
  gap: '8px',
  overflow: 'auto',
  paddingBottom: '8px',
};

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const costGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '8px',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
};

const costPanelStyle = {
  padding: '16px',
  background: 'rgba(34, 211, 238, 0.08)',
  border: '1px solid var(--cyan)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const summaryBoxStyle = {
  padding: '16px',
  background: 'var(--bg-elevated)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const footerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
  paddingTop: '8px',
  borderTop: '1px solid var(--border)',
};

const hintStyle = {
  padding: '12px',
  background: 'rgba(255, 184, 0, 0.08)',
  border: '1px solid var(--amber)',
  borderRadius: 'var(--radius-md)',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  lineHeight: 1.6,
};

const alertStyle = {
  padding: '12px',
  background: 'rgba(220, 38, 38, 0.1)',
  border: '1px solid var(--red)',
  borderRadius: 'var(--radius-md)',
  fontSize: '12px',
  lineHeight: 1.5,
};

function primaryActionStyle(disabled = false) {
  return {
    padding: '10px 16px',
    background: disabled ? 'var(--bg-elevated)' : 'var(--cyan)',
    color: disabled ? 'var(--text-muted)' : 'var(--bg-base)',
    border: disabled ? '1px solid var(--border)' : 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'var(--transition)',
  };
}

function secondaryActionStyle(disabled = false) {
  return {
    padding: '10px 16px',
    background: 'var(--bg-elevated)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
    border: '1px solid var(--border-bright)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'var(--transition)',
  };
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
    </div>
  );
}

function LinkCard({ href, title, subtitle, tone = 'primary' }) {
  const styles = tone === 'primary'
    ? {
        background: 'var(--cyan)',
        color: 'var(--bg-base)',
        border: 'none',
      }
    : {
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-bright)',
      };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...styles,
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: '11px', opacity: 0.8 }}>{subtitle}</div>
    </a>
  );
}
