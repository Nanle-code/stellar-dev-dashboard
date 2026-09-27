# Soroban Interactive Debugging Tutorial Series

## Overview

The **Soroban Interactive Debugging Tutorial Series** is a hands-on, progressive developer education experience integrated directly into the Stellar Developer Dashboard. It equips developers with practical skills to diagnose and resolve the three most common classes of Soroban smart contract failures:

1. **Simulation Errors & Host Execution Traps**: WASM unreachable traps, unchecked integer overflows, nil pointer/storage panics, and transaction CPU/memory budget exhaustion.
2. **Declarative Authorization Failures**: Missing caller `require_auth()`, argument tampering prevention via `require_auth_for_args()`, and sub-contract authorization invocation trees.
3. **Ledger Footprints, Concurrency & State Archival**: Concurrency violations from modifying `readOnly` footprint keys, state expiration and Time-To-Live (TTL) bump operations, and storage tier isolation (`Temporary` vs. `Persistent` vs. `Instance`).

---

## Architectural Design

The educational system consists of three coordinated layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 In-App Education & UI                       │
│  - SorobanDebugTutorial.tsx (Interactive IDE & Runner)     │
│  - LearningHub.tsx (Tutorial Catalog & Knowledge Quizzes)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│             Tutorial Engine & Validation Layer              │
│  - sorobanDebuggingTutorial.ts                              │
│    ├── Environment Safety Guard (Mainnet Block / Sandbox)   │
│    ├── Input Schema Validators (Contract IDs, Limits)       │
│    ├── Simulation Evaluator (CPU Meter, Diagnostic Logs)    │
│    └── Step Progression & Quiz Grading Engine               │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           Documentation & Developer Guidance                │
│  - docs/SOROBAN_DEBUGGING_GUIDE.md                          │
│  - docs/features/soroban-debugging-tutorials.md             │
└─────────────────────────────────────────────────────────────┘
```

---

## Curriculum & Progressive Modules

### Module 1: Simulation Errors & Host Execution Traps
- **Slug**: `simulation-errors`
- **Difficulty**: Beginner (Est. 20 min)
- **Key Concepts**:
  - Pre-flight simulation via `simulateTransaction` RPC endpoint.
  - `InvokeHostFunctionResultCodeTrapped`: Rust panics, division by zero, and integer overflows.
  - Transaction CPU instruction limits (default 100,000,000 instructions) and memory budget caps.
  - Safe Rust arithmetic (`checked_add`, `checked_mul`, `checked_div`).
  - Handling missing ledger data without blind `.unwrap()`.

### Module 2: Declarative Authorization & Auth Trees
- **Slug**: `auth-failures`
- **Difficulty**: Intermediate (Est. 25 min)
- **Key Concepts**:
  - `InvokeHostFunctionResultCodeAuthorizationError`.
  - Enforcing account debit approval with `Address::require_auth()`.
  - Scoped authorization with `Address::require_auth_for_args()` to prevent front-running parameter manipulation.
  - Cross-contract authorization hierarchies and sub-invocation trees.

### Module 3: Ledger Footprints, State Archival & Storage Isolation
- **Slug**: `footprint-issues`
- **Difficulty**: Advanced (Est. 30 min)
- **Key Concepts**:
  - Concurrency guarantees via declarative `LedgerFootprint` (`readOnly` vs. `readWrite`).
  - `FootprintConflictError`: modifying a key declared as read-only.
  - State retention policies, entry archival, and `extend_ttl` operations.
  - Choosing appropriate storage tiers: `Persistent` (restorable user assets), `Temporary` (pruned cache, non-restorable), and `Instance` (contract parameters).

---

## Environment Safety Policy & Guards

To prevent accidental simulation against production funds or unintended execution on live networks, the tutorial engine enforces strict environment isolation:

```typescript
import { assertTutorialEnvironment } from '../../lib/sorobanDebuggingTutorial';

// Fails closed if invoked against Mainnet without explicit override
assertTutorialEnvironment('mainnet'); 
// => Throws SorobanTutorialError: UNSUPPORTED_ENVIRONMENT
```

### Supported Environments
| Environment | Status | Execution Mode |
|---|---|---|
| `testnet` | Supported | Safe Live & Mock Simulation |
| `futurenet` | Supported | Protocol Preview Simulation |
| `local` / `standalone` | Supported | Local Container RPC |
| `sandbox` | Supported (Default) | In-Memory Deterministic VM |
| `mainnet` | Guarded | Blocked unless `allowMainnetSimulation: true` override is explicitly passed |

---

## Error Handling & Failure Paths

All failure conditions are strictly typed and return normalized diagnostic models:

| Error Code | Trigger Condition | Remediation Guidance |
|---|---|---|
| `INVALID_INPUT` | Missing module ID, non-positive step number, empty code, or invalid contract ID format | Verify request payload parameters |
| `UNSUPPORTED_ENVIRONMENT` | Attempted execution against Mainnet without sandboxed override | Switch network selector to Testnet or Futurenet |
| `SIMULATION_FAILED` | Code triggers WASM trap, unchecked arithmetic overflow, or CPU budget exhaustion | Apply checked arithmetic and bounded loops |
| `AUTH_VERIFICATION_FAILED` | Missing `require_auth()` signature or unauthorized debit | Add `from.require_auth()` before state modification |
| `FOOTPRINT_VIOLATION` | Modifying `readOnly` ledger key or accessing expired TTL entry | Add key to `readWrite` footprint or bump TTL |
| `STEP_NOT_FOUND` | Step number out of module boundary | Request valid step within module range |
| `QUIZ_NOT_FOUND` | Invalid module slug submitted to quiz evaluator | Submit answers to valid module |

---

## Security Considerations

1. **Zero Key Exposure**: Interactive simulation does not request or store private keys. Account addresses are synthetic or read-only public keys.
2. **Deterministic Sandboxing**: The simulation engine executes code against isolated memory models, preventing state pollution.
3. **Bounded Resource Quotas**: Simulated CPU limits prevent denial-of-service or browser freezing during evaluation of student code.

---

## Developer Integration & Extending Modules

To add a new tutorial module to the catalog, register it in `SOROBAN_TUTORIAL_MODULES` in `src/lib/sorobanDebuggingTutorial.ts`:

```typescript
export const NEW_MODULE: SorobanTutorialModule = {
  id: 'soroban-events-1',
  slug: 'contract-events',
  title: 'Debugging Contract Events & Topics',
  subtitle: 'Inspect contract event emission and indexable topics',
  category: 'simulation',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  overview: 'Learn how to verify event topics and data payloads during simulation.',
  prerequisites: ['Basic Soroban events'],
  steps: [ /* ... */ ],
  quiz: [ /* ... */ ],
};
```
