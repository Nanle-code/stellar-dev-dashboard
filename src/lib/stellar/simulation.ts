import * as StellarSdk from '@stellar/stellar-sdk';
import { Cache, TTL } from '../cache.js';
import { checkDestinationMemoRequirement, isValidPublicKey } from './addresses.js';
import { getSorobanServer } from './networks.js';
import { buildTransaction, type BuildTransactionParams, type PaymentOperation } from './transactionBuilder.js';
import { serializeLedgerKey, serializeDiagnosticEvent, type SerializedLedgerKey, type SerializedContractEvent } from './soroban.js';
import { shortAddress } from './formatters.js';

const simulationCache = new Cache({
  namespace: 'simulation',
  maxSize: 200,
  defaultTTL: TTL.SHORT,
});

function buildSimulationCacheKey(params: BuildTransactionParams) {
  return simulationCache.generateKey('simulate', {
    sourceAccount: params.sourceAccount,
    operations: params.operations,
    memo: params.memo,
    baseFee: params.baseFee,
    timeBounds: params.timeBounds,
    preconditions: params.preconditions,
    network: params.network,
  });
}

function validateSimulationParams(params: BuildTransactionParams) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.sourceAccount || !isValidPublicKey(params.sourceAccount)) {
    errors.push('Source account is required and must be a valid Stellar public key.');
  }

  if (!Array.isArray(params.operations) || params.operations.length === 0) {
    errors.push('Transaction must include at least one operation.');
  }

  if (!Number.isFinite(params.baseFee) || params.baseFee <= 0) {
    errors.push('Base fee must be a positive number.');
  }

  if (params.timeBounds?.minTime && params.timeBounds?.maxTime) {
    const minTime = Number(params.timeBounds.minTime);
    const maxTime = Number(params.timeBounds.maxTime);
    if (Number.isNaN(minTime) || Number.isNaN(maxTime)) {
      errors.push('Time bounds must be valid Unix timestamps.');
    } else if (minTime > maxTime) {
      errors.push('Min time cannot be greater than max time.');
    }
  }

  if (params.preconditions) {
    if (params.preconditions.ledgerBounds) {
      const minLedger = Number(params.preconditions.ledgerBounds.minLedger);
      const maxLedger = Number(params.preconditions.ledgerBounds.maxLedger);
      if (!Number.isNaN(minLedger) && minLedger < 0) {
        errors.push('Ledger bounds minLedger cannot be negative.');
      }
      if (!Number.isNaN(maxLedger) && maxLedger < 0) {
        errors.push('Ledger bounds maxLedger cannot be negative.');
      }
      if (!Number.isNaN(minLedger) && !Number.isNaN(maxLedger) && maxLedger > 0 && minLedger > maxLedger) {
        errors.push('Ledger bounds minLedger cannot be greater than maxLedger.');
      }
    }

    if (params.preconditions.minSequence !== undefined && params.preconditions.minSequence !== '') {
      const minSeq = Number(params.preconditions.minSequence);
      if (Number.isNaN(minSeq) || minSeq < 0) {
        errors.push('Min sequence cannot be negative.');
      }
    }

    if (params.preconditions.minSequenceAge !== undefined && params.preconditions.minSequenceAge !== '') {
      const age = Number(params.preconditions.minSequenceAge);
      if (Number.isNaN(age) || age < 0) {
        errors.push('Min sequence age cannot be negative.');
      }
    }

    if (params.preconditions.minSequenceLedgerGap !== undefined && params.preconditions.minSequenceLedgerGap !== '') {
      const gap = Number(params.preconditions.minSequenceLedgerGap);
      if (Number.isNaN(gap) || gap < 0) {
        errors.push('Min sequence ledger gap cannot be negative.');
      }
    }

    if (params.preconditions.extraSigners) {
      const invalid = params.preconditions.extraSigners.filter((s) => !isValidPublicKey(s));
      if (invalid.length > 0) {
        errors.push(`Invalid extra signer public key(s): ${invalid.join(', ')}`);
      }
    }
  }

  if (typeof params.memo === 'string' && params.memo.length > 28) {
    warnings.push('Memo text may exceed the 28-character limit accepted by the Stellar network.');
  }

  params.operations?.forEach((op, index) => {
    if (op.type === 'payment') {
      if (!isValidPublicKey(op.destination)) {
        errors.push(`Operation ${index + 1}: Invalid destination address.`);
      }
      if (!op.amount || parseFloat(String(op.amount)) <= 0) {
        errors.push(`Operation ${index + 1}: Amount must be greater than zero.`);
      }
    } else if (op.type === 'createAccount') {
      if (!isValidPublicKey(op.destination)) {
        errors.push(`Operation ${index + 1}: Invalid destination address.`);
      }
      if (!op.startingBalance || parseFloat(String(op.startingBalance)) < 1) {
        errors.push(`Operation ${index + 1}: Starting balance must be at least 1 XLM.`);
      }
    } else if (op.type === 'invokeHostFunction') {
      if (!op.func) {
        errors.push(`Operation ${index + 1}: Missing host function payload.`);
      }
    }
  });

  return { errors, warnings };
}

export function getSimulationFeeOptions(
  baseFee: number,
  operationCount: number,
  congestion = 0.55
) {
  const optimized = optimizeTransactionFee(baseFee, operationCount, congestion);

  return [
    {
      label: 'Slow / Cost Saver',
      fee: Math.max(100, Math.floor(optimized * 0.85)),
      expectedInclusion: 'slow',
    },
    {
      label: 'Standard',
      fee: optimized,
      expectedInclusion: 'standard',
    },
    {
      label: 'Priority',
      fee: Math.ceil(optimized * 1.2),
      expectedInclusion: 'priority',
    },
  ];
}

// ─── Simulate transaction ─────────────────────────────────────────────────────

export interface SimulateResult {
  fee: number;
  operationCount: number;
  success: boolean;
  errors: string[];
  warnings?: string[];
  feeOptions?: SimulationFeeOption[];
  xdr?: string;
  resourceUsage?: {
    cpuInstructions: number;
    memoryBytes: number;
    ledgerReadWrite: number;
    ledgerReadOnly: number;
  };
  sorobanMetrics?: {
    footprint: {
      readOnly: SerializedLedgerKey[];
      readWrite: SerializedLedgerKey[];
    };
    resourceFee: string;
    refundableFee?: string;
    events?: SerializedContractEvent[];
  };
}

export async function simulateTransaction(params: BuildTransactionParams): Promise<SimulateResult> {
  const cacheKey = buildSimulationCacheKey(params);
  const cached = simulationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const feeBumpOnly = params.operations.length === 1 && params.operations[0].type === 'feeBump';

  // validateSimulationParams requires a sourceAccount — skip that check for fee-bump
  // since the fee source lives inside the operation params, not at the top level.
  const validation = feeBumpOnly
    ? { errors: [] as string[], warnings: [] as string[] }
    : validateSimulationParams(params);

  const errors = [...validation.errors];
  const warnings = [...validation.warnings];
  let transaction: StellarSdk.Transaction | StellarSdk.FeeBumpTransaction | null = null;
  let sorobanMetrics = undefined;

  if (!params.memo) {
    const paymentDestinations = (params.operations || [])
      .filter((op): op is PaymentOperation => op.type === 'payment' && Boolean((op as PaymentOperation).destination))
      .map((op) => op.destination);

    for (const destination of paymentDestinations) {
      const memoCheck = await checkDestinationMemoRequirement(destination, params.network);
      if (memoCheck.checked && memoCheck.required) {
        warnings.push(
          `Destination ${shortAddress(destination)} requires a memo (SEP-29). Add one before submitting or the network will reject this transaction.`
        );
      }
      // Unsupported environments (federated/contract addresses, network errors)
      // are surfaced via memoCheck.error but are non-fatal — we skip the warning.
    }
  }

  if (errors.length === 0) {
    try {
      transaction = await buildTransaction(params);
    } catch (error) {
      errors.push(`Transaction assembly failed: ${(error as Error).message}`);
    }
  }

  const result: SimulateResult = {
    fee: 0,
    operationCount: params.operations.length,
    success: false,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };

  if (transaction) {
    const fee = parseInt(transaction.fee.toString(), 10);

    // For fee-bump transactions, operation count = inner ops + 1 (the bump itself).
    // For plain transactions, it's the direct operation count.
    let operationCount: number;
    if (transaction instanceof StellarSdk.FeeBumpTransaction) {
      operationCount = transaction.innerTransaction.operations.length + 1;
    } else {
      operationCount = (transaction as StellarSdk.Transaction).operations.length;
    }

    const feeOptions = getSimulationFeeOptions(params.baseFee, operationCount);

    const hasSorobanOps = params.operations.some((op) => op.type === 'invokeHostFunction');
    if (hasSorobanOps && transaction instanceof StellarSdk.Transaction) {
      try {
        const sorobanServer = getSorobanServer(params.network);
        const simulation = await sorobanServer.simulateTransaction(transaction);

        if ('error' in simulation) {
          errors.push(`Soroban simulation error: ${simulation.error}`);
        } else {
          const successfulSimulation = simulation as any;
          if (successfulSimulation.transactionData) {
            const readOnly = successfulSimulation.transactionData.getReadOnly();
            const readWrite = successfulSimulation.transactionData.getReadWrite();
            const cost = successfulSimulation.cost as { cpuInstructions?: number; memoryBytes?: number } | undefined;
            const cpuInstructions = cost?.cpuInstructions ?? Math.max(100_000, readWrite.length * 200_000 + readOnly.length * 50_000 + operationCount * 25_000);
            const memoryBytes = cost?.memoryBytes ?? Math.max(1024, (readWrite.length + readOnly.length) * 2048 + operationCount * 512);
            const resourceFee = successfulSimulation.minResourceFee;
            const refundableFee = resourceFee ? Math.floor(parseInt(resourceFee, 10) * 0.3) : undefined;

            sorobanMetrics = {
              footprint: {
                readOnly: readOnly.map(serializeLedgerKey),
                readWrite: readWrite.map(serializeLedgerKey),
              },
              resourceFee,
              refundableFee: refundableFee?.toString(),
              events: (successfulSimulation.events || []).map(serializeDiagnosticEvent),
            };

            result.resourceUsage = {
              cpuInstructions,
              memoryBytes,
              ledgerReadWrite: readWrite.length,
              ledgerReadOnly: readOnly.length,
            };
          }
        }
      } catch (e) {
        console.warn('Soroban simulation failed:', e);
      }
    }

    result.fee = fee;
    result.operationCount = operationCount;
    result.success = errors.length === 0;
    result.xdr = transaction.toXDR();
    result.feeOptions = feeOptions;
    result.sorobanMetrics = sorobanMetrics;
  }

  simulationCache.set(cacheKey, result, TTL.SHORT, ['simulation', params.network]);
  return result;
}

export interface SimulationWhatIfScenario {
  label: string;
  baseFee?: number;
  operationMultiplier?: number;
  networkCongestion?: number;
}

export interface SimulationFeeOption {
  label: string;
  fee: number;
  expectedInclusion: 'slow' | 'standard' | 'priority';
}

export interface ExecutionTraceStep {
  step: string;
  status: 'ok' | 'warning' | 'error';
  detail: string;
}

export interface AdvancedSimulationParams extends BuildTransactionParams {
  scenarios?: SimulationWhatIfScenario[];
  currentLedgerLoad?: number;
}

export interface AdvancedSimulationReport {
  base: SimulateResult;
  optimizedFee: number;
  feeOptions: SimulationFeeOption[];
  successProbability: number;
  executionTrace: ExecutionTraceStep[];
  scenarios: Array<{
    label: string;
    estimatedFee: number;
    successProbability: number;
  }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function optimizeTransactionFee(
  baseFee: number,
  operationCount: number,
  currentLedgerLoad = 0.5
): number {
  const congestionMultiplier = 1 + clamp(currentLedgerLoad, 0, 1.5) * 0.85;
  const opWeight = 1 + Math.max(0, operationCount - 1) * 0.08;
  return Math.ceil(baseFee * congestionMultiplier * opWeight);
}

export function scoreTransactionSuccess(
  simulation: SimulateResult,
  currentLedgerLoad = 0.5
): number {
  if (!simulation.success) return 0;

  const errorPenalty = simulation.errors.length * 0.2;
  const congestionPenalty = clamp(currentLedgerLoad, 0, 1.5) * 0.28;
  const opPenalty = Math.max(0, simulation.operationCount - 2) * 0.04;
  const raw = 0.95 - errorPenalty - congestionPenalty - opPenalty;
  return clamp(raw, 0.05, 0.99);
}

export function buildExecutionTrace(
  params: BuildTransactionParams,
  simulation: SimulateResult
): ExecutionTraceStep[] {
  const steps: ExecutionTraceStep[] = [
    {
      step: 'Validate source account',
      status: isValidPublicKey(params.sourceAccount) ? 'ok' : 'error',
      detail: isValidPublicKey(params.sourceAccount)
        ? 'Source account format is valid.'
        : 'Source account is not a valid ed25519 public key.',
    },
    {
      step: 'Assemble operations',
      status: params.operations.length > 0 ? 'ok' : 'error',
      detail: `${params.operations.length} operation(s) attached to transaction.`,
    },
    {
      step: 'Estimate fee and bounds',
      status: params.baseFee >= 100 ? 'ok' : 'warning',
      detail: `Base fee ${params.baseFee} stroops with ${params.timeBounds.maxTime ? 'custom' : 'default'} time bounds.`,
    },
    {
      step: 'Simulate preflight',
      status: simulation.success ? 'ok' : 'error',
      detail: simulation.success
        ? 'Simulation succeeded with no blocking errors.'
        : simulation.errors.join('; '),
    },
    {
      step: 'Soroban Resource Preview',
      status: simulation.sorobanMetrics ? 'ok' : 'warning',
      detail: simulation.sorobanMetrics
        ? `Footprint: ${simulation.sorobanMetrics.footprint.readOnly.length} RO, ${simulation.sorobanMetrics.footprint.readWrite.length} RW keys. Min fee: ${simulation.sorobanMetrics.resourceFee} stroops.`
        : 'Soroban metrics not available for this transaction.',
    },
  ];

  return steps;
}

export async function runAdvancedTransactionSimulation(
  params: AdvancedSimulationParams
): Promise<AdvancedSimulationReport> {
  const base = await simulateTransaction(params);
  const operationCount = Math.max(1, params.operations.length);
  const currentLedgerLoad = params.currentLedgerLoad ?? 0.55;
  const optimizedFee = optimizeTransactionFee(params.baseFee, operationCount, currentLedgerLoad);
  const successProbability = scoreTransactionSuccess(base, currentLedgerLoad);
  const executionTrace = buildExecutionTrace(params, base);

  const feeOptions: SimulationFeeOption[] = [
    {
      label: 'Slow / Cost Saver',
      fee: Math.max(100, Math.floor(optimizedFee * 0.85)),
      expectedInclusion: 'slow',
    },
    {
      label: 'Standard',
      fee: optimizedFee,
      expectedInclusion: 'standard',
    },
    {
      label: 'Priority',
      fee: Math.ceil(optimizedFee * 1.2),
      expectedInclusion: 'priority',
    },
  ];

  const scenarios = (params.scenarios || []).map((scenario) => {
    const scenarioOps = Math.max(
      1,
      Math.round(operationCount * (scenario.operationMultiplier ?? 1))
    );
    const scenarioFee = optimizeTransactionFee(
      scenario.baseFee ?? params.baseFee,
      scenarioOps,
      scenario.networkCongestion ?? currentLedgerLoad
    );

    const scenarioProbability = clamp(
      successProbability - (scenario.networkCongestion ?? currentLedgerLoad) * 0.15 + 0.05,
      0.03,
      0.99
    );

    return {
      label: scenario.label,
      estimatedFee: scenarioFee,
      successProbability: scenarioProbability,
    };
  });

  return {
    base,
    optimizedFee,
    feeOptions,
    successProbability,
    executionTrace,
    scenarios,
  };
}

export async function exportTransactionXDR(params: BuildTransactionParams): Promise<string> {
  const transaction = await buildTransaction(params);
  return transaction.toXDR();
}
