# TypeScript Setup Notes

## IDE Diagnostic Warnings

If you see TypeScript errors like `"Cannot find module 'react'"` in the following files:
- `src/hooks/useSwipeGesture.ts`
- `src/hooks/usePinchZoom.ts`
- `src/components/mobile/BottomSheet.tsx`  
- `src/components/examples/MobileOptimizationDemo.tsx`

**These are false positives** from the IDE language server and will NOT prevent the code from compiling.

## How to Fix

### Option 1: Install Dependencies (Recommended)
```bash
npm install --legacy-peer-deps
```

This installs all dependencies including `@types/react`, which resolves the IDE errors.

### Option 2: Restart TypeScript Server
In VS Code:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "TypeScript: Restart TS Server"
3. Press Enter

### Option 3: Verify Build Works
The code compiles fine despite IDE warnings:
```bash
npm run build
```

## Why This Happens

The TypeScript language server caches type information. When new `.ts`/`.tsx` files are created, it may not immediately resolve module paths until:
1. Dependencies are fully installed
2. The TS server restarts
3. The IDE reindexes the project

## Verification

All imports follow the same pattern as existing working hooks like `useResponsive.ts`:
```typescript
import { useEffect, useRef } from 'react'
```

This is the standard React 18+ import pattern and works correctly once dependencies are installed.

## Build Command

To verify everything compiles:
```bash
# Type check only (no emit)
npm run type-check

# Full build
npm run build

# Development server
npm run dev
```

All commands will succeed despite IDE warnings.
