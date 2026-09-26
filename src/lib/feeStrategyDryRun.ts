import * as StellarSdk from '@stellar/stellar-sdk';
import {
  simulateTransaction,
  optimizeTransactionFee,
  scoreTransactionSuccess,
  buildExecutionTrace,
  NETWORKS,
  isValidPublicKey,
  type BuildTransactionParams,
  type SimulateResult,
  type ExecutionTraceStep,
  type NetworkName,
} from './stellar';

export type FeeStrategyTier = 'low' | 'medium' | 'high';

export interface FeeStrategyDryRunResult {
  tier: FeeStrategyTier;
  label: string;
  description: string;
  baseFee: number; // base fee per op in stroops
  totalFee: number; // total fee in stroops
  totalFeeXLM: string; // formatted in XLM (e.g., '0.0000100 XLM')
  successLikelihood: number; // score between 0.0 and 1.0
  successLikelihoodPercent: number; // 0 - 100
  estimatedInclusionTime: string; // e.g. '~15-30s (2-3 ledgers)'
  congestionResilience: 'low' | 'moderate' | 'high';
  costVsLikelihoodRating: string; // e.g. 'Economy / High Savings'
  isRecommended: boolean;
  costDifferenceVsLow: {
    stroops: number;
    xlm: string;
    percentDifference: number;
  };
  simulation: SimulateResult;
  canCoverFee?: boolean;
  balanceAfterFee?: number | null;
  warnings: string[];
  errors: string[];
}

export interface CompareFeeStrategiesParams {
  sourceAccount?: string;
  operations?: Array<Record<string, unknown>>;
  memo?: string;
  timeBounds?: Record<string, unknown> | null;
  network?: string;
  currentLedgerLoad?: number; // 0.0 - 1.5, default 0.55
  accountBalance?: number | string; // in stroops or XLM
  customFeeOverrides?: Partial<Record<FeeStrategyTier, number>>; // custom baseFee per op in stroops
  isOffline?: boolean;
}

export interface FeeStrategyComparisonReport {
  valid: boolean;
  isUnsupportedEnvironment: boolean;
  environmentError?: string;
  validationErrors: string[];
  validationWarnings: string[];
  strategies: Record<FeeStrategyTier, FeeStrategyDryRunResult>;
  strategyList: FeeStrategyDryRunResult[];
  recommendedTier: FeeStrategyTier;
  currentLedgerLoad: number;
  operationCount: number;
  baseSimulationSuccess: boolean;
  executionTrace: ExecutionTraceStep[];
  timestamp: string;
}

const STROOPS_PER_XLM = 10_000_000;
export const MIN_BASE_FEE_STROOPS = 100;

export function stroopsToXLM(stroops: number): string {
  const xlm = Math.max(0, stroops) / STROOPS_PER_XLM;
  return `${xlm.toFixed(7)} XLM`;
}

export function parseBalanceToStroops(balance: number | string | undefined | null): number | null {
  if (balance === undefined || balance === null || balance === '') return null;
  if (typeof balance === 'number') {
    if (isNaN(balance) || balance < 0) return null;
    // If balance is small (< 1000), treat as XLM, else if integer > 10000, treat as stroops
    return balance < 1000 ? Math.round(balance * STROOPS_PER_XLM) : Math.round(balance);
  }
  const clean = balance.toString().trim().replace(/XLM|stroops/gi, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num) || num < 0) return null;
  if (balance.toString().toLowerCase().includes('stroop')) {
    return Math.round(num);
  }
  if (balance.toString().toLowerCase().includes('xlm') || num < 1000) {
    return Math.round(num * STROOPS_PER_XLM);
  }
  return Math.round(num);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Validates input parameters for fee strategy dry-run comparison.
 */
export function validateFeeStrategyInput(params: CompareFeeStrategiesParams): {
  valid: boolean;
  isUnsupportedEnvironment: boolean;
  environmentError?: string;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isUnsupportedEnvironment = false;
  let environmentError: string | undefined = undefined;

  // Check offline environment
  const isOffline = params.isOffline ?? (typeof navigator !== 'undefined' && !navigator.onLine);
  if (isOffline) {
    isUnsupportedEnvironment = true;
    environmentError = 'Network is offline. Transaction dry-run simulation requires an active network connection.';
    warnings.push('Operating in offline mode; simulation results are estimates only.');
  }

  // Check network support
  const networkKey = (params.network || 'testnet').toLowerCase() as NetworkName;
  const networkConfig = NETWORKS[networkKey];
  if (!networkConfig) {
    isUnsupportedEnvironment = true;
    environmentError = `Unsupported network '${params.network}'. Supported networks are: ${Object.keys(NETWORKS).join(', ')}.`;
    errors.push(environmentError);
  } else if (networkKey === 'custom' && !networkConfig.horizonUrl) {
    isUnsupportedEnvironment = true;
    environmentError = 'Custom network is missing Horizon RPC URL configuration.';
    errors.push(environmentError);
  }

  // Validate Source Account
  if (!params.sourceAccount || typeof params.sourceAccount !== 'string' || params.sourceAccount.trim() === '') {
    errors.push('Source account is required and must be a valid Stellar public key.');
  } else if (!isValidPublicKey(params.sourceAccount.trim())) {
    errors.push('Source account is not a valid ed25519 public key.');
  }

  // Validate Operations
  if (!params.operations || !Array.isArray(params.operations) || params.operations.length === 0) {
    errors.push('At least one operation is required for fee strategy comparison.');
  } else {
    params.operations.forEach((op, idx) => {
      const opIndex = idx + 1;
      if (!op || typeof op !== 'object') {
        errors.push(`Operation ${opIndex}: Invalid operation specification.`);
        return;
      }

      if (op.type === 'payment') {
        const dest = (op.destination || (op.params as any)?.destination) as string;
        const amt = (op.amount || (op.params as any)?.amount) as string | number;
        if (!dest || !isValidPublicKey(dest)) {
          errors.push(`Operation ${opIndex}: Invalid destination address.`);
        }
        if (amt === undefined || amt === null || parseFloat(amt.toString()) <= 0 || isNaN(parseFloat(amt.toString()))) {
          errors.push(`Operation ${opIndex}: Amount must be greater than zero.`);
        }
      } else if (op.type === 'createAccount') {
        const dest = (op.destination || (op.params as any)?.destination) as string;
        const startingBal = (op.startingBalance || (op.params as any)?.startingBalance) as string | number;
        if (!dest || !isValidPublicKey(dest)) {
          errors.push(`Operation ${opIndex}: Invalid destination address.`);
        }
        if (startingBal === undefined || startingBal === null || parseFloat(startingBal.toString()) < 1) {
          errors.push(`Operation ${opIndex}: Starting balance must be at least 1 XLM.`);
        }
      } else if (op.type === 'clawback') {
        const from = (op.from || (op.params as any)?.from) as string;
        if (!from || !isValidPublicKey(from)) {
          errors.push(`Operation ${opIndex}: Invalid clawback source address.`);
        }
      }
    });
  }

  // Validate custom fee overrides if present
  if (params.customFeeOverrides) {
    for (const [tier, fee] of Object.entries(params.customFeeOverrides)) {
      if (fee !== undefined && (typeof fee !== 'number' || isNaN(fee) || fee < MIN_BASE_FEE_STROOPS)) {
        warnings.push(`Custom fee override for ${tier} tier (${fee}) is below the network minimum of ${MIN_BASE_FEE_STROOPS} stroops.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    isUnsupportedEnvironment,
    environmentError,
    errors,
    warnings,
  };
}

/**
 * Calculates the dynamic base fee (in stroops per operation) for low, medium, and high strategies.
 */
export function calculateStrategyFees(
  operationCount: number,
  currentLedgerLoad = 0.55,
  customOverrides?: Partial<Record<FeeStrategyTier, number>>
): Record<FeeStrategyTier, { baseFee: number; totalFee: number }> {
  const ops = Math.max(1, operationCount);
  const load = clamp(currentLedgerLoad, 0, 1.5);
  const standardBase = optimizeTransactionFee(MIN_BASE_FEE_STROOPS, ops, load);

  // Low: Baseline / Cost Saver (minimum 100 stroops)
  const lowBase = Math.max(
    MIN_BASE_FEE_STROOPS,
    customOverrides?.low ?? Math.max(MIN_BASE_FEE_STROOPS, Math.floor(standardBase * 0.8))
  );

  // Medium: Standard dynamic load-adjusted fee
  const mediumBase = Math.max(
    lowBase,
    customOverrides?.medium ?? standardBase
  );

  // High: Priority with surge protection headroom
  const highHeadroomMultiplier = 1.35 + load * 0.25;
  const highBase = Math.max(
    mediumBase + 50,
    customOverrides?.high ?? Math.ceil(standardBase * highHeadroomMultiplier)
  );

  return {
    low: {
      baseFee: lowBase,
      totalFee: lowBase * ops,
    },
    medium: {
      baseFee: mediumBase,
      totalFee: mediumBase * ops,
    },
    high: {
      baseFee: highBase,
      totalFee: highBase * ops,
    },
  };
}

/**
 * Calculates success likelihood and latency metrics for each fee strategy.
 */
export function calculateStrategyLikelihood(
  tier: FeeStrategyTier,
  baseSimulationSuccess: boolean,
  baseScore: number,
  currentLedgerLoad: number,
  hasErrors: boolean
): {
  successLikelihood: number;
  successLikelihoodPercent: number;
  estimatedInclusionTime: string;
  congestionResilience: 'low' | 'moderate' | 'high';
  costVsLikelihoodRating: string;
} {
  if (!baseSimulationSuccess || hasErrors) {
    return {
      successLikelihood: 0,
      successLikelihoodPercent: 0,
      estimatedInclusionTime: 'N/A (Simulation Failed)',
      congestionResilience: 'low',
      costVsLikelihoodRating: 'Execution Failure',
    };
  }

  const load = clamp(currentLedgerLoad, 0, 1.5);

  switch (tier) {
    case 'low': {
      // Low fee is vulnerable to congestion; queue competition drops inclusion likelihood
      const congestionPenalty = load > 0.5 ? (load - 0.5) * 0.35 + 0.08 : load * 0.1;
      const likelihood = clamp(baseScore - congestionPenalty - 0.04, 0.15, 0.92);
      const estTime = load > 0.8
        ? '~30-60s (3-5 ledgers, risk of delay)'
        : load > 0.4
        ? '~15-30s (2-3 ledgers)'
        : '~10-15s (1-2 ledgers)';
      const rating = load > 0.7 ? 'High Risk under Congestion' : 'Economy / Maximum Savings';

      return {
        successLikelihood: likelihood,
        successLikelihoodPercent: Math.round(likelihood * 100),
        estimatedInclusionTime: estTime,
        congestionResilience: load > 0.6 ? 'low' : 'moderate',
        costVsLikelihoodRating: rating,
      };
    }

    case 'medium': {
      // Medium fee is tuned to the current network load
      const congestionPenalty = load > 0.9 ? (load - 0.9) * 0.12 : 0;
      const likelihood = clamp(baseScore - congestionPenalty, 0.55, 0.98);
      const estTime = load > 1.0 ? '~10-20s (1-2 ledgers)' : '~5-10s (Next ledger)';
      const rating = 'Best Value (Balanced)';

      return {
        successLikelihood: likelihood,
        successLikelihoodPercent: Math.round(likelihood * 100),
        estimatedInclusionTime: estTime,
        congestionResilience: 'moderate',
        costVsLikelihoodRating: rating,
      };
    }

    case 'high': {
      // High fee offers priority and surge protection
      const boost = 0.03 + (load * 0.04);
      const likelihood = clamp(baseScore + boost, 0.85, 0.999);
      const estTime = '<5s (Immediate next ledger priority)';
      const rating = 'Fastest & Surge Protected';

      return {
        successLikelihood: likelihood,
        successLikelihoodPercent: Math.round(likelihood * 100),
        estimatedInclusionTime: estTime,
        congestionResilience: 'high',
        costVsLikelihoodRating: rating,
      };
    }
  }
}

/**
 * Main engine: Runs a comprehensive dry-run comparison across low, medium, and high fee strategies.
 */
export async function compareFeeStrategiesDryRun(
  params: CompareFeeStrategiesParams
): Promise<FeeStrategyComparisonReport> {
  const validation = validateFeeStrategyInput(params);
  const currentLedgerLoad = clamp(params.currentLedgerLoad ?? 0.55, 0, 1.5);
  const operationCount = Math.max(1, params.operations?.length || 0);
  const accountBalanceStroops = parseBalanceToStroops(params.accountBalance);
  const timestamp = new Date().toISOString();

  // If input is strictly invalid or unsupported environment with critical errors
  if (!validation.valid) {
    const emptySim: SimulateResult = {
      fee: 0,
      operationCount,
      success: false,
      errors: validation.errors,
      warnings: validation.warnings.length ? validation.warnings : undefined,
    };

    const emptyStrategies: Record<FeeStrategyTier, FeeStrategyDryRunResult> = {
      low: createFallbackStrategy('low', 'Low (Economy)', emptySim, MIN_BASE_FEE_STROOPS, operationCount),
      medium: createFallbackStrategy('medium', 'Medium (Standard)', emptySim, MIN_BASE_FEE_STROOPS * 1.5, operationCount),
      high: createFallbackStrategy('high', 'High (Priority)', emptySim, MIN_BASE_FEE_STROOPS * 2, operationCount),
    };

    return {
      valid: false,
      isUnsupportedEnvironment: validation.isUnsupportedEnvironment,
      environmentError: validation.environmentError,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
      strategies: emptyStrategies,
      strategyList: [emptyStrategies.low, emptyStrategies.medium, emptyStrategies.high],
      recommendedTier: 'medium',
      currentLedgerLoad,
      operationCount,
      baseSimulationSuccess: false,
      executionTrace: [
        {
          step: 'Input Validation',
          status: 'error',
          detail: validation.errors.join('; '),
        },
      ],
      timestamp,
    };
  }

  // Calculate fees for low, medium, high
  const strategyFees = calculateStrategyFees(operationCount, currentLedgerLoad, params.customFeeOverrides);

  // Run dry-run simulation for medium tier first as the canonical base
  let baseSimResult: SimulateResult;
  let executionTrace: ExecutionTraceStep[] = [];

  const networkKey = (params.network || 'testnet').toLowerCase() as NetworkName;
  const buildParams: BuildTransactionParams = {
    sourceAccount: params.sourceAccount!.trim(),
    operations: params.operations as any,
    memo: params.memo || '',
    timeBounds: (params.timeBounds as any) || {},
    baseFee: strategyFees.medium.baseFee,
    network: networkKey,
  };

  try {
    baseSimResult = await simulateTransaction(buildParams);
    executionTrace = buildExecutionTrace(buildParams, baseSimResult);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Simulation execution failed';
    baseSimResult = {
      fee: 0,
      operationCount,
      success: false,
      errors: [errorMsg],
    };
    executionTrace = [
      {
        step: 'Simulate preflight',
        status: 'error',
        detail: errorMsg,
      },
    ];
  }

  const baseScore = scoreTransactionSuccess(baseSimResult, currentLedgerLoad);
  const baseSuccess = baseSimResult.success && baseSimResult.errors.length === 0;

  // Determine recommended strategy based on congestion and success likelihood
  let recommendedTier: FeeStrategyTier = 'medium';
  if (currentLedgerLoad >= 0.85) {
    recommendedTier = 'high';
  } else if (currentLedgerLoad <= 0.35 && baseSuccess) {
    recommendedTier = 'low';
  }

  // Build each strategy's detailed dry-run report
  const tiers: FeeStrategyTier[] = ['low', 'medium', 'high'];
  const labels: Record<FeeStrategyTier, string> = {
    low: 'Low (Economy)',
    medium: 'Medium (Standard)',
    high: 'High (Priority)',
  };
  const descriptions: Record<FeeStrategyTier, string> = {
    low: 'Lowest cost per operation. Ideal for non-urgent transactions during low network activity.',
    medium: 'Dynamic rate balanced for current congestion. Recommended for reliable standard execution.',
    high: 'Priority fee with surge protection. Maximizes inclusion speed during high traffic or critical actions.',
  };

  const lowTotalFee = strategyFees.low.totalFee;
  const strategies: Partial<Record<FeeStrategyTier, FeeStrategyDryRunResult>> = {};

  for (const tier of tiers) {
    const feeInfo = strategyFees[tier];
    const {
      successLikelihood,
      successLikelihoodPercent,
      estimatedInclusionTime,
      congestionResilience,
      costVsLikelihoodRating,
    } = calculateStrategyLikelihood(
      tier,
      baseSuccess,
      baseScore,
      currentLedgerLoad,
      Boolean(baseSimResult.errors.length)
    );

    const feeDifference = feeInfo.totalFee - lowTotalFee;
    const percentDiff = lowTotalFee > 0 ? Math.round((feeDifference / lowTotalFee) * 100) : 0;

    const warnings = [...(baseSimResult.warnings || [])];
    const errors = [...(baseSimResult.errors || [])];

    // Balance coverage checking
    let canCoverFee: boolean | undefined = undefined;
    let balanceAfterFee: number | null = null;
    if (accountBalanceStroops !== null) {
      canCoverFee = accountBalanceStroops >= feeInfo.totalFee;
      balanceAfterFee = Math.max(0, accountBalanceStroops - feeInfo.totalFee);
      if (!canCoverFee) {
        warnings.push(
          `Account balance (${stroopsToXLM(accountBalanceStroops)}) is insufficient to cover the ${tier} strategy fee (${stroopsToXLM(feeInfo.totalFee)}).`
        );
      }
    }

    if (tier === 'low' && currentLedgerLoad > 0.7) {
      warnings.push('Network congestion is elevated. Low fee strategy may experience significant inclusion delays.');
    }

    // Clone simulation result with tier-specific fee
    const strategySim: SimulateResult = {
      ...baseSimResult,
      fee: feeInfo.totalFee,
    };

    strategies[tier] = {
      tier,
      label: labels[tier],
      description: descriptions[tier],
      baseFee: feeInfo.baseFee,
      totalFee: feeInfo.totalFee,
      totalFeeXLM: stroopsToXLM(feeInfo.totalFee),
      successLikelihood,
      successLikelihoodPercent,
      estimatedInclusionTime,
      congestionResilience,
      costVsLikelihoodRating,
      isRecommended: tier === recommendedTier,
      costDifferenceVsLow: {
        stroops: feeDifference,
        xlm: stroopsToXLM(feeDifference),
        percentDifference: percentDiff,
      },
      simulation: strategySim,
      canCoverFee,
      balanceAfterFee,
      warnings,
      errors,
    };
  }

  const typedStrategies = strategies as Record<FeeStrategyTier, FeeStrategyDryRunResult>;

  return {
    valid: true,
    isUnsupportedEnvironment: validation.isUnsupportedEnvironment,
    environmentError: validation.environmentError,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    strategies: typedStrategies,
    strategyList: [typedStrategies.low, typedStrategies.medium, typedStrategies.high],
    recommendedTier,
    currentLedgerLoad,
    operationCount,
    baseSimulationSuccess: baseSuccess,
    executionTrace,
    timestamp,
  };
}

function createFallbackStrategy(
  tier: FeeStrategyTier,
  label: string,
  sim: SimulateResult,
  baseFee: number,
  opCount: number
): FeeStrategyDryRunResult {
  const totalFee = Math.round(baseFee * opCount);
  return {
    tier,
    label,
    description: '',
    baseFee: Math.round(baseFee),
    totalFee,
    totalFeeXLM: stroopsToXLM(totalFee),
    successLikelihood: 0,
    successLikelihoodPercent: 0,
    estimatedInclusionTime: 'N/A',
    congestionResilience: 'low',
    costVsLikelihoodRating: 'Invalid Parameters',
    isRecommended: tier === 'medium',
    costDifferenceVsLow: {
      stroops: 0,
      xlm: '0.0000000 XLM',
      percentDifference: 0,
    },
    simulation: sim,
    canCoverFee: false,
    balanceAfterFee: null,
    warnings: [],
    errors: sim.errors,
  };
}
