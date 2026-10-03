/**
 * Path Payment Invariants & Rounding Engine
 *
 * Implements and verifies amount conservation, precision (stroop arithmetic),
 * slippage bounds, multi-hop routing, and AMM constant-product invariants for
 * Stellar path payments (both strict-send and strict-receive).
 */

export const STROOP_SCALE = 10_000_000n; // 1 XLM = 10^7 stroops
export const MIN_AMOUNT_STROOPS = 1n; // 0.0000001
export const MAX_INT64_STROOPS = 9_223_372_036_854_775_807n; // 2^63 - 1 stroops (~922.33 billion)
export const MAX_PATH_HOPS = 5; // Protocol limit on intermediate assets

export type RoundingMode = 'floor' | 'ceil' | 'round' | 'truncate';

export type PathPaymentInvariantErrorCode =
  | 'INVALID_AMOUNT'
  | 'INVALID_SLIPPAGE'
  | 'INVALID_PRECISION'
  | 'PATH_TOO_LONG'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'ZERO_OUTPUT'
  | 'CONSERVATION_VIOLATION'
  | 'UNSUPPORTED_ENVIRONMENT';

export class PathPaymentInvariantError extends Error {
  public readonly code: PathPaymentInvariantErrorCode;

  constructor(code: PathPaymentInvariantErrorCode, message: string) {
    super(message);
    this.name = 'PathPaymentInvariantError';
    this.code = code;
  }
}

export interface PathAssetIdentifier {
  code: string;
  issuer?: string;
  isNative?: boolean;
}

export interface AmmPoolHop {
  type: 'amm';
  reserveA: bigint | number | string; // Base reserve in stroops or decimal
  reserveB: bigint | number | string; // Counter reserve in stroops or decimal
  feePercent?: number; // e.g. 0.3 for 0.3%
}

export interface OrderBookHop {
  type: 'orderbook';
  price: number | string; // Rate = output / input
}

export type PathHop = AmmPoolHop | OrderBookHop;

export interface StrictSendParams {
  sendAmount: string | number | bigint;
  expectedDestAmount?: string | number | bigint;
  effectiveRate?: number | string;
  slippageTolerancePercent?: number | string;
}

export interface StrictSendResult {
  isValid: boolean;
  sendAmountStroops: bigint;
  sendAmount: string;
  expectedDestAmountStroops: bigint;
  expectedDestAmount: string;
  destMinStroops: bigint;
  destMin: string;
  effectiveRate: number;
  slippageTolerancePercent: number;
  invariantsHold: boolean;
  error?: string;
  code?: PathPaymentInvariantErrorCode;
}

export interface StrictReceiveParams {
  destAmount: string | number | bigint;
  expectedSourceAmount?: string | number | bigint;
  effectiveRate?: number | string;
  slippageTolerancePercent?: number | string;
}

export interface StrictReceiveResult {
  isValid: boolean;
  destAmountStroops: bigint;
  destAmount: string;
  expectedSourceAmountStroops: bigint;
  expectedSourceAmount: string;
  sendMaxStroops: bigint;
  sendMax: string;
  effectiveRate: number;
  slippageTolerancePercent: number;
  invariantsHold: boolean;
  error?: string;
  code?: PathPaymentInvariantErrorCode;
}

export interface MultiHopPathSimulationParams {
  mode: 'strict-send' | 'strict-receive';
  amount: string | number | bigint;
  hops: PathHop[];
  slippageTolerancePercent?: number | string;
}

export interface HopExecutionRecord {
  hopIndex: number;
  hopType: 'amm' | 'orderbook';
  inputStroops: bigint;
  outputStroops: bigint;
  inputAmount: string;
  outputAmount: string;
  effectivePrice: number;
}

export interface MultiHopPathSimulationResult {
  isValid: boolean;
  mode: 'strict-send' | 'strict-receive';
  initialAmountStroops: bigint;
  finalAmountStroops: bigint;
  initialAmount: string;
  finalAmount: string;
  protectedLimitStroops: bigint; // destMin for strict-send, sendMax for strict-receive
  protectedLimit: string;
  hopRecords: HopExecutionRecord[];
  overallEffectiveRate: number;
  invariantsHold: boolean;
  error?: string;
  code?: PathPaymentInvariantErrorCode;
}

// ─── Stroop Arithmetic & Rounding Invariants ──────────────────────────────────

/**
 * Converts a decimal string, number, or bigint to exact integer stroops.
 * Enforces Stellar's 7 decimal places precision limit.
 */
export function toStroops(
  amount: string | number | bigint,
  mode: RoundingMode = 'truncate'
): bigint {
  if (typeof amount === 'bigint') {
    if (amount < 0n) {
      throw new PathPaymentInvariantError('INVALID_AMOUNT', 'Stroop amount cannot be negative.');
    }
    if (amount > MAX_INT64_STROOPS) {
      throw new PathPaymentInvariantError(
        'INVALID_AMOUNT',
        'Stroop amount exceeds 64-bit signed integer limit.'
      );
    }
    return amount;
  }

  if (typeof amount === 'number') {
    if (isNaN(amount) || !isFinite(amount)) {
      throw new PathPaymentInvariantError('INVALID_AMOUNT', 'Amount must be a finite number.');
    }
    if (amount < 0) {
      throw new PathPaymentInvariantError('INVALID_AMOUNT', 'Amount cannot be negative.');
    }
    // Convert number to fixed string to prevent scientific notation surprises
    amount = amount.toFixed(10);
  }

  const str = String(amount).trim();
  if (!str || !/^\d+(\.\d+)?$/.test(str)) {
    throw new PathPaymentInvariantError(
      'INVALID_AMOUNT',
      `Invalid decimal amount format: "${amount}".`
    );
  }

  const [wholeStr, fracStr = ''] = str.split('.');
  const wholeBigInt = BigInt(wholeStr);

  let fracBigInt = 0n;
  if (fracStr.length > 0) {
    if (fracStr.length <= 7) {
      const padded = fracStr.padEnd(7, '0');
      fracBigInt = BigInt(padded);
    } else {
      // Sub-stroop fraction present (> 7 decimals)
      const mainPart = fracStr.slice(0, 7);
      const subPart = fracStr.slice(7);
      const mainStroop = BigInt(mainPart);
      const subNumber = Number('0.' + subPart);

      switch (mode) {
        case 'floor':
        case 'truncate':
          fracBigInt = mainStroop;
          break;
        case 'ceil':
          fracBigInt = subNumber > 0 ? mainStroop + 1n : mainStroop;
          break;
        case 'round':
          fracBigInt = subNumber >= 0.5 ? mainStroop + 1n : mainStroop;
          break;
      }
    }
  }

  const totalStroops = wholeBigInt * STROOP_SCALE + fracBigInt;
  if (totalStroops > MAX_INT64_STROOPS) {
    throw new PathPaymentInvariantError(
      'INVALID_AMOUNT',
      'Amount exceeds maximum Stellar int64 capacity.'
    );
  }

  return totalStroops;
}

/**
 * Converts integer stroops to canonical Stellar 7-decimal string without trailing zeros.
 */
export function fromStroops(stroops: bigint): string {
  if (stroops < 0n) {
    throw new PathPaymentInvariantError('INVALID_AMOUNT', 'Stroops cannot be negative.');
  }
  const whole = stroops / STROOP_SCALE;
  const remainder = stroops % STROOP_SCALE;
  if (remainder === 0n) {
    return whole.toString();
  }
  const frac = remainder.toString().padStart(7, '0').replace(/0+$/, '');
  return `${whole}.${frac}`;
}

/**
 * Canonical stroop rounding helper.
 */
export function roundToStroops(amount: string | number, mode: RoundingMode = 'floor'): string {
  const stroops = toStroops(amount, mode);
  return fromStroops(stroops);
}

// ─── Strict-Send Invariants ───────────────────────────────────────────────────

/**
 * Calculates strict-send path payment amounts and enforces invariants:
 * 1. sendAmount is fixed (> 0).
 * 2. destMin <= expectedDestAmount.
 * 3. destMin is rounded DOWN (floor) to guarantee minimum received invariant.
 * 4. destMin > 0.
 * 5. Slippage monotonicity: higher slippage => non-increasing destMin.
 */
export function calculateStrictSendLimits(params: StrictSendParams): StrictSendResult {
  const {
    sendAmount,
    expectedDestAmount: rawExpected,
    effectiveRate: rawRate,
    slippageTolerancePercent = 0.5,
  } = params;

  const slippage = Number(slippageTolerancePercent);
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    return {
      isValid: false,
      sendAmountStroops: 0n,
      sendAmount: '0',
      expectedDestAmountStroops: 0n,
      expectedDestAmount: '0',
      destMinStroops: 0n,
      destMin: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Invalid slippage tolerance. Must be between 0% and 50%.',
      code: 'INVALID_SLIPPAGE',
    };
  }

  let sendStroops: bigint;
  try {
    sendStroops = toStroops(sendAmount, 'truncate');
  } catch (err) {
    return {
      isValid: false,
      sendAmountStroops: 0n,
      sendAmount: '0',
      expectedDestAmountStroops: 0n,
      expectedDestAmount: '0',
      destMinStroops: 0n,
      destMin: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: err instanceof Error ? err.message : 'Invalid send amount.',
      code: 'INVALID_AMOUNT',
    };
  }

  if (sendStroops <= 0n) {
    return {
      isValid: false,
      sendAmountStroops: 0n,
      sendAmount: '0',
      expectedDestAmountStroops: 0n,
      expectedDestAmount: '0',
      destMinStroops: 0n,
      destMin: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Send amount must be greater than zero.',
      code: 'INVALID_AMOUNT',
    };
  }

  let expectedStroops: bigint;
  let effectiveRate = 1.0;

  if (rawExpected !== undefined) {
    try {
      expectedStroops = toStroops(rawExpected, 'floor');
      effectiveRate = Number(expectedStroops) / Number(sendStroops);
    } catch (err) {
      return {
        isValid: false,
        sendAmountStroops: sendStroops,
        sendAmount: fromStroops(sendStroops),
        expectedDestAmountStroops: 0n,
        expectedDestAmount: '0',
        destMinStroops: 0n,
        destMin: '0',
        effectiveRate: 0,
        slippageTolerancePercent: slippage,
        invariantsHold: false,
        error: err instanceof Error ? err.message : 'Invalid expected destination amount.',
        code: 'INVALID_AMOUNT',
      };
    }
  } else if (rawRate !== undefined) {
    effectiveRate = Number(rawRate);
    if (isNaN(effectiveRate) || effectiveRate <= 0) {
      return {
        isValid: false,
        sendAmountStroops: sendStroops,
        sendAmount: fromStroops(sendStroops),
        expectedDestAmountStroops: 0n,
        expectedDestAmount: '0',
        destMinStroops: 0n,
        destMin: '0',
        effectiveRate: 0,
        slippageTolerancePercent: slippage,
        invariantsHold: false,
        error: 'Effective exchange rate must be positive.',
        code: 'INVALID_AMOUNT',
      };
    }
    // Compute destination stroops with floor rounding
    const rawDestNumber = Number(sendStroops) * effectiveRate;
    expectedStroops = BigInt(Math.floor(rawDestNumber));
  } else {
    expectedStroops = sendStroops;
    effectiveRate = 1.0;
  }

  if (expectedStroops <= 0n) {
    return {
      isValid: false,
      sendAmountStroops: sendStroops,
      sendAmount: fromStroops(sendStroops),
      expectedDestAmountStroops: 0n,
      expectedDestAmount: '0',
      destMinStroops: 0n,
      destMin: '0',
      effectiveRate,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Expected destination amount rounds down to zero stroops.',
      code: 'ZERO_OUTPUT',
    };
  }

  // Calculate destMin = expected * (1 - slippage / 100) with FLOOR rounding
  // Using integer math: (expectedStroops * (10000 - slippageBps)) / 10000
  const slippageBps = BigInt(Math.round(slippage * 100));
  const destMinStroops = (expectedStroops * (10000n - slippageBps)) / 10000n;

  if (destMinStroops <= 0n) {
    return {
      isValid: false,
      sendAmountStroops: sendStroops,
      sendAmount: fromStroops(sendStroops),
      expectedDestAmountStroops: expectedStroops,
      expectedDestAmount: fromStroops(expectedStroops),
      destMinStroops: 0n,
      destMin: '0',
      effectiveRate,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Minimum destination amount rounds down to zero stroops.',
      code: 'ZERO_OUTPUT',
    };
  }

  // Verify core invariants
  const invariantsHold =
    destMinStroops <= expectedStroops &&
    destMinStroops > 0n &&
    sendStroops > 0n &&
    expectedStroops > 0n;

  return {
    isValid: invariantsHold,
    sendAmountStroops: sendStroops,
    sendAmount: fromStroops(sendStroops),
    expectedDestAmountStroops: expectedStroops,
    expectedDestAmount: fromStroops(expectedStroops),
    destMinStroops,
    destMin: fromStroops(destMinStroops),
    effectiveRate,
    slippageTolerancePercent: slippage,
    invariantsHold,
  };
}

// ─── Strict-Receive Invariants ────────────────────────────────────────────────

/**
 * Calculates strict-receive path payment amounts and enforces invariants:
 * 1. destAmount is fixed (> 0).
 * 2. sendMax >= expectedSourceAmount.
 * 3. sendMax is rounded UP (ceil) to guarantee sender provides sufficient balance headroom.
 * 4. sendMax > 0.
 * 5. Slippage monotonicity: higher slippage => non-decreasing sendMax.
 */
export function calculateStrictReceiveLimits(params: StrictReceiveParams): StrictReceiveResult {
  const {
    destAmount,
    expectedSourceAmount: rawExpected,
    effectiveRate: rawRate,
    slippageTolerancePercent = 0.5,
  } = params;

  const slippage = Number(slippageTolerancePercent);
  if (isNaN(slippage) || slippage < 0 || slippage > 50) {
    return {
      isValid: false,
      destAmountStroops: 0n,
      destAmount: '0',
      expectedSourceAmountStroops: 0n,
      expectedSourceAmount: '0',
      sendMaxStroops: 0n,
      sendMax: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Invalid slippage tolerance. Must be between 0% and 50%.',
      code: 'INVALID_SLIPPAGE',
    };
  }

  let destStroops: bigint;
  try {
    destStroops = toStroops(destAmount, 'truncate');
  } catch (err) {
    return {
      isValid: false,
      destAmountStroops: 0n,
      destAmount: '0',
      expectedSourceAmountStroops: 0n,
      expectedSourceAmount: '0',
      sendMaxStroops: 0n,
      sendMax: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: err instanceof Error ? err.message : 'Invalid destination amount.',
      code: 'INVALID_AMOUNT',
    };
  }

  if (destStroops <= 0n) {
    return {
      isValid: false,
      destAmountStroops: 0n,
      destAmount: '0',
      expectedSourceAmountStroops: 0n,
      expectedSourceAmount: '0',
      sendMaxStroops: 0n,
      sendMax: '0',
      effectiveRate: 0,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Destination amount must be greater than zero.',
      code: 'INVALID_AMOUNT',
    };
  }

  let expectedSourceStroops: bigint;
  let effectiveRate = 1.0;

  if (rawExpected !== undefined) {
    try {
      expectedSourceStroops = toStroops(rawExpected, 'ceil');
      effectiveRate = Number(destStroops) / Number(expectedSourceStroops);
    } catch (err) {
      return {
        isValid: false,
        destAmountStroops: destStroops,
        destAmount: fromStroops(destStroops),
        expectedSourceAmountStroops: 0n,
        expectedSourceAmount: '0',
        sendMaxStroops: 0n,
        sendMax: '0',
        effectiveRate: 0,
        slippageTolerancePercent: slippage,
        invariantsHold: false,
        error: err instanceof Error ? err.message : 'Invalid expected source amount.',
        code: 'INVALID_AMOUNT',
      };
    }
  } else if (rawRate !== undefined) {
    effectiveRate = Number(rawRate);
    if (isNaN(effectiveRate) || effectiveRate <= 0) {
      return {
        isValid: false,
        destAmountStroops: destStroops,
        destAmount: fromStroops(destStroops),
        expectedSourceAmountStroops: 0n,
        expectedSourceAmount: '0',
        sendMaxStroops: 0n,
        sendMax: '0',
        effectiveRate: 0,
        slippageTolerancePercent: slippage,
        invariantsHold: false,
        error: 'Effective exchange rate must be positive.',
        code: 'INVALID_AMOUNT',
      };
    }
    // Source = dest / rate with CEIL rounding
    const rawSourceNumber = Number(destStroops) / effectiveRate;
    expectedSourceStroops = BigInt(Math.ceil(rawSourceNumber));
  } else {
    expectedSourceStroops = destStroops;
    effectiveRate = 1.0;
  }

  if (expectedSourceStroops <= 0n) {
    return {
      isValid: false,
      destAmountStroops: destStroops,
      destAmount: fromStroops(destStroops),
      expectedSourceAmountStroops: 0n,
      expectedSourceAmount: '0',
      sendMaxStroops: 0n,
      sendMax: '0',
      effectiveRate,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'Expected source amount rounds to zero stroops.',
      code: 'ZERO_OUTPUT',
    };
  }

  // Calculate sendMax = expectedSource * (1 + slippage / 100) with CEIL rounding
  // Using integer math with ceiling: (expectedSourceStroops * (10000 + slippageBps) + 9999) / 10000
  const slippageBps = BigInt(Math.round(slippage * 100));
  const sendMaxStroops = (expectedSourceStroops * (10000n + slippageBps) + 9999n) / 10000n;

  if (sendMaxStroops > MAX_INT64_STROOPS) {
    return {
      isValid: false,
      destAmountStroops: destStroops,
      destAmount: fromStroops(destStroops),
      expectedSourceAmountStroops: expectedSourceStroops,
      expectedSourceAmount: fromStroops(expectedSourceStroops),
      sendMaxStroops: 0n,
      sendMax: '0',
      effectiveRate,
      slippageTolerancePercent: slippage,
      invariantsHold: false,
      error: 'sendMax exceeds maximum 64-bit integer stroop limit.',
      code: 'INVALID_AMOUNT',
    };
  }

  // Verify core invariants
  const invariantsHold =
    sendMaxStroops >= expectedSourceStroops &&
    sendMaxStroops > 0n &&
    destStroops > 0n &&
    expectedSourceStroops > 0n;

  return {
    isValid: invariantsHold,
    destAmountStroops: destStroops,
    destAmount: fromStroops(destStroops),
    expectedSourceAmountStroops: expectedSourceStroops,
    expectedSourceAmount: fromStroops(expectedSourceStroops),
    sendMaxStroops,
    sendMax: fromStroops(sendMaxStroops),
    effectiveRate,
    slippageTolerancePercent: slippage,
    invariantsHold,
  };
}

// ─── Multi-Hop Path & AMM Constant Product Invariants ─────────────────────────

/**
 * Simulates path execution across multiple hops (orderbooks / AMM pools).
 * Enforces:
 * 1. Max 5 intermediate hops protocol limit.
 * 2. Constant product invariant (x * y = k) for AMM pools.
 * 3. Intermediate amount positivity (no intermediate step yields 0 stroops).
 * 4. Fee deduction conservation (fees 0 <= f < 100%).
 * 5. Value degradation in zero-gain roundtrips under positive fees.
 */
export function simulateMultiHopPathPayment(
  params: MultiHopPathSimulationParams
): MultiHopPathSimulationResult {
  const { mode, amount, hops, slippageTolerancePercent = 0.5 } = params;

  if (!hops || hops.length === 0) {
    return createSimulationError(mode, 'Path must contain at least one hop.', 'INVALID_AMOUNT');
  }

  if (hops.length > MAX_PATH_HOPS) {
    return createSimulationError(
      mode,
      `Path exceeds Stellar maximum of ${MAX_PATH_HOPS} intermediate hops.`,
      'PATH_TOO_LONG'
    );
  }

  let currentStroops: bigint;
  try {
    currentStroops = toStroops(amount, mode === 'strict-send' ? 'truncate' : 'ceil');
  } catch (err) {
    return createSimulationError(
      mode,
      err instanceof Error ? err.message : 'Invalid initial path payment amount.',
      'INVALID_AMOUNT'
    );
  }

  if (currentStroops <= 0n) {
    return createSimulationError(
      mode,
      'Path payment initial amount must be > 0.',
      'INVALID_AMOUNT'
    );
  }

  const initialStroops = currentStroops;
  const hopRecords: HopExecutionRecord[] = [];

  if (mode === 'strict-send') {
    // Traverse hops forward: Asset 0 -> Asset 1 -> ... -> Asset N
    for (let i = 0; i < hops.length; i++) {
      const hop = hops[i];
      const hopInput = currentStroops;
      let hopOutput: bigint;

      if (hop.type === 'orderbook') {
        const p = Number(hop.price);
        if (isNaN(p) || p <= 0) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} has invalid orderbook price.`,
            'INVALID_AMOUNT'
          );
        }
        // Floor rounding on receive
        hopOutput = BigInt(Math.floor(Number(hopInput) * p));
      } else if (hop.type === 'amm') {
        const reserveA = toStroops(hop.reserveA, 'floor');
        const reserveB = toStroops(hop.reserveB, 'floor');
        const feePercent = hop.feePercent ?? 0.3;

        if (reserveA <= 0n || reserveB <= 0n) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} has depleted AMM pool reserves.`,
            'INSUFFICIENT_LIQUIDITY'
          );
        }

        if (feePercent < 0 || feePercent >= 100) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} has invalid fee percentage.`,
            'INVALID_SLIPPAGE'
          );
        }

        // AMM formula with fee:
        // amountWithFee = input * (10000 - feeBps) / 10000
        // output = (reserveB * amountWithFee) / (reserveA + amountWithFee)
        const feeBps = BigInt(Math.round(feePercent * 100));
        const amountWithFee = (hopInput * (10000n - feeBps)) / 10000n;
        hopOutput = (reserveB * amountWithFee) / (reserveA + amountWithFee);

        // Constant Product Invariant Check: (reserveA + amountWithFee) * (reserveB - hopOutput) >= reserveA * reserveB
        const newReserveB = reserveB - hopOutput;
        if (newReserveB <= 0n) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} trade amount depletes AMM pool reserve.`,
            'INSUFFICIENT_LIQUIDITY'
          );
        }
        const kOld = reserveA * reserveB;
        const kNew = (reserveA + amountWithFee) * newReserveB;
        if (kNew < kOld) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} violates AMM constant product invariant (k_new < k_old).`,
            'CONSERVATION_VIOLATION'
          );
        }
      } else {
        return createSimulationError(mode, `Unsupported hop type at index ${i}.`, 'INVALID_AMOUNT');
      }

      if (hopOutput <= 0n) {
        return createSimulationError(
          mode,
          `Hop ${i + 1} output drops to 0 stroops.`,
          'ZERO_OUTPUT'
        );
      }

      const effectivePrice = Number(hopOutput) / Number(hopInput);
      hopRecords.push({
        hopIndex: i,
        hopType: hop.type,
        inputStroops: hopInput,
        outputStroops: hopOutput,
        inputAmount: fromStroops(hopInput),
        outputAmount: fromStroops(hopOutput),
        effectivePrice,
      });

      currentStroops = hopOutput;
    }

    const limits = calculateStrictSendLimits({
      sendAmount: fromStroops(initialStroops),
      expectedDestAmount: fromStroops(currentStroops),
      slippageTolerancePercent,
    });

    if (!limits.isValid) {
      return createSimulationError(
        mode,
        limits.error || 'Strict send limits invalid.',
        limits.code || 'INVALID_AMOUNT'
      );
    }

    return {
      isValid: true,
      mode,
      initialAmountStroops: initialStroops,
      finalAmountStroops: currentStroops,
      initialAmount: fromStroops(initialStroops),
      finalAmount: fromStroops(currentStroops),
      protectedLimitStroops: limits.destMinStroops,
      protectedLimit: limits.destMin,
      hopRecords,
      overallEffectiveRate: Number(currentStroops) / Number(initialStroops),
      invariantsHold: limits.invariantsHold && currentStroops >= limits.destMinStroops,
    };
  } else {
    // Strict-receive mode: amount is final desired destination amount.
    // Traverse backwards from Destination -> Source:
    let requiredOutputStroops = currentStroops;

    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i];
      let requiredInput: bigint;

      if (hop.type === 'orderbook') {
        const p = Number(hop.price);
        if (isNaN(p) || p <= 0) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} has invalid orderbook price.`,
            'INVALID_AMOUNT'
          );
        }
        // Input needed = output / price (ceil rounding)
        requiredInput = BigInt(Math.ceil(Number(requiredOutputStroops) / p));
      } else if (hop.type === 'amm') {
        const reserveA = toStroops(hop.reserveA, 'floor');
        const reserveB = toStroops(hop.reserveB, 'floor');
        const feePercent = hop.feePercent ?? 0.3;

        if (reserveA <= 0n || reserveB <= 0n) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} has depleted AMM pool reserves.`,
            'INSUFFICIENT_LIQUIDITY'
          );
        }

        if (requiredOutputStroops >= reserveB) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} desired output exceeds total AMM counter reserve (${fromStroops(reserveB)}).`,
            'INSUFFICIENT_LIQUIDITY'
          );
        }

        const feeBps = BigInt(Math.round(feePercent * 100));
        const newReserveB = reserveB - requiredOutputStroops;
        // requiredA_withFee = (reserveA * output) / (reserveB - output) + 1
        const requiredA_withFee =
          (reserveA * requiredOutputStroops + newReserveB - 1n) / newReserveB;
        // requiredA_gross = (requiredA_withFee * 10000) / (10000 - feeBps) + 1
        requiredInput = (requiredA_withFee * 10000n + (10000n - feeBps - 1n)) / (10000n - feeBps);

        // Constant product check
        const kOld = reserveA * reserveB;
        const amountWithFee = (requiredInput * (10000n - feeBps)) / 10000n;
        const kNew = (reserveA + amountWithFee) * newReserveB;
        if (kNew < kOld) {
          return createSimulationError(
            mode,
            `Hop ${i + 1} violates AMM constant product invariant.`,
            'CONSERVATION_VIOLATION'
          );
        }
      } else {
        return createSimulationError(mode, `Unsupported hop type at index ${i}.`, 'INVALID_AMOUNT');
      }

      if (requiredInput <= 0n) {
        return createSimulationError(
          mode,
          `Hop ${i + 1} required input drops to 0.`,
          'ZERO_OUTPUT'
        );
      }

      hopRecords.unshift({
        hopIndex: i,
        hopType: hop.type,
        inputStroops: requiredInput,
        outputStroops: requiredOutputStroops,
        inputAmount: fromStroops(requiredInput),
        outputAmount: fromStroops(requiredOutputStroops),
        effectivePrice: Number(requiredOutputStroops) / Number(requiredInput),
      });

      requiredOutputStroops = requiredInput;
    }

    const limits = calculateStrictReceiveLimits({
      destAmount: fromStroops(initialStroops),
      expectedSourceAmount: fromStroops(requiredOutputStroops),
      slippageTolerancePercent,
    });

    if (!limits.isValid) {
      return createSimulationError(
        mode,
        limits.error || 'Strict receive limits invalid.',
        limits.code || 'INVALID_AMOUNT'
      );
    }

    return {
      isValid: true,
      mode,
      initialAmountStroops: initialStroops, // Requested dest amount
      finalAmountStroops: requiredOutputStroops, // Required source amount
      initialAmount: fromStroops(initialStroops),
      finalAmount: fromStroops(requiredOutputStroops),
      protectedLimitStroops: limits.sendMaxStroops,
      protectedLimit: limits.sendMax,
      hopRecords,
      overallEffectiveRate: Number(initialStroops) / Number(requiredOutputStroops),
      invariantsHold: limits.invariantsHold && limits.sendMaxStroops >= requiredOutputStroops,
    };
  }
}

function createSimulationError(
  mode: 'strict-send' | 'strict-receive',
  error: string,
  code: PathPaymentInvariantErrorCode
): MultiHopPathSimulationResult {
  return {
    isValid: false,
    mode,
    initialAmountStroops: 0n,
    finalAmountStroops: 0n,
    initialAmount: '0',
    finalAmount: '0',
    protectedLimitStroops: 0n,
    protectedLimit: '0',
    hopRecords: [],
    overallEffectiveRate: 0,
    invariantsHold: false,
    error,
    code,
  };
}

// ─── Invariant Verification Suite Helper ──────────────────────────────────────

export interface PathPaymentOperationInvariantParams {
  type: 'pathPaymentStrictSend' | 'pathPaymentStrictReceive';
  sendAmount?: string | number;
  destMin?: string | number;
  sendMax?: string | number;
  destAmount?: string | number;
  pathLength?: number;
}

export interface InvariantCheckReport {
  valid: boolean;
  errors: string[];
}

/**
 * Validates invariant assertions for any built or incoming PathPayment operation.
 */
export function verifyPathPaymentOperationInvariants(
  params: PathPaymentOperationInvariantParams
): InvariantCheckReport {
  const errors: string[] = [];

  if (params.pathLength !== undefined && params.pathLength > MAX_PATH_HOPS) {
    errors.push(`Path length (${params.pathLength}) exceeds maximum of ${MAX_PATH_HOPS} hops.`);
  }

  if (params.type === 'pathPaymentStrictSend') {
    if (!params.sendAmount) {
      errors.push('sendAmount is required for strict-send.');
    }
    if (!params.destMin) {
      errors.push('destMin is required for strict-send.');
    }
    if (params.sendAmount && params.destMin) {
      try {
        const sendStroops = toStroops(params.sendAmount);
        const destMinStroops = toStroops(params.destMin);
        if (sendStroops <= 0n) errors.push('sendAmount must be positive.');
        if (destMinStroops <= 0n) errors.push('destMin must be positive.');
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Invalid amount format.');
      }
    }
  } else if (params.type === 'pathPaymentStrictReceive') {
    if (!params.sendMax) {
      errors.push('sendMax is required for strict-receive.');
    }
    if (!params.destAmount) {
      errors.push('destAmount is required for strict-receive.');
    }
    if (params.sendMax && params.destAmount) {
      try {
        const sendMaxStroops = toStroops(params.sendMax);
        const destStroops = toStroops(params.destAmount);
        if (sendMaxStroops <= 0n) errors.push('sendMax must be positive.');
        if (destStroops <= 0n) errors.push('destAmount must be positive.');
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'Invalid amount format.');
      }
    }
  } else {
    errors.push(`Unsupported operation type: ${(params as { type: string }).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
