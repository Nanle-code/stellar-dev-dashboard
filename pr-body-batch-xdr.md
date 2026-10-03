## Summary

Implements **Batch XDR Import with Per-Item Validation Reports** (closes #857)

### New Module: `src/lib/batchXdrImport.ts`
- `importBatchXdr()` - Import and validate multiple XDR transaction envelopes
- `simulateBatchXdr()` - Simulate batch of transactions to estimate fees
- `validateXdrForBroadcast()` - Check if transaction is ready for broadcast

### UI Component: `src/components/dashboard/BatchXdrImport.tsx`
- Add multiple XDR inputs with labels
- Per-item validation with expandable details (envelope hash, operations, signatures, warnings)
- Broadcast readiness checks
- Export validation reports as JSON
- Copy valid XDRs

### Integration
- Added `batchXdrImport` tab to sidebar (under BUILD section)
- Registered route in DashboardLayout.tsx
- Exported new functions from stellar.ts

### Testing
- 15 comprehensive tests covering:
  - Primary flow: valid standard and fee-bump transactions
  - Boundary cases: empty XDRs, max items limit, skip empty
  - Failure cases: invalid XDR, unsigned transactions, zero operations
- Run with: `pnpm test:unit src/lib/__tests__/batchXdrImport.test.ts`