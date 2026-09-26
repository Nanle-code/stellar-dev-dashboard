# Power User Features Guide

This guide covers the advanced features implemented for power users: keyboard shortcuts, transaction verification, and performance monitoring.

## 🎹 Keyboard Shortcuts & Command Palette

### Command Palette

Access the command palette with **Ctrl/Cmd + K** to quickly navigate and perform actions.

**Features:**

- Quick navigation to any page
- Recent account switching
- Transaction template loading
- Fuzzy search across all commands
- Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)

### Global Keyboard Shortcuts

| Shortcut              | Action                       |
| --------------------- | ---------------------------- |
| `Ctrl/Cmd + K`        | Open command palette         |
| `Ctrl/Cmd + /` or `?` | Show keyboard shortcuts help |
| `Ctrl/Cmd + B`        | Open transaction builder     |
| `G + D`               | Go to Dashboard              |
| `G + A`               | Go to Account                |
| `G + T`               | Go to Transactions           |
| `G + C`               | Go to Contracts              |
| `G + X`               | Go to DEX Explorer           |
| `G + S`               | Go to Asset Discovery        |
| `G + G`               | Scroll to top                |
| `Escape`              | Close modals/dialogs         |

### Transaction Templates

Save frequently used transaction configurations as templates for quick reuse.

**Usage:**

```javascript
import {
  saveTransactionTemplate,
  getTransactionTemplate,
} from "./utils/accessibility";

// Save a template
const templateId = saveTransactionTemplate({
  name: "Monthly Payment",
  operations: [
    {
      type: "payment",
      params: {
        destination: "G...",
        amount: "100",
        assetType: "native",
      },
    },
  ],
  memo: "Monthly payment",
  memoType: "text",
});

// Load a template
const template = getTransactionTemplate(templateId);
```

### Recent Accounts

Quickly switch between recently accessed accounts.

**Usage:**

```javascript
import { addRecentAccount, getRecentAccounts } from "./utils/accessibility";

// Add account to recent list
addRecentAccount("GXXX...", {
  label: "Main Account",
  network: "mainnet",
});

// Get recent accounts
const recent = getRecentAccounts();
```

### Custom Shortcuts

Register custom keyboard shortcuts for your application.

**Usage:**

```javascript
import { registerShortcut } from "./utils/accessibility";

// Register a shortcut
const unregister = registerShortcut(
  "ctrl+shift+d",
  () => {
    console.log("Custom shortcut triggered!");
  },
  {
    description: "My custom action",
    category: "custom",
  },
);

// Unregister when done
unregister();
```

---

## 🛡️ Transaction Verification System

Comprehensive transaction verification with risk scoring, scam detection, and unusual activity alerts.

### Features

- **Risk Scoring**: 0-100 risk score based on multiple factors
- **Scam Detection**: Identifies known scam patterns and addresses
- **Asset Verification**: Checks for suspicious asset codes and issuers
- **Operation Analysis**: Analyzes each operation for potential risks
- **Pattern Detection**: Identifies unusual transaction patterns
- **Budget Violations**: Warns about unusually high fees

### Risk Levels

- **Low (0-14)**: Transaction appears normal
- **Medium (15-29)**: Review carefully before proceeding
- **High (30-49)**: Exercise extreme caution
- **Critical (50+)**: Do not proceed without verification

### Usage

```javascript
import { verifyTransaction } from "./lib/transactionVerification";

// Verify a transaction
const result = await verifyTransaction(
  transactionXDR,
  "testnet",
  "GXXX...", // source account
);

console.log("Risk Level:", result.riskLevel);
console.log("Risk Score:", result.riskScore);
console.log("Warnings:", result.warnings);
console.log("Recommendations:", result.recommendations);
```

### React Component

```jsx
import { TransactionVerification } from "./components/security";

function MyComponent() {
  return (
    <TransactionVerification
      transaction={transactionXDR}
      network="testnet"
      sourceAccount="GXXX..."
    />
  );
}
```

### Scam Detection

The system checks for:

- Known scam addresses
- Suspicious asset codes (fake USDT, BTC, etc.)
- Suspicious memo patterns (phishing attempts)
- Unusual transaction patterns
- High-risk operations (account merge, signer changes)

### Account Analysis

Analyze an account for suspicious activity:

```javascript
import { analyzeAccountActivity } from "./lib/transactionVerification";

const analysis = await analyzeAccountActivity("GXXX...", "testnet");

console.log("Suspicious Score:", analysis.suspiciousScore);
console.log("Warnings:", analysis.warnings);
console.log("Risk Level:", analysis.riskLevel);
```

### Reporting Scams

Report suspicious addresses:

```javascript
import { reportScamAddress } from "./lib/transactionVerification";

reportScamAddress("GXXX...", "Phishing attempt via fake airdrop");
```

---

## 📊 Performance Monitoring

Real-time performance monitoring with Core Web Vitals tracking, bundle size analysis, and performance budgets.

### Core Web Vitals

Automatically tracks:

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **FCP** (First Contentful Paint): < 1.8s
- **TTFB** (Time to First Byte): < 800ms

### Performance Budgets

Default budgets:

- JavaScript bundle: 500 KB
- CSS bundle: 100 KB
- Images: 200 KB each
- Total page size: 2 MB
- API response time: 1 second
- Render time: 100ms

### Usage

Performance monitoring is automatically initialized in `main.jsx`. Access metrics programmatically:

```javascript
import {
  getMetricsSummary,
  getPerformanceScore,
  getBundleAnalysis,
  recordCustomMetric,
  measureAsync,
} from "./lib/performanceMonitoring";

// Get metrics summary
const summary = getMetricsSummary();
console.log("Web Vitals:", summary.webVitals);
console.log("Budget Violations:", summary.budgetViolations);

// Get performance score (0-100)
const score = getPerformanceScore();
console.log("Performance Score:", score);

// Get bundle analysis
const bundle = getBundleAnalysis();
console.log("JavaScript:", bundle.javascript);
console.log("CSS:", bundle.css);
console.log("Images:", bundle.images);
```

### Recording Custom Metrics

```javascript
import { recordCustomMetric, measureAsync } from "./lib/performanceMonitoring";

// Record a custom metric
recordCustomMetric("api_call_duration", 450, {
  endpoint: "/account",
  method: "GET",
});

// Measure async function
const data = await measureAsync("fetch_account", async () => {
  return await fetchAccount("GXXX...");
});
```

### Performance Marks & Measures

```javascript
import { mark, measure } from "./lib/performanceMonitoring";

// Mark start
mark("operation_start");

// ... do work ...

// Mark end
mark("operation_end");

// Measure duration
measure("operation_duration", "operation_start", "operation_end");
```

### React Component

View performance metrics in the dashboard:

```jsx
import PerformanceMonitor from "./components/dashboard/PerformanceMonitor";

function MyApp() {
  return (
    <div>
      <PerformanceMonitor />
    </div>
  );
}
```

### Real-time Monitoring

Listen for performance metrics in real-time:

```javascript
window.addEventListener("performance-metric", (event) => {
  const metric = event.detail;
  console.log(`${metric.name}: ${metric.value}`);

  // Send to analytics service
  // analytics.track('performance', metric);
});
```

### Bundle Size Analysis

The system automatically tracks:

- JavaScript files loaded
- CSS files loaded
- Images loaded
- Total transfer sizes
- Load durations

Access bundle analysis:

```javascript
import { getBundleAnalysis, formatBytes } from "./lib/performanceMonitoring";

const bundle = getBundleAnalysis();

console.log("JavaScript:");
console.log(`  Total: ${formatBytes(bundle.javascript.totalSize)}`);
console.log(`  Files: ${bundle.javascript.count}`);
console.log(`  Within Budget: ${bundle.javascript.withinBudget}`);

bundle.javascript.files.forEach((file) => {
  console.log(`  - ${file.name}: ${formatBytes(file.size)}`);
});
```

### Performance Score

The performance score (0-100) is calculated based on:

- Core Web Vitals compliance
- Performance budget violations
- Resource loading efficiency

A score of:

- **90-100**: Excellent performance
- **70-89**: Good performance
- **50-69**: Needs improvement
- **0-49**: Poor performance

---

## 🔧 Integration Examples

### Complete Transaction Flow with Verification

```jsx
import React, { useState } from "react";
import { TransactionVerification } from "./components/security";
import { recordCustomMetric } from "./lib/performanceMonitoring";

function TransactionFlow() {
  const [transaction, setTransaction] = useState(null);
  const [verified, setVerified] = useState(false);

  async function buildTransaction() {
    const start = performance.now();

    // Build transaction
    const tx = await buildMyTransaction();
    setTransaction(tx);

    // Record performance
    const duration = performance.now() - start;
    recordCustomMetric("transaction_build_time", duration);
  }

  return (
    <div>
      <button onClick={buildTransaction}>Build Transaction</button>

      {transaction && (
        <TransactionVerification
          transaction={transaction}
          network="testnet"
          sourceAccount="GXXX..."
        />
      )}

      {verified && <button onClick={signTransaction}>Sign Transaction</button>}
    </div>
  );
}
```

### Custom Keyboard Shortcuts in Component

```jsx
import React, { useEffect } from "react";
import { registerShortcut } from "./utils/accessibility";

function MyComponent() {
  useEffect(() => {
    // Register shortcuts
    const unregister1 = registerShortcut(
      "ctrl+s",
      () => {
        saveData();
      },
      { description: "Save data", category: "actions" },
    );

    const unregister2 = registerShortcut(
      "ctrl+r",
      () => {
        refreshData();
      },
      { description: "Refresh data", category: "actions" },
    );

    // Cleanup
    return () => {
      unregister1();
      unregister2();
    };
  }, []);

  return <div>My Component</div>;
}
```

### Performance Monitoring in Component

```jsx
import React, { useEffect } from "react";
import { mark, measure } from "./lib/performanceMonitoring";

function DataComponent() {
  useEffect(() => {
    mark("data_fetch_start");

    fetchData().then(() => {
      mark("data_fetch_end");
      measure("data_fetch_duration", "data_fetch_start", "data_fetch_end");
    });
  }, []);

  return <div>Data Component</div>;
}
```

---

## 🎯 Best Practices

### Keyboard Shortcuts

- Keep shortcuts intuitive and memorable
- Document all shortcuts in help modal
- Avoid conflicts with browser shortcuts
- Provide visual feedback when shortcuts are triggered

### Transaction Verification

- Always verify transactions before signing
- Pay attention to critical risk warnings
- Verify destination addresses through trusted channels
- Report suspicious addresses to help the community

### Performance Monitoring

- Set realistic performance budgets
- Monitor Core Web Vitals regularly
- Optimize resources that exceed budgets
- Use custom metrics to track critical operations
- Review performance reports periodically

---

## 📚 API Reference

### Accessibility Utils

```typescript
// Keyboard shortcuts
registerShortcut(key: string, handler: Function, options?: Object): Function
getAllShortcuts(): Array<Object>
clearAllShortcuts(): void

// Transaction templates
saveTransactionTemplate(template: Object): string
getTransactionTemplate(id: string): Object | null
getTransactionTemplates(): Object
deleteTransactionTemplate(id: string): void

// Recent accounts
addRecentAccount(publicKey: string, metadata?: Object): void
getRecentAccounts(): Array<Object>
clearRecentAccounts(): void
```

### Transaction Verification

```typescript
verifyTransaction(
  transaction: string | Object,
  network?: string,
  sourceAccount?: string
): Promise<VerificationResult>

analyzeAccountActivity(
  publicKey: string,
  network?: string
): Promise<AnalysisResult>

isKnownScamAddress(address: string): boolean
reportScamAddress(address: string, reason?: string): void
```

### Performance Monitoring

```typescript
initPerformanceMonitoring(): void
recordCustomMetric(name: string, value: number, metadata?: Object): void
measurePerformance(name: string, fn: Function): any
measureAsync(name: string, asyncFn: Function): Promise<any>
mark(name: string): void
measure(name: string, startMark: string, endMark: string): void
getAllMetrics(): Object
getMetricsSummary(): Object
getPerformanceScore(): number
getBundleAnalysis(): Object
clearMetrics(): void
formatBytes(bytes: number): string
formatMs(ms: number): string
```

---

## 🚀 Future Enhancements

### Keyboard Shortcuts

- [ ] Customizable shortcuts via settings
- [ ] Shortcut conflicts detection
- [ ] Shortcut recording UI
- [ ] Context-aware shortcuts

### Transaction Verification

- [ ] Machine learning-based scam detection
- [ ] Community-driven scam reporting
- [ ] Integration with external threat databases
- [ ] Historical risk analysis

### Performance Monitoring

- [ ] Performance regression detection
- [ ] Automated performance testing
- [ ] Performance comparison across builds
- [ ] Integration with CI/CD pipelines
- [ ] Real-time alerts for budget violations

---

## 📞 Support

For issues or questions:

1. Check the documentation above
2. Review the code examples
3. Open an issue on GitHub
4. Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-24
