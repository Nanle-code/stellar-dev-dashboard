# Portfolio Analytics Dashboard - Visual Example

## Component Overview

The Portfolio Analytics Dashboard provides comprehensive portfolio analysis through four specialized views accessible via tabs.

## View 1: Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Portfolio Analytics                    Comprehensive analysis   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [💰 Overview] [📊 Allocation] [📈 Performance] [⚠️ Risk]      │
│  ─────────────                                                  │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ TOTAL    │  │ 24H      │  │ DIVERSIF │  │ RISK     │      │
│  │ VALUE    │  │ CHANGE   │  │ ICATION  │  │ LEVEL    │      │
│  │          │  │          │  │          │  │          │      │
│  │ $12,450  │  │ +2.34%   │  │ 7.2/10   │  │ Medium   │      │
│  │          │  │ Gain     │  │ Well div │  │ 5.1/10   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Asset Holdings                                          │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ ASSET    BALANCE      PRICE       VALUE        24H     │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ XLM      10,000.00    $0.1245     $1,245.00    ↑ 2.5% │  │
│  │ USDC     5,000.00     $1.0000     $5,000.00    ↑ 0.1% │  │
│  │ AQUA     50,000.00    $0.0850     $4,250.00    ↑ 5.2% │  │
│  │ BTC      0.0500       $45,000     $2,250.00    ↓ 1.8% │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- 4 key metric cards with color-coded accents
- Comprehensive asset holdings table
- Real-time price data
- 24h change indicators with trend arrows

## View 2: Allocation

```
┌─────────────────────────────────────────────────────────────────┐
│ Portfolio Analytics                    Comprehensive analysis   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Overview] [📊 Allocation] [ Performance] [ Risk]            │
│              ───────────────                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Asset Allocation                                        │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │      ╭─────────╮          ┌─────────────────────┐     │  │
│  │     ╱  USDC    ╲         │ ■ XLM    10.0%      │     │  │
│  │    │   40.2%    │         │   $1,245.00         │     │  │
│  │    │            │         ├─────────────────────┤     │  │
│  │  XLM╲          ╱AQUA      │ ■ USDC   40.2%      │     │  │
│  │  10% ╲        ╱ 34.1%     │   $5,000.00         │     │  │
│  │       ╲      ╱            ├─────────────────────┤     │  │
│  │        ╲    ╱             │ ■ AQUA   34.1%      │     │  │
│  │         ╲  ╱              │   $4,250.00         │     │  │
│  │      BTC ╲╱               ├─────────────────────┤     │  │
│  │       15.7%               │ ■ BTC    15.7%      │     │  │
│  │                           │   $2,250.00         │     │  │
│  │                           └─────────────────────┘     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Concentration Risks                                     │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ ⚠️  USDC                                        40.2%   │  │
│  │     High concentration - consider diversifying          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Interactive pie chart with percentage labels
- Color-coded asset legend with USD values
- Concentration risk warnings (>40% threshold)
- Visual distribution analysis

## View 3: Performance

```
┌─────────────────────────────────────────────────────────────────┐
│ Portfolio Analytics                    Comprehensive analysis   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Overview] [ Allocation] [📈 Performance] [ Risk]            │
│                            ───────────────                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Portfolio Value (30 Days)                               │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  $13k ┤                                    ╭─╮          │  │
│  │       │                          ╭────╮  ╱   ╲         │  │
│  │  $12k ┤                    ╭────╯    ╰─╯     ╰─╮      │  │
│  │       │              ╭────╯                     ╰─╮    │  │
│  │  $11k ┤        ╭────╯                            ╰─   │  │
│  │       │  ╭────╯                                       │  │
│  │  $10k ┤─╯                                            │  │
│  │       └──┬────┬────┬────┬────┬────┬────┬────┬────┬──  │  │
│  │         Day1  5    10   15   20   25   30           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 24h Asset Performance                                   │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  AQUA  ████████████████████ +5.2%                      │  │
│  │  XLM   ██████████ +2.5%                                │  │
│  │  USDC  ██ +0.1%                                        │  │
│  │  BTC   ███ -1.8%                                       │  │
│  │        └────┬────┬────┬────┬────┬────┬────┬────┬───   │  │
│  │           -5%   0%   5%   10%  15%  20%  25%          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- 30-day historical performance line chart
- 24-hour asset performance bar chart
- Color-coded bars (green for gains, red for losses)
- Sorted by performance (best to worst)

## View 4: Risk

```
┌─────────────────────────────────────────────────────────────────┐
│ Portfolio Analytics                    Comprehensive analysis   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Overview] [ Allocation] [ Performance] [⚠️ Risk]            │
│                                           ────────              │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ RISK     │  │ DIVERSIF │  │ VOLATIL  │                    │
│  │ LEVEL    │  │ ICATION  │  │ ITY      │                    │
│  │          │  │          │  │          │                    │
│  │ Medium   │  │ 7.2/10   │  │ 8.45%    │                    │
│  │ 5.1/10   │  │ Well div │  │ Moderate │                    │
│  └──────────┘  └──────────┘  └──────────┘                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Risk Assessment                                         │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  Concentration Risk                                     │  │
│  │  Single asset (USDC) represents 40.2% of portfolio     │  │
│  │                                                         │  │
│  │  Market Volatility                                      │  │
│  │  Portfolio shows moderate volatility (8.45%)           │  │
│  │                                                         │  │
│  │  Diversification                                        │  │
│  │  Portfolio is well diversified across 4 assets         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Recommendations                                         │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │                                                         │  │
│  │  🎯 Consider rebalancing USDC to reduce concentration  │  │
│  │                                                         │  │
│  │  🎯 Add more stable assets to reduce volatility        │  │
│  │                                                         │  │
│  │  🎯 Current diversification is good, maintain balance  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- 3 risk metric cards
- Detailed risk factor analysis
- Personalized recommendations
- Risk level classification

## Data Flow Diagram

```
┌─────────────────┐
│ Account Data    │
│ (Balances)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Extract Asset   │─────▶│ Fetch Prices    │
│ Codes           │      │ (CoinGecko API) │
└─────────────────┘      └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ Store Prices    │
                         │ (Zustand)       │
                         └────────┬────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                  │
         ▼                                                  ▼
┌─────────────────┐                              ┌─────────────────┐
│ Calculate       │                              │ Calculate       │
│ Portfolio Value │                              │ Analytics       │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │  • Total USD value                            │  • Allocation
         │  • Item breakdown                             │  • Diversification
         │  • 24h changes                                │  • Risk assessment
         │                                                │  • Performance
         │                                                │  • Volatility
         │                                                │
         └────────────────────┬───────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ Render Active   │
                     │ View Component  │
                     └─────────────────┘
```

## Analytics Calculations

### Asset Allocation
```javascript
// Input: Portfolio items with USD values
[
  { code: 'XLM', valueUsd: 1245.00 },
  { code: 'USDC', valueUsd: 5000.00 },
  { code: 'AQUA', valueUsd: 4250.00 },
  { code: 'BTC', valueUsd: 2250.00 }
]

// Output: Allocation percentages
[
  { asset: 'XLM', percentage: 10.0, valueUsd: 1245.00 },
  { asset: 'USDC', percentage: 40.2, valueUsd: 5000.00 },
  { asset: 'AQUA', percentage: 34.1, valueUsd: 4250.00 },
  { asset: 'BTC', percentage: 15.7, valueUsd: 2250.00 }
]
```

### Diversification Score
```javascript
// Calculation factors:
// 1. Number of assets (more = better)
// 2. Distribution evenness (Herfindahl index)
// 3. Concentration penalties

// Example:
// 4 assets, relatively even distribution
// Score: 7.2/10 (Well diversified)
```

### Risk Assessment
```javascript
// Multi-factor scoring:
{
  level: 'Medium',           // Low/Medium/High
  score: 5.1,                // 0-10 scale
  factors: [
    {
      name: 'Concentration Risk',
      description: 'Single asset represents 40.2% of portfolio'
    },
    {
      name: 'Market Volatility',
      description: 'Portfolio shows moderate volatility (8.45%)'
    },
    {
      name: 'Diversification',
      description: 'Portfolio is well diversified across 4 assets'
    }
  ],
  recommendations: [
    'Consider rebalancing USDC to reduce concentration',
    'Add more stable assets to reduce volatility'
  ]
}
```

## Color Coding System

```
Chart Colors (8-color palette):
┌────┬────┬────┬────┬────┬────┬────┬────┐
│ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │
├────┼────┼────┼────┼────┼────┼────┼────┤
│ 🔵 │ 🟢 │ 🔴 │ 🟡 │ 🟣 │ 🟠 │ 🌸 │ 🔷 │
│Cyan│Grn │Red │Yel │Pur │Org │Pink│Teal│
└────┴────┴────┴────┴────┴────┴────┴────┘

Performance Indicators:
• Green (🟢): Positive change, gains
• Red (🔴): Negative change, losses
• Cyan (🔵): Neutral, primary accent

Risk Levels:
• Green (🟢): Low risk (0-3.5)
• Yellow (🟡): Medium risk (3.5-7)
• Red (🔴): High risk (7-10)
```

## Responsive Behavior

```
Desktop (>1200px):
┌─────────────────────────────────────────┐
│ [Metric] [Metric] [Metric] [Metric]    │  4 columns
│ [Chart ──────────] [Legend ──────]     │  2 columns
└─────────────────────────────────────────┘

Tablet (768px-1200px):
┌─────────────────────────────────┐
│ [Metric] [Metric]               │  2 columns
│ [Metric] [Metric]               │
│ [Chart ──────────────────]      │  Full width
│ [Legend ─────────────────]      │
└─────────────────────────────────┘

Mobile (<768px):
┌─────────────────┐
│ [Metric]        │  1 column
│ [Metric]        │
│ [Metric]        │
│ [Metric]        │
│ [Chart ───────] │  Full width
│ [Legend ──────] │
└─────────────────┘
```

## User Interactions

1. **Tab Switching**: Click any tab to switch views
2. **Hover Effects**: Hover over table rows for highlight
3. **Chart Tooltips**: Hover over chart elements for details
4. **Loading States**: Spinner displays during price fetching
5. **Empty States**: Friendly message when no account connected

## Integration Points

```
PortfolioValue Component
├── Zustand Store
│   ├── accountData (balances)
│   ├── prices (USD values)
│   └── loading states
├── Price Feed API
│   └── CoinGecko integration
├── Analytics Library
│   └── 15+ calculation functions
└── Recharts Library
    ├── PieChart
    ├── LineChart
    └── BarChart
```

This comprehensive analytics dashboard provides professional-grade portfolio analysis for Stellar blockchain assets with an intuitive, responsive interface.
