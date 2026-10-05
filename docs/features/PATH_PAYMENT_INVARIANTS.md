# Path Payment Invariants & Property Testing Guide

## Overview

Stellar path payments enable multi-asset swaps routed across order books and AMM constant-product liquidity pools ($x \cdot y = k$). To protect users from balance leaks, under-funding, and excessive slippage, the **Path Payment Invariants Engine** (`src/lib/pathPaymentInvariants.ts`) enforces strict mathematical invariants and 7-decimal (stroop) precision rules.

These invariants are continuously asserted via property-based test suites using `fast-check` in `src/lib/__tests__/pathPaymentInvariants.property.test.ts`.

---

## Key Invariants

### 1. Precision & Stroop Quantization Invariant

- **Stroop Scale**: $1 \text{ XLM} = 10^7 \text{ stroops}$ ($0.0000001 \text{ XLM} = 1 \text{ stroop}$).
- **Precision Bound**: All Stellar payment amounts are quantized to $\le 7$ fractional decimal places.
- **Round-Trip Preservation**: For any valid decimal amount string $x$:
  $$\text{fromStroops}(\text{toStroops}(x)) \equiv x$$
- **Integer Stroop Conservation**: All internal calculations use `BigInt` stroop arithmetic to eliminate IEEE-754 floating point drift.

### 2. Strict-Send Conservation Invariant

For `pathPaymentStrictSend`:

- **Fixed Source Amount**: `sendAmount` is constant and strictly positive ($> 0$).
- **Bounded Destination Minimum**: `destMin` must never exceed expected output:
  $$\text{destMin} \le \text{expectedDestAmount}$$
- **Floor Rounding**: `destMin` is rounded down to the nearest stroop to guarantee that the recipient receives _at least_ `destMin`.
- **Slippage Monotonicity**: As slippage tolerance $\epsilon \in [0\%, 50\%]$ increases, `destMin` is monotonically non-increasing:
  $$\epsilon_1 \le \epsilon_2 \implies \text{destMin}(\epsilon_1) \ge \text{destMin}(\epsilon_2)$$

### 3. Strict-Receive Conservation Invariant

For `pathPaymentStrictReceive`:

- **Fixed Destination Amount**: `destAmount` is constant and strictly positive ($> 0$).
- **Bounded Source Maximum**: `sendMax` must provide sufficient headroom:
  $$\text{sendMax} \ge \text{expectedSourceAmount}$$
- **Ceiling Rounding**: `sendMax` is rounded up to the nearest stroop to guarantee the sender will not fail due to sub-stroop deficits.
- **Slippage Monotonicity**: As slippage tolerance $\epsilon \in [0\%, 50\%]$ increases, `sendMax` is monotonically non-decreasing:
  $$\epsilon_1 \le \epsilon_2 \implies \text{sendMax}(\epsilon_1) \le \text{sendMax}(\epsilon_2)$$

### 4. AMM Constant-Product ($x \cdot y = k$) Invariant

For any liquidity pool swap with reserve $R_A, R_B$ and fee $f \in [0, 1)$:

- **Invariant Preservation**:
  $$(R_A + \Delta A \cdot (1 - f)) \cdot (R_B - \Delta B) \ge R_A \cdot R_B$$
- **Reserve Depletion Protection**: An output swap $\Delta B$ cannot exhaust the counter reserve ($\Delta B < R_B$).
- **No-Free-Lunch / Value Conservation**: In any cyclic path $A \to B \to A$ with swap fee $f > 0$, the final output is strictly less than initial input:
  $$\text{Output}_{A} < \text{Input}_{A}$$

### 5. Multi-Hop Path Bound

- **Protocol Limit**: Stellar enforces a maximum of **5 intermediate asset hops** (`MAX_PATH_HOPS = 5`). Paths exceeding 5 hops are rejected before submission (`PATH_TOO_LONG`).

---

## API & Usage

```typescript
import {
  calculateStrictSendLimits,
  calculateStrictReceiveLimits,
  simulateMultiHopPathPayment,
  toStroops,
  fromStroops,
  verifyPathPaymentOperationInvariants,
} from '@/lib/pathPaymentInvariants';

// 1. Calculate strict-send limits with slippage protection
const sendLimits = calculateStrictSendLimits({
  sendAmount: '100.50',
  effectiveRate: 1.25, // 1 source = 1.25 destination
  slippageTolerancePercent: 0.5,
});

if (sendLimits.isValid) {
  console.log('Expected Dest:', sendLimits.expectedDestAmount); // "125.625"
  console.log('Protected Min:', sendLimits.destMin); // "124.996875"
}

// 2. Calculate strict-receive limits
const receiveLimits = calculateStrictReceiveLimits({
  destAmount: '50.00',
  effectiveRate: 2.0, // 1 source = 2.0 destination
  slippageTolerancePercent: 1.0,
});

if (receiveLimits.isValid) {
  console.log('Expected Source:', receiveLimits.expectedSourceAmount); // "25"
  console.log('Protected Max:', receiveLimits.sendMax); // "25.25"
}

// 3. Simulate multi-hop routing across AMM pools and order books
const simResult = simulateMultiHopPathPayment({
  mode: 'strict-send',
  amount: '10',
  hops: [
    { type: 'amm', reserveA: '10000', reserveB: '20000', feePercent: 0.3 },
    { type: 'orderbook', price: 0.98 },
  ],
  slippageTolerancePercent: 0.5,
});
```

---

## Property-Based Testing

Run the dedicated property test suite:

```bash
pnpm test src/lib/__tests__/pathPaymentInvariants.property.test.ts
```

The property tests verify hundreds of randomized permutations across:

1. **Primary flows**: Exact stroop round-trips, strict-send/receive conservation, and multi-hop routing.
2. **Boundary cases**: $1 \text{ stroop}$ (`0.0000001`), `MAX_INT64_STROOPS`, $0\%$ slippage, and $5\text{-hop}$ paths.
3. **Failure paths**: Negative amounts, NaN/Infinity, $> 7$ decimal places without rounding, $> 50\%$ slippage, depleted pools, and $> 5$ hops.

---

## Security, Compatibility & Migration Notes

- **Stroop Precision**: Never format Stellar amounts with scientific notation or $> 7$ decimals. Use `fromStroops(toStroops(val))` to ensure canonical formatting.
- **Rounding Direction**: Always use **floor** rounding for `destMin` (receive) and **ceil** rounding for `sendMax` (send).
- **Front-running / Sandwich Mitigation**: Keep slippage tolerance tight ($\le 1.0\%$ for liquid pairs, $\le 3.0\%$ for volatile pairs) to ensure `destMin` and `sendMax` guard against sandwich attacks in the transaction queue.
- **Migration Note**: Any legacy code passing floating point amounts directly should migrate to `calculateStrictSendLimits` or `calculateStrictReceiveLimits` to ensure invariant safety.
