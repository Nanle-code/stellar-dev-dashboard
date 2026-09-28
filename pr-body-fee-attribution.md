## Summary

Implements **Operation-Level Fee Attribution Breakdown** (closes #847)

### New Module: `src/lib/feeAttribution.ts`
- `calculateOperationFeeAttribution()` - Calculate estimated fee per operation type
- `formatFeeAttribution()` - Human-readable breakdown output
- Supports operation weights (payment=1.0, createAccount=1.2, invokeHostFunction=2.0, etc.)
- Supports complexity multipliers (Soroban=2.5x, path payments=1.8x)
- Fee-bump transaction support

### UI Component: `src/components/dashboard/FeeAttributionBreakdown.tsx`
- Summary cards (total fee, base fee, operation count, avg per op)
- Per-operation expandable rows with fee breakdown
- Visual percentage bars
- Fee-bump details section
- Export as text

### Integration
- Added to Builder component for real-time fee estimation
- Exported new functions from stellar.ts

### Testing
- 10 comprehensive tests covering:
  - Primary flow: single and multiple operations
  - Complexity multipliers for Soroban and path payments
  - Fee-bump transaction support
  - Source account attribution
  - Different base fees
  - Formatting output
- Run with: `pnpm test:unit src/lib/__tests__/feeAttribution.test.ts`