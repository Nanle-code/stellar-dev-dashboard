import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import {
  toStroops,
  fromStroops,
  roundToStroops,
  calculateStrictSendLimits,
  calculateStrictReceiveLimits,
  simulateMultiHopPathPayment,
  verifyPathPaymentOperationInvariants,
  PathPaymentInvariantError,
  STROOP_SCALE,
  MAX_INT64_STROOPS,
  MAX_PATH_HOPS,
  type PathHop,
  type AmmPoolHop,
  type OrderBookHop,
} from '../pathPaymentInvariants';

// ─── Arbitraries & Generators ─────────────────────────────────────────────────

/** Generates canonical Stellar decimal strings within standard range [1 stroop, 100,000,000 XLM] */
function validAmountStringArb() {
  return fc.bigInt({ min: 1n, max: 100_000_000n * STROOP_SCALE }).map(fromStroops);
}

/** Generates extreme or boundary amounts including 1 stroop, max int64 stroop, and small amounts */
function boundaryAmountStroopsArb() {
  return fc.oneof(
    fc.constant(1n), // 0.0000001
    fc.constant(2n),
    fc.constant(10n),
    fc.constant(STROOP_SCALE), // 1.0 XLM
    fc.constant(100_000n * STROOP_SCALE),
    fc.constant(MAX_INT64_STROOPS - 1n),
    fc.constant(MAX_INT64_STROOPS),
    fc.bigInt({ min: 1n, max: 1_000_000n * STROOP_SCALE })
  );
}

/** Generates valid slippage tolerances in percentage [0%, 50%] */
function validSlippageArb() {
  return fc.double({ min: 0.0, max: 50.0, noNaN: true, noDefaultInfinity: true });
}

/** Generates invalid slippage tolerances (< 0% or > 50% or NaN/Infinity) */
function invalidSlippageArb() {
  return fc.oneof(
    fc.double({ min: -100.0, max: -0.001, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 50.01, max: 500.0, noNaN: true, noDefaultInfinity: true }),
    fc.constant(NaN),
    fc.constant(Infinity),
    fc.constant(-Infinity)
  );
}

/** Generates positive exchange rates [0.0001, 10,000] */
function positiveRateArb() {
  return fc.double({ min: 0.0001, max: 10000.0, noNaN: true, noDefaultInfinity: true });
}

/** Generates valid AMM pool reserve data in stroops */
function validAmmPoolArb(): fc.Arbitrary<AmmPoolHop> {
  return fc
    .tuple(
      fc.bigInt({ min: 10_000n * STROOP_SCALE, max: 100_000_000n * STROOP_SCALE }),
      fc.bigInt({ min: 10_000n * STROOP_SCALE, max: 100_000_000n * STROOP_SCALE }),
      fc.double({ min: 0.0, max: 1.0, noNaN: true, noDefaultInfinity: true })
    )
    .map(([reserveA, reserveB, feePercent]) => ({
      type: 'amm',
      reserveA,
      reserveB,
      feePercent,
    }));
}

/** Generates valid OrderBook hop data */
function validOrderBookHopArb(): fc.Arbitrary<OrderBookHop> {
  return positiveRateArb().map((price) => ({
    type: 'orderbook',
    price,
  }));
}

/** Generates a path containing 1 to 5 valid hops */
function validPathHopsArb(): fc.Arbitrary<PathHop[]> {
  return fc.array(fc.oneof(validAmmPoolArb(), validOrderBookHopArb()), {
    minLength: 1,
    maxLength: MAX_PATH_HOPS,
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Property-Based: Path Payment Amount Invariants & Rounding', () => {
  // ── 1. Stroop Arithmetic & Decimal Precision Invariants ──────────────────────
  describe('Stroop Precision & Decimal Rounding Invariants', () => {
    it('Primary Flow: Round-trip fromStroops(toStroops(x)) preserves value identically', () => {
      fc.assert(
        fc.property(validAmountStringArb(), (amountStr) => {
          const stroops = toStroops(amountStr);
          const formatted = fromStroops(stroops);
          expect(formatted).toBe(amountStr);
        }),
        { numRuns: 100 }
      );
    });

    it('Primary Flow: toStroops accepts bigint and preserves exact integer stroops', () => {
      fc.assert(
        fc.property(boundaryAmountStroopsArb(), (stroops) => {
          const converted = toStroops(stroops);
          expect(converted).toBe(stroops);
          const formatted = fromStroops(converted);
          expect(toStroops(formatted)).toBe(stroops);
        }),
        { numRuns: 100 }
      );
    });

    it('Boundary Case: 1 stroop (0.0000001) and MAX_INT64_STROOPS are correctly quantized', () => {
      expect(toStroops('0.0000001')).toBe(1n);
      expect(fromStroops(1n)).toBe('0.0000001');

      expect(toStroops(MAX_INT64_STROOPS)).toBe(MAX_INT64_STROOPS);
      const maxFormatted = fromStroops(MAX_INT64_STROOPS);
      expect(toStroops(maxFormatted)).toBe(MAX_INT64_STROOPS);
    });

    it('Rounding Mode Invariant: Floor rounding never exceeds ceil rounding', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.0000001, max: 10000.0, noNaN: true, noDefaultInfinity: true }),
          (amount) => {
            const floorStroops = toStroops(amount, 'floor');
            const ceilStroops = toStroops(amount, 'ceil');
            expect(floorStroops).toBeLessThanOrEqual(ceilStroops);

            const floorRounded = roundToStroops(amount, 'floor');
            const ceilRounded = roundToStroops(amount, 'ceil');
            expect(Number(floorRounded)).toBeLessThanOrEqual(Number(ceilRounded));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Failure Case: Rejects invalid, negative, NaN, Infinity, or overflow amounts', () => {
      const invalidInputs = ['-1', '0.00000001', 'abc', '', 'NaN', 'Infinity', '-Infinity'];
      for (const input of invalidInputs) {
        if (input === '0.00000001') {
          // > 7 decimals without explicit rounding throws or truncates
          const res = toStroops(input, 'truncate');
          expect(res).toBe(0n); // truncated sub-stroop fraction
        } else {
          expect(() => toStroops(input)).toThrowError(PathPaymentInvariantError);
        }
      }

      // Overflow case
      expect(() => toStroops(MAX_INT64_STROOPS + 1n)).toThrowError(PathPaymentInvariantError);
      expect(() => toStroops(-1n)).toThrowError(PathPaymentInvariantError);
    });
  });

  // ── 2. Strict-Send Path Payment Invariants ───────────────────────────────────
  describe('Strict-Send Path Payment Invariants', () => {
    it('Primary Flow: destMin <= expectedDestAmount invariant holds for all valid inputs', () => {
      fc.assert(
        fc.property(
          validAmountStringArb(),
          positiveRateArb(),
          validSlippageArb(),
          (sendAmount, rate, slippage) => {
            const result = calculateStrictSendLimits({
              sendAmount,
              effectiveRate: rate,
              slippageTolerancePercent: slippage,
            });

            if (result.isValid) {
              expect(result.invariantsHold).toBe(true);
              expect(result.destMinStroops).toBeLessThanOrEqual(result.expectedDestAmountStroops);
              expect(result.destMinStroops).toBeGreaterThan(0n);
              expect(result.sendAmountStroops).toBeGreaterThan(0n);
              expect(Number(result.destMin)).toBeLessThanOrEqual(Number(result.expectedDestAmount));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Boundary Case: 0% slippage guarantees destMin equals expectedDestAmount exactly', () => {
      fc.assert(
        fc.property(validAmountStringArb(), positiveRateArb(), (sendAmount, rate) => {
          const result = calculateStrictSendLimits({
            sendAmount,
            effectiveRate: rate,
            slippageTolerancePercent: 0,
          });

          if (result.isValid) {
            expect(result.destMinStroops).toBe(result.expectedDestAmountStroops);
            expect(result.destMin).toBe(result.expectedDestAmount);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('Monotonicity Invariant: Increasing slippage tolerance monotonically decreases destMin', () => {
      fc.assert(
        fc.property(
          validAmountStringArb(),
          positiveRateArb(),
          fc
            .tuple(validSlippageArb(), validSlippageArb())
            .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]),
          (sendAmount, rate, [lowSlippage, highSlippage]) => {
            const resLow = calculateStrictSendLimits({
              sendAmount,
              effectiveRate: rate,
              slippageTolerancePercent: lowSlippage,
            });
            const resHigh = calculateStrictSendLimits({
              sendAmount,
              effectiveRate: rate,
              slippageTolerancePercent: highSlippage,
            });

            if (resLow.isValid && resHigh.isValid) {
              expect(resLow.destMinStroops).toBeGreaterThanOrEqual(resHigh.destMinStroops);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Failure Case: Rejects non-positive send amounts or invalid slippage tolerances', () => {
      fc.assert(
        fc.property(invalidSlippageArb(), (invalidSlippage) => {
          const result = calculateStrictSendLimits({
            sendAmount: '100',
            effectiveRate: 1.0,
            slippageTolerancePercent: invalidSlippage,
          });
          expect(result.isValid).toBe(false);
          expect(result.code).toBe('INVALID_SLIPPAGE');
        }),
        { numRuns: 50 }
      );

      const zeroSend = calculateStrictSendLimits({
        sendAmount: '0',
        effectiveRate: 1.0,
      });
      expect(zeroSend.isValid).toBe(false);
      expect(zeroSend.code).toBe('INVALID_AMOUNT');
    });
  });

  // ── 3. Strict-Receive Path Payment Invariants ─────────────────────────────────
  describe('Strict-Receive Path Payment Invariants', () => {
    it('Primary Flow: sendMax >= expectedSourceAmount invariant holds for all valid inputs', () => {
      fc.assert(
        fc.property(
          validAmountStringArb(),
          positiveRateArb(),
          validSlippageArb(),
          (destAmount, rate, slippage) => {
            const result = calculateStrictReceiveLimits({
              destAmount,
              effectiveRate: rate,
              slippageTolerancePercent: slippage,
            });

            if (result.isValid) {
              expect(result.invariantsHold).toBe(true);
              expect(result.sendMaxStroops).toBeGreaterThanOrEqual(
                result.expectedSourceAmountStroops
              );
              expect(result.sendMaxStroops).toBeGreaterThan(0n);
              expect(result.destAmountStroops).toBeGreaterThan(0n);
              expect(Number(result.sendMax)).toBeGreaterThanOrEqual(
                Number(result.expectedSourceAmount)
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Boundary Case: 0% slippage guarantees sendMax equals expectedSourceAmount exactly', () => {
      fc.assert(
        fc.property(validAmountStringArb(), positiveRateArb(), (destAmount, rate) => {
          const result = calculateStrictReceiveLimits({
            destAmount,
            effectiveRate: rate,
            slippageTolerancePercent: 0,
          });

          if (result.isValid) {
            expect(result.sendMaxStroops).toBe(result.expectedSourceAmountStroops);
            expect(result.sendMax).toBe(result.expectedSourceAmount);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('Monotonicity Invariant: Increasing slippage tolerance monotonically increases sendMax', () => {
      fc.assert(
        fc.property(
          validAmountStringArb(),
          positiveRateArb(),
          fc
            .tuple(validSlippageArb(), validSlippageArb())
            .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]),
          (destAmount, rate, [lowSlippage, highSlippage]) => {
            const resLow = calculateStrictReceiveLimits({
              destAmount,
              effectiveRate: rate,
              slippageTolerancePercent: lowSlippage,
            });
            const resHigh = calculateStrictReceiveLimits({
              destAmount,
              effectiveRate: rate,
              slippageTolerancePercent: highSlippage,
            });

            if (resLow.isValid && resHigh.isValid) {
              expect(resHigh.sendMaxStroops).toBeGreaterThanOrEqual(resLow.sendMaxStroops);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Failure Case: Rejects non-positive dest amounts or invalid slippage tolerances', () => {
      fc.assert(
        fc.property(invalidSlippageArb(), (invalidSlippage) => {
          const result = calculateStrictReceiveLimits({
            destAmount: '100',
            effectiveRate: 1.0,
            slippageTolerancePercent: invalidSlippage,
          });
          expect(result.isValid).toBe(false);
          expect(result.code).toBe('INVALID_SLIPPAGE');
        }),
        { numRuns: 50 }
      );

      const zeroDest = calculateStrictReceiveLimits({
        destAmount: '0',
        effectiveRate: 1.0,
      });
      expect(zeroDest.isValid).toBe(false);
      expect(zeroDest.code).toBe('INVALID_AMOUNT');
    });
  });

  // ── 4. Multi-Hop Path & AMM Constant Product Invariants ───────────────────────
  describe('Multi-Hop Path & AMM Constant Product Invariants', () => {
    it('Primary Flow: Multi-hop simulation routes across 1-5 hops preserving positivity and conservation', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<'strict-send' | 'strict-receive'>('strict-send', 'strict-receive'),
          fc.bigInt({ min: 10n * STROOP_SCALE, max: 1_000n * STROOP_SCALE }).map(fromStroops),
          validPathHopsArb(),
          validSlippageArb(),
          (mode, amount, hops, slippage) => {
            const result = simulateMultiHopPathPayment({
              mode,
              amount,
              hops,
              slippageTolerancePercent: slippage,
            });

            if (result.isValid) {
              expect(result.invariantsHold).toBe(true);
              expect(result.hopRecords.length).toBe(hops.length);
              expect(result.finalAmountStroops).toBeGreaterThan(0n);
              expect(result.initialAmountStroops).toBeGreaterThan(0n);

              if (mode === 'strict-send') {
                expect(result.protectedLimitStroops).toBeLessThanOrEqual(result.finalAmountStroops);
              } else {
                expect(result.protectedLimitStroops).toBeGreaterThanOrEqual(
                  result.finalAmountStroops
                );
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('AMM Invariant: Constant product k_new >= k_old is preserved under swaps with non-negative fee', () => {
      fc.assert(
        fc.property(
          validAmmPoolArb(),
          fc.bigInt({ min: 1n * STROOP_SCALE, max: 500n * STROOP_SCALE }),
          (ammHop, tradeStroops) => {
            const result = simulateMultiHopPathPayment({
              mode: 'strict-send',
              amount: fromStroops(tradeStroops),
              hops: [ammHop],
              slippageTolerancePercent: 1.0,
            });

            if (result.isValid) {
              const resA = toStroops(ammHop.reserveA);
              const resB = toStroops(ammHop.reserveB);
              const outputStroops = result.finalAmountStroops;

              // Verify counter reserve was not drained to 0
              expect(outputStroops).toBeLessThan(resB);

              // Verify k_new >= k_old
              const feeBps = BigInt(Math.round((ammHop.feePercent ?? 0.3) * 100));
              const amountWithFee = (tradeStroops * (10000n - feeBps)) / 10000n;
              const kOld = resA * resB;
              const kNew = (resA + amountWithFee) * (resB - outputStroops);
              expect(kNew).toBeGreaterThanOrEqual(kOld);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('No-Free-Lunch Invariant: Round-trip cycle A -> B -> A with positive fees yields < input', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 10n * STROOP_SCALE, max: 500n * STROOP_SCALE }),
          (inputStroops) => {
            const poolAB: AmmPoolHop = {
              type: 'amm',
              reserveA: 1_000_000n * STROOP_SCALE,
              reserveB: 1_000_000n * STROOP_SCALE,
              feePercent: 0.3,
            };
            const poolBA: AmmPoolHop = {
              type: 'amm',
              reserveA: 1_000_000n * STROOP_SCALE,
              reserveB: 1_000_000n * STROOP_SCALE,
              feePercent: 0.3,
            };

            const result = simulateMultiHopPathPayment({
              mode: 'strict-send',
              amount: fromStroops(inputStroops),
              hops: [poolAB, poolBA],
              slippageTolerancePercent: 5.0,
            });

            if (result.isValid) {
              // Value conservation: final output must be strictly less than initial input due to fee deduction
              expect(result.finalAmountStroops).toBeLessThan(inputStroops);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('Protocol Boundary: Path length exceeding MAX_PATH_HOPS (5 hops) is rejected', () => {
      const hops6: PathHop[] = Array(6).fill({
        type: 'orderbook',
        price: 1.0,
      });

      const result = simulateMultiHopPathPayment({
        mode: 'strict-send',
        amount: '10',
        hops: hops6,
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('PATH_TOO_LONG');
    });

    it('Failure Case: Insufficient liquidity when trade exceeds AMM pool counter reserve', () => {
      const tinyPool: AmmPoolHop = {
        type: 'amm',
        reserveA: 100n * STROOP_SCALE,
        reserveB: 100n * STROOP_SCALE,
        feePercent: 0.3,
      };

      const result = simulateMultiHopPathPayment({
        mode: 'strict-receive',
        amount: '200', // Requests 200 from a pool with only 100 reserve
        hops: [tinyPool],
      });

      expect(result.isValid).toBe(false);
      expect(result.code).toBe('INSUFFICIENT_LIQUIDITY');
    });
  });

  // ── 5. Operation Invariant Verification Suite ────────────────────────────────
  describe('Path Payment Operation Invariant Verifier', () => {
    it('verifies valid strict-send and strict-receive operation parameters', () => {
      const validSend = verifyPathPaymentOperationInvariants({
        type: 'pathPaymentStrictSend',
        sendAmount: '10.5',
        destMin: '9.8',
        pathLength: 2,
      });
      expect(validSend.valid).toBe(true);
      expect(validSend.errors.length).toBe(0);

      const validReceive = verifyPathPaymentOperationInvariants({
        type: 'pathPaymentStrictReceive',
        sendMax: '12.0',
        destAmount: '10.0',
        pathLength: 3,
      });
      expect(validReceive.valid).toBe(true);
      expect(validReceive.errors.length).toBe(0);
    });

    it('detects missing fields, invalid amounts, and path length overflow', () => {
      const invalidSend = verifyPathPaymentOperationInvariants({
        type: 'pathPaymentStrictSend',
        sendAmount: '-5',
        destMin: '0',
        pathLength: 6,
      });
      expect(invalidSend.valid).toBe(false);
      expect(invalidSend.errors.length).toBeGreaterThan(0);
    });
  });
});
