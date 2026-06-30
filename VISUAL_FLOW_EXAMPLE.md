# Visual Flow Example

## Transaction Builder Visual Flow

Here's what the visual flow diagram looks like for a multi-operation transaction:

```
┌─────────────────────────────────────────┐
│  SOURCE: GCZJM35N...ABCD1234            │  ← Cyan highlight
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  1. Payment                             │  ← Operation card
│  ✓ Valid                                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  2. Change Trust                        │
│  ⚠ Asset code required                  │  ← Red highlight (error)
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  3. Payment                             │
│  ✓ Valid                                │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  SUBMIT TO NETWORK                      │  ← Green highlight
└─────────────────────────────────────────┘
```

## Operation Card Layout

Each operation card includes:

```
┌────────────────────────────────────────────────────────┐
│  ≡  Operation 1                    [Duplicate] [Remove] │  ← Drag handle + actions
├────────────────────────────────────────────────────────┤
│  ⚠ Validation Errors:                                  │  ← Error banner (if any)
│    • Destination required                              │
│    • Valid amount required                             │
├────────────────────────────────────────────────────────┤
│  Operation Type: [Payment ▼]                           │
│                                                         │
│  Destination: [G... destination address]               │
│  Amount:      [10.5                    ]               │
└────────────────────────────────────────────────────────┘
```

## Simulation Results Panel

```
┌────────────────────────────────────────────────────────┐
│  Simulation Results                                     │
│  Transaction is valid and ready to submit               │
├────────────────────────────────────────────────────────┤
│  ✓ Simulation Successful                               │  ← Green banner
│    Transaction passed all validation checks             │
├────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Estimated Fee│  │  Operations  │  │ Tx Hash      │ │
│  │              │  │              │  │              │ │
│  │   300        │  │      3       │  │ a1b2c3d4...  │ │
│  │ stroops      │  │ 100 per op   │  │              │ │
│  │ 0.0000300 XLM│  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
├────────────────────────────────────────────────────────┤
│  Transaction XDR                        [Show] [Hide]  │
│  ┌────────────────────────────────────────────────────┐│
│  │ AAAAAgAAAABnYW1lc3RhcnRlcgAAAAAAAAAAAAAAAAAAAA...││
│  │ ...                                                ││
│  └────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

## Quick Start Templates

```
┌──────────────────────────────────────────────────────────────┐
│  Quick Start Templates                                        │
│  Load pre-configured operation sequences                      │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ ⚡ Simple     │  │ ⚡ Trustline  │  │ ⚡ Account    │       │
│  │   Payment    │  │   Setup      │  │   Creation   │       │
│  │              │  │              │  │              │       │
│  │ Send XLM to  │  │ Establish    │  │ Create and   │       │
│  │ another      │  │ trust for a  │  │ fund a new   │       │
│  │ account      │  │ new asset    │  │ account      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────┐                                            │
│  │ ⚡ Multi-     │                                            │
│  │   Payment    │                                            │
│  │              │                                            │
│  │ Send to      │                                            │
│  │ multiple     │                                            │
│  │ recipients   │                                            │
│  └──────────────┘                                            │
└──────────────────────────────────────────────────────────────┘
```

## Color Coding

- **Cyan** (`var(--cyan)`): Primary actions, valid states, source account
- **Green** (`var(--green)`): Success states, submit button
- **Red** (`var(--red)`): Errors, validation failures
- **Amber** (`var(--amber)`): Warnings, testnet indicator
- **Muted** (`var(--text-muted)`): Secondary text, placeholders

## Interactive Elements

1. **Drag Handle** (≡): Grab and drag to reorder operations
2. **Duplicate Button**: Clone operation with all parameters
3. **Remove Button**: Delete operation (disabled if only one)
4. **Template Cards**: Click to load pre-configured operations
5. **Show/Hide XDR**: Toggle XDR visibility
6. **Simulate Button**: Validate and preview transaction
7. **Export XDR**: Copy transaction XDR to clipboard

## Responsive Behavior

- **Desktop**: 3-4 columns for templates, 2-3 columns for operation fields
- **Tablet**: 2 columns for templates, 2 columns for operation fields
- **Mobile**: 1 column for all elements, stacked vertically

All grids use `repeat(auto-fit, minmax(Xpx, 1fr))` for automatic responsive layout.
