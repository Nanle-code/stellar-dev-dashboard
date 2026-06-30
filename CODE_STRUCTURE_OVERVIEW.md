# Transaction Builder Code Structure

## Component Architecture

```
TransactionBuilder (Main Component)
├── State Management
│   ├── sourceAccount
│   ├── memo, memoType
│   ├── baseFee, timeout
│   ├── operations[] (with unique IDs)
│   ├── simulation
│   ├── isSimulating
│   ├── showXDR
│   └── draggedIndex
│
├── Computed Values
│   ├── validationErrors (memoized)
│   └── canSimulate (derived)
│
├── Event Handlers
│   ├── addOperation()
│   ├── removeOperation(id)
│   ├── updateOperation(id, field, value)
│   ├── duplicateOperation(id)
│   ├── loadTemplate(key)
│   ├── handleDragStart(index)
│   ├── handleDragOver(e, index)
│   ├── handleDragEnd()
│   ├── handleSimulate()
│   └── handleExportXDR()
│
└── Render Functions
    ├── renderOperationFields(op)
    └── Main render (JSX)
```

## Data Flow

```
User Action
    ↓
Event Handler
    ↓
State Update (setOperations, etc.)
    ↓
Validation (useMemo)
    ↓
Re-render with updated UI
    ↓
Visual Flow Diagram Updates
```

## Operation Object Structure

```javascript
{
  id: 1714392847123,           // Unique timestamp ID
  type: "payment",             // Operation type
  params: {                    // Type-specific parameters
    destination: "GCZJM...",
    amount: "100",
    assetType: "native"
  }
}
```

## Validation Error Structure

```javascript
{
  [operationId]: [             // Keyed by operation ID
    "Destination required",
    "Valid amount required"
  ]
}
```

## Simulation Result Structure

```javascript
{
  success: true,               // Overall validation status
  errors: [],                  // Array of error messages
  fee: 300,                    // Total fee in stroops
  operationCount: 3,           // Number of operations
  xdr: "AAAAAgAAAA...",        // Transaction XDR
  hash: "a1b2c3d4..."          // Transaction hash
}
```

## Template Structure

```javascript
{
  name: "Simple Payment",
  description: "Send XLM to another account",
  operations: [
    {
      type: "payment",
      params: {
        destination: "",
        amount: "",
        assetType: "native"
      }
    }
  ]
}
```

## Key Functions

### addOperation()
```javascript
function addOperation() {
  setOperations([
    ...operations,
    {
      id: Date.now(),
      type: "payment",
      params: { destination: "", amount: "", assetType: "native" }
    }
  ]);
}
```

### updateOperation()
```javascript
function updateOperation(id, field, value) {
  const updated = operations.map(op => {
    if (op.id !== id) return op;
    if (field === "type") {
      return { ...op, type: value, params: {} };
    }
    return { ...op, params: { ...op.params, [field]: value } };
  });
  setOperations(updated);
}
```

### handleDragOver()
```javascript
function handleDragOver(e, index) {
  e.preventDefault();
  if (draggedIndex === null || draggedIndex === index) return;
  
  const updated = [...operations];
  const draggedOp = updated[draggedIndex];
  updated.splice(draggedIndex, 1);
  updated.splice(index, 0, draggedOp);
  setOperations(updated);
  setDraggedIndex(index);
}
```

### handleSimulate()
```javascript
async function handleSimulate() {
  if (!canSimulate) return;
  
  setIsSimulating(true);
  setSimulation(null);
  
  try {
    const result = await simulateTransaction({
      sourceAccount,
      operations: operations.map(({ id, ...op }) => op),
      memo,
      memoType,
      baseFee: parseInt(baseFee),
      timeout: parseInt(timeout),
      network
    });
    setSimulation(result);
  } catch (error) {
    setSimulation({
      success: false,
      errors: [error.message],
      fee: 0,
      operationCount: operations.length
    });
  } finally {
    setIsSimulating(false);
  }
}
```

## UI Component Hierarchy

```
<div className="animate-in">
  ├── Header
  │   ├── Title + Description
  │   └── Network Badge
  │
  ├── Quick Start Templates Panel
  │   └── Template Cards (4)
  │
  ├── Transaction Settings Panel
  │   ├── Source Account
  │   ├── Base Fee
  │   ├── Timeout
  │   ├── Memo Type
  │   └── Memo
  │
  ├── Visual Flow Diagram Panel
  │   ├── Source Account Node
  │   ├── Arrow ↓
  │   ├── Operation Nodes (n)
  │   ├── Arrow ↓
  │   └── Submit Node
  │
  ├── Operations Panel
  │   ├── Operation Cards (n)
  │   │   ├── Drag Handle
  │   │   ├── Operation Number
  │   │   ├── Validation Errors
  │   │   ├── Duplicate Button
  │   │   ├── Remove Button
  │   │   ├── Type Selector
  │   │   └── Parameter Fields
  │   └── Add Operation Button
  │
  ├── Action Buttons
  │   ├── Simulate Transaction
  │   └── Export XDR
  │
  └── Simulation Results Panel (conditional)
      ├── Status Banner
      ├── Fee Breakdown Cards
      ├── Validation Errors
      └── XDR Preview (collapsible)
</div>
```

## Styling Pattern

All styles use inline objects with CSS custom properties:

```javascript
style={{
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "18px",
  color: "var(--text-primary)",
  fontSize: "13px",
  fontFamily: "var(--font-mono)",
  transition: "var(--transition)"
}}
```

## Responsive Grid Pattern

```javascript
style={{
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px"
}}
```

## Hover Effect Pattern

```javascript
onMouseEnter={e => {
  e.currentTarget.style.borderColor = "var(--cyan-dim)";
  e.currentTarget.style.background = "var(--bg-hover)";
}}
onMouseLeave={e => {
  e.currentTarget.style.borderColor = "var(--border)";
  e.currentTarget.style.background = "var(--bg-elevated)";
}}
```

## Integration Points

### With Zustand Store
```javascript
const { connectedAddress, network } = useStore();
```

### With transactionBuilder.js
```javascript
import { 
  OPERATION_TYPES, 
  simulateTransaction, 
  buildTransaction 
} from "../../lib/transactionBuilder";
```

### With Lucide Icons
```javascript
import { 
  Copy, Play, Download, AlertCircle, CheckCircle, 
  ArrowDown, GripVertical, Trash2, Plus, Zap 
} from "lucide-react";
```

## Performance Optimizations

1. **Memoized Validation**: `useMemo` prevents unnecessary recalculation
2. **Unique IDs**: Stable keys for React reconciliation
3. **Conditional Rendering**: Simulation panel only renders when needed
4. **Debounced Updates**: State updates batched by React
5. **Minimal Re-renders**: Only affected components re-render

## Error Handling

```javascript
try {
  // Attempt operation
  const result = await simulateTransaction(...);
  setSimulation(result);
} catch (error) {
  // Graceful fallback
  setSimulation({
    success: false,
    errors: [error.message],
    fee: 0,
    operationCount: operations.length
  });
} finally {
  // Always cleanup
  setIsSimulating(false);
}
```

## Accessibility Considerations

- Semantic HTML elements
- Keyboard navigation support (native drag/drop)
- Disabled states clearly indicated
- Error messages associated with fields
- Loading states announced
- Focus management on interactions

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- HTML5 Drag and Drop API
- CSS Grid and Flexbox
- ES6+ JavaScript features
- Clipboard API for XDR export
