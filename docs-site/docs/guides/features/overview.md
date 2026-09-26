# Portfolio Analytics - Feature Overview

## 🎯 What Was Built

A comprehensive **Portfolio Analytics Dashboard** for the Stellar Dev Dashboard that provides users with professional-grade portfolio insights, visualizations, and performance metrics.

## 📋 Component Structure

```
PortfolioAnalytics Dashboard
│
├── 📊 Header Section
│   ├── Title: "Portfolio Analytics"
│   ├── Last Update Timestamp
│   ├── Auto-Refresh Toggle Button
│   └── Manual Refresh Button
│
├── 📈 Key Metrics Grid (4-6 cards)
│   ├── Total Portfolio Value (USD)
│   ├── 24h Change (% and $)
│   ├── Diversification Score (0-100)
│   ├── Risk Level (Low/Medium/High)
│   ├── Volatility (%) [Desktop]
│   └── Sharpe Ratio [Desktop]
│
├── 📊 Charts Section (2-column grid)
│   ├── Asset Allocation Pie Chart
│   │   ├── Color-coded segments
│   │   ├── Percentage labels
│   │   ├── Interactive tooltips
│   │   └── Legend with asset codes
│   │
│   └── Portfolio Value Over Time (Area Chart)
│       ├── Time range selector (7D/30D/90D/1Y)
│       ├── Gradient fill
│       ├── Smooth line interpolation
│       ├── Date X-axis
│       ├── USD Y-axis
│       └── Hover tooltips
│
├── 📊 Asset Performance Bar Chart
│   ├── Horizontal layout
│   ├── 24h change per asset
│   ├── Color-coded (green/red)
│   └── Percentage values
│
├── 📋 Detailed Holdings Table
│   ├── Columns:
│   │   ├── Asset (with color dot)
│   │   ├── Balance
│   │   ├── Price (USD)
│   │   ├── Value (USD)
│   │   ├── Allocation (%)
│   │   └── 24h Change (with icon)
│   ├── Sortable
│   ├── Hover effects
│   └── Mobile responsive
│
├── ⚠️ Risk Assessment Panel
│   ├── Risk Metrics Cards
│   │   ├── Risk Level
│   │   ├── Risk Score (0-100)
│   │   └── Concentration Risks Count
│   ├── Risk Factors List
│   │   ├── Factor description
│   │   ├── Impact level
│   │   └── Visual indicators
│   └── Concentrated Assets List
│       ├── Asset code
│       ├── Allocation percentage
│       └── Risk level badge
│
├── 📊 Performance Metrics Grid [Desktop]
│   ├── Average Daily Return
│   ├── Highest Value Asset
│   └── Number of Assets
│
└── 📜 Account History Panel
    ├── Description text
    └── Period Comparison Cards
        ├── Period Start Value & Date
        ├── Current Value & Date
        └── Period Change (% and $)
```

## 🎨 Visual Design

### Color Scheme

**Chart Colors (10 colors for assets):**
1. `#00d4ff` - Cyan (primary)
2. `#00ff88` - Green
3. `#ff6b6b` - Red
4. `#ffd93d` - Yellow
5. `#a78bfa` - Purple
6. `#fb923c` - Orange
7. `#ec4899` - Pink
8. `#14b8a6` - Teal
9. `#f59e0b` - Amber
10. `#8b5cf6` - Violet

**Status Colors:**
- **Green** (`#00e676`): Positive performance, low risk, good diversification
- **Red** (`#ff1744`): Negative performance, high risk
- **Amber** (`#ffb300`): Medium risk, moderate diversification
- **Cyan** (`#00e5ff`): Primary actions, highlights

### Typography

- **Headings**: Syne font, 22px, bold
- **Body**: System font, 13px
- **Numbers**: Space Mono (monospace), 13px
- **Labels**: 11px, uppercase, letter-spacing

### Layout

- **Desktop**: 4-column grid for metrics
- **Tablet**: 3-column grid
- **Mobile**: 2-column grid
- **Spacing**: 12-20px gaps
- **Border Radius**: 8-12px
- **Borders**: 1px solid with theme colors

## 🔢 Metrics Explained

### 1. Total Portfolio Value
```
Sum of (Asset Balance × Asset Price) for all assets
Displayed in USD with 2 decimal places
Example: $12,345.67
```

### 2. 24h Change
```
Percentage: ((Current Value - 24h Ago Value) / 24h Ago Value) × 100
Absolute: Current Value - 24h Ago Value
Example: +5.23% ($645.12)
```

### 3. Diversification Score (0-100)
```
Uses Herfindahl-Hirschman Index (HHI)
HHI = Σ(allocation%)²
Score = ((10000 - HHI) / (10000 - 10000/n)) × 100

Interpretation:
- 70-100: Well diversified
- 40-69: Moderately diversified
- 0-39: Poorly diversified
```

### 4. Risk Level
```
Calculated from 3 factors:
- Volatility (0-40 points)
- Diversification (0-30 points)
- Concentration (0-30 points)

Total Score → Risk Level:
- 0-30: Low
- 31-60: Medium
- 61-100: High
```

### 5. Volatility
```
Standard deviation of daily returns
returns[i] = (value[i] - value[i-1]) / value[i-1]
volatility = σ(returns) × 100

Interpretation:
- <5%: Low volatility
- 5-10%: Moderate volatility
- >10%: High volatility
```

### 6. Sharpe Ratio
```
(Portfolio Return - Risk-Free Rate) / Volatility
Default risk-free rate: 4%

Interpretation:
- >1.0: Good risk-adjusted returns
- 0-1.0: Fair returns
- <0: Poor returns
```

## 📊 Chart Types

### 1. Pie Chart - Asset Allocation

**Purpose**: Show percentage distribution of portfolio across assets

**Features**:
- Interactive segments
- Percentage labels on slices
- Hover tooltips with USD values
- Color-coded for easy identification
- Responsive sizing (80px mobile, 100px desktop)

**Data Format**:
```javascript
[
  { code: 'XLM', allocation: 45.5, valueUsd: 5465.23 },
  { code: 'USDC', allocation: 30.2, valueUsd: 3624.50 },
  { code: 'BTC', allocation: 24.3, valueUsd: 2916.10 }
]
```

### 2. Area Chart - Portfolio Value Over Time

**Purpose**: Track portfolio value changes over selected time period

**Features**:
- Multiple time ranges (7D, 30D, 90D, 1Y)
- Gradient fill for visual appeal
- Smooth monotone line
- Grid lines for readability
- Formatted axes (dates and USD)

**Data Format**:
```javascript
[
  { timestamp: 1234567890, date: '2024-01-01', value: 10500.50 },
  { timestamp: 1234654290, date: '2024-01-02', value: 10750.25 },
  ...
]
```

### 3. Bar Chart - Asset Performance

**Purpose**: Compare 24h performance across all assets

**Features**:
- Horizontal layout for readability
- Color-coded by performance (green/red)
- Sorted by performance (best to worst)
- Asset codes as labels
- Percentage values

**Data Format**:
```javascript
[
  { code: 'XLM', change24h: 5.2, valueUsd: 5465.23 },
  { code: 'USDC', change24h: 0.1, valueUsd: 3624.50 },
  { code: 'BTC', change24h: -2.3, valueUsd: 2916.10 }
]
```

## 📱 Responsive Behavior

### Desktop (>1024px)
- 4-column metrics grid
- 2-column charts layout
- 6 metric cards visible
- All features enabled
- Larger chart sizes (320px)

### Tablet (769-1024px)
- 3-column metrics grid
- 1-column charts layout
- 4 metric cards visible
- All features enabled
- Medium chart sizes (280px)

### Mobile (≤768px)
- 2-column metrics grid
- 1-column charts layout
- 4 metric cards visible
- Reduced font sizes (9px)
- Smaller chart sizes (280px)
- Stacked table columns
- Touch-friendly targets (48×48px)

## 🔄 Data Flow

```
User Opens Dashboard
       ↓
Extract Asset Codes from Balances
       ↓
Fetch Prices from CoinGecko API
       ↓
Calculate Portfolio Value (USD)
       ↓
Fetch Historical Effects from Horizon
       ↓
Reconstruct Balance History
       ↓
Calculate Analytics Metrics
       ↓
Render All Visualizations
       ↓
Start Auto-Refresh Timer (60s)
       ↓
Update Prices → Recalculate → Re-render
```

## 🎯 User Interactions

### Header Controls

1. **Auto-Refresh Toggle**
   - Click to enable/disable
   - Active state: Cyan background
   - Inactive state: Grey background
   - Icon: Spinning refresh icon when active

2. **Manual Refresh Button**
   - Click to fetch latest prices immediately
   - Shows "Refreshing..." during fetch
   - Disabled state while loading
   - Updates last update timestamp

### Time Range Selector

- Four buttons: 7D, 30D, 90D, 1Y
- Active range: Cyan background
- Inactive ranges: Grey background
- Click to switch time period
- Chart updates immediately

### Charts

- **Hover**: Shows tooltip with detailed values
- **Mobile**: Pinch to zoom, pan to scroll
- **Reset**: Button appears when zoomed >1.1x

### Table

- **Hover**: Row highlights with background color
- **Click**: (Could be extended for details view)
- **Scroll**: Horizontal scroll on mobile

## 🚨 Error Handling

### No Data States

1. **No Account Connected**
   - Shows empty state with info icon
   - Message: "Connect an account with balances"

2. **No Balances**
   - Shows empty state
   - Message: "No Portfolio Data"

3. **Price Fetch Error**
   - Shows error message
   - Allows retry
   - Fallbacks to previous data if available

### Loading States

1. **Initial Load**
   - Full-page spinner
   - Message: "Loading portfolio data..."

2. **Price Refresh**
   - Button shows "Refreshing..."
   - Button disabled during fetch
   - No page disruption

3. **Historical Data**
   - Chart area shows spinner
   - Other sections remain visible

## ✨ Special Features

### 1. Real-Time Updates
- Automatic price refresh every 60 seconds
- Manual refresh button for immediate updates
- Last update timestamp display
- Non-intrusive updates (no page reload)

### 2. Risk Awareness
- Concentration risk detection (>25% allocation)
- Multi-factor risk scoring
- Visual risk indicators (color-coded)
- Actionable risk factors

### 3. Mobile Optimization
- Touch-friendly charts with gestures
- Responsive grid layouts
- Adaptive font sizes
- Safe area insets for notched devices

### 4. Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast colors
- Touch targets ≥48×48px

## 🔮 Future Possibilities

The component is architected to support future enhancements:

1. **Export Features**
   - Download charts as images
   - Export data as CSV/JSON
   - Generate PDF reports

2. **Advanced Analytics**
   - Correlation matrix
   - Beta vs benchmarks
   - Monte Carlo simulations
   - Drawdown analysis

3. **Alerts**
   - Price alerts
   - Risk threshold warnings
   - Rebalancing notifications

4. **Customization**
   - Drag-and-drop layout
   - Custom chart configurations
   - Personalized metrics

## 📄 Files Reference

### Component File
`src/components/dashboard/PortfolioAnalytics.tsx` (650+ lines)

### Integration Files
- `src/App.tsx` - Route registration
- `src/components/layout/Sidebar.tsx` - Navigation link

### Used Libraries
- `src/lib/portfolioAnalytics.js` - Analytics calculations
- `src/lib/priceFeed.js` - Price fetching
- `src/lib/stellar.ts` - Horizon API integration
- `src/lib/store.ts` - State management

### UI Components
- `src/components/dashboard/Card.tsx` - Card and StatCard
- `src/components/charts/MobileChartContainer.tsx` - Touch gestures
- `src/hooks/useResponsive.ts` - Breakpoint detection

---

**This document provides a complete overview of the Portfolio Analytics feature implementation.**

For technical details, see `PORTFOLIO_ANALYTICS_IMPLEMENTATION.md`
For PR information, see `PR_SUMMARY.md`
