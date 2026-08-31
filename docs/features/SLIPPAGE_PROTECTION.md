# Slippage Protection & Price Impact Engine

## Overview

The **Slippage Protection & Price Impact Engine** calculates exact price impact across Stellar order book depth levels and AMM constant-product liquidity pools ($x \cdot y = k$). It enforces user-selected slippage tolerance levels (`0.1%`, `0.5%`, `1.0%`, `3.0%`, or custom inputs) before trades and path payment operations are constructed or submitted.

## Key Architecture

### 1. Calculation Engine (`src/lib/slippageProtection.ts`)
- **Spot Price**: Initial market exchange rate derived from top orderbook level (bid[0]/ask[0]) or AMM pool reserve ratio ($R_{buying} / R_{selling}$).
- **Execution Price**: Weighted average fill price across full order book depth or pool reserves required for requested amount $N$.
- **Price Impact (%)**: 
  $$\text{Price Impact (\%)} = \frac{|\text{Spot Price} - \text{Execution Price}|}{\text{Spot Price}} \times 100\%$$
- **Minimum Received / Maximum Sent**:
  - For **Sell / Strict Send**: $\text{Min Received} = \text{Expected Output} \times (1 - \frac{\text{Slippage \%}}{100})$
  - For **Buy / Strict Receive**: $\text{Max Sent} = \text{Amount} \times (1 + \frac{\text{Slippage \%}}{100})$

### 2. Trade Enforcement & Safety Safeguards
- **Slippage Tolerance Enforcement**: If calculated `priceImpactPercent` exceeds user-selected tolerance (e.g. `0.5%`), trade construction is blocked (`isValid: false`) with descriptive alert details.
- **Liquidity Guard**: Fails gracefully if requested trade amount exceeds available orderbook depth or AMM pool reserves.
- **Invalid Input Resilience**: Validates non-numeric, negative, zero, and missing parameter inputs without throwing unhandled exceptions.

### 3. UI Component (`src/components/dashboard/SlippageTradePanel.tsx`)
Integrated into `DEXExplorer`:
- Live spot price, execution price, and price impact display with color badges (Cyan = Low risk <1%, Amber = Medium risk 1-3%, Red = Critical >3%).
- Preset slippage tolerance buttons (`0.1%`, `0.5%`, `1.0%`, `3.0%`) and custom numeric input.
- Real-time warning alert banner and disabled action button when protection thresholds are violated.

## Integration & API Usage

```typescript
import { calculatePriceImpactAndSlippage, enforceSlippageProtectionOrThrow } from '@/lib/slippageProtection'

// 1. Calculate price impact and minimum received
const calculation = calculatePriceImpactAndSlippage({
  tradeType: 'sell',
  amount: 100,
  orderbook: { bids: [...], asks: [...] },
  slippageTolerancePercent: 0.5,
})

if (calculation.isValid) {
  console.log('Minimum Received:', calculation.minimumReceived)
} else {
  console.error('Trade Blocked:', calculation.error)
}

// 2. Enforce slippage before building path payments
enforceSlippageProtectionOrThrow({
  tradeType: 'sell',
  amount: 100,
  orderbook: myOrderbook,
  slippageTolerancePercent: 0.5,
})
```

## Security & Compatibility Notes
- **Path Payment Operations**: Always populate `destMin` (for `pathPaymentStrictSend`) or `sendMax` (for `pathPaymentStrictReceive`) using minimum received / maximum sent limits calculated by this engine.
- **Frontrunning & Sandwich Protection**: Enforcing tight minimum receive bounds protects transactions from unexpected pool ratio shifts between transaction creation and ledger execution.
