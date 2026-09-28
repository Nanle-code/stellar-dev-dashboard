## Summary

Implements two features:

### 1. Batch XDR Import with Per-Item Validation Reports (closes #857)
- **New module**: `src/lib/batchXdrImport.ts`
  - `importBatchXdr()` - Import and validate multiple XDR transaction envelopes
  - `simulateBatchXdr()` - Simulate batch of transactions to estimate fees
  - `validateXdrForBroadcast()` - Check if transaction is ready for broadcast
- **UI Component**: `src/components/dashboard/BatchXdrImport.tsx`
  - Add multiple XDR inputs with labels
  - Per-item validation with expandable details (envelope hash, operations, signatures, warnings)
  - Broadcast readiness checks
  - Export validation reports as JSON
  - Copy valid XDRs
- **Tests**: 15 tests covering primary flow, boundary cases (empty, max items), failure cases (invalid XDR, unsigned)

### 2. Operation-Level Fee Attribution Breakdown (closes #847)
- **New module**: `src/lib/feeAttribution.ts`
  - `calculateOperationFeeAttribution()` - Calculate estimated fee per operation type
  - `formatFeeAttribution()` - Human-readable breakdown output
  - Supports operation weights (payment=1.0, createAccount=1.2, invokeHostFunction=2.0, etc.)
  - Supports complexity multipliers (Soroban=2.5x, path payments=1.8x)
  - Fee-bump transaction support
- **UI Component**: `src/components/dashboard/FeeAttributionBreakdown.tsx`
  - Summary cards (total fee, base fee, operation count, avg per op)
  - Per-operation expandable rows with fee breakdown
  - Visual percentage bars
  - Fee-bump details section
  - Export as text
- **Integration**: Added to Builder component for real-time fee estimation
- **Tests**: 10 tests covering primary flow, multiple operations, complexity multipliers, fee-bump, source accounts, formatting

### Integration
- Added `batchXdrImport` tab to sidebar (under BUILD section)
- Registered route in DashboardLayout.tsx
- Exported new functions from stellar.ts

### Testing
- All new tests pass (25 tests total)
- Run with: `pnpm test:unit src/lib/__tests__/batchXdrImport.test.ts src/lib/__tests__/feeAttribution.test.ts`