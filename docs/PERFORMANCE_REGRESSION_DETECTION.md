# Performance Regression Detection System

## Overview

The Stellar Dev Dashboard includes an AI-driven performance regression detection system that automatically identifies performance degradations before they impact users. The system integrates with CI/CD pipelines to fail builds when high-confidence regressions are detected.

## How It Works

### Statistical Analysis

The system uses **z-score analysis** to compare current performance metrics against historical baselines:

1. **Baseline Establishment**: For each metric, computes rolling mean (μ) and standard deviation (σ) over the past 14 days
2. **Deviation Detection**: Calculates z-score for new observations: `z = (x - μ) / σ`
3. **Threshold Check**: Flags metrics with `z > 2.5σ` as regressions
4. **Confidence Scoring**: Assigns confidence based on deviation magnitude and sample size

### Metrics Tracked

- **Web Vitals**: LCP, FCP, CLS, FID, TTFB
- **Lighthouse Scores**: Performance, Accessibility, Best Practices, SEO
- **Custom Metrics**: API response times, transaction durations, bundle sizes

## Usage

### Recording Performance Metrics

```javascript
import { recordMetric } from './ml/performanceRegression';

// Record a Web Vital
await recordMetric('LCP', 2400);

// Record a custom metric
await recordMetric('API_RESPONSE_TIME', 850);
```

### Analyzing for Regressions

```javascript
import { analyzePerformanceMetrics } from './ml/performanceRegression';

const result = await analyzePerformanceMetrics({
  LCP: 3500,
  FCP: 2100,
  API_RESPONSE_TIME: 1200,
});

console.log(result.regressions); // Array of detected regressions
console.log(result.warnings);    // Emitted warning payloads
```

### CI Integration

The system runs automatically in GitHub Actions after Lighthouse CI:

```yaml
- name: Detect performance regressions
  run: node scripts/detect-performance-regressions.mjs
```

**Build behavior**:
- **High-confidence regressions** (≥50% confidence): CI fails ❌
- **Low-confidence regressions** (<50% confidence): CI passes with warning ⚠️
- **No regressions**: CI passes ✅

## Configuration

### Adjusting Detection Sensitivity

**More sensitive** (detect smaller regressions):
```javascript
analyzePerformanceMetrics(metrics, { threshold: 2.0 });
```

**Less sensitive** (reduce false positives):
```javascript
analyzePerformanceMetrics(metrics, { threshold: 3.0 });
```

### Changing the Lookback Window

```javascript
// Use 30-day baseline
await recordMetric('LCP', 2400, { lookbackDays: 30 });
```

### Disabling CI Failures

Run in dry-run mode to log warnings without failing builds:

```bash
node scripts/detect-performance-regressions.mjs --dry-run
```

## Interpreting Warnings

When a regression is detected, you'll see:

```
⚠️ Performance regression detected: LCP

Current value: 3500.00
Baseline: 2000.00 ± 200.00 (n=20)
Deviation: 75.0% (7.50σ)
Confidence: 92%

Recent commits:
- abc123de (2024-01-15) feat: add lazy loading for images
- def456ab (2024-01-14) refactor: update chart component
```

**What to check**:
1. **Current value**: Is this actually worse than expected?
2. **Baseline**: Does the historical baseline seem accurate?
3. **Confidence**: Higher confidence = more likely a real regression
4. **Commits**: Which changes might have caused this?

## Tuning for Your Project

### Initial Baseline Period

The system needs **at least 7 observations** before it can detect regressions. Run performance tests regularly to build baselines:

```bash
# Run daily to build baseline
npm run test:lighthouse
```

### False Positives

If you're seeing too many false alarms:

1. **Increase threshold**: Use 3.0σ instead of 2.5σ
2. **Increase lookback window**: Use 30 days for more stable baselines
3. **Add more baseline data**: Run tests more frequently

### False Negatives

If real regressions are being missed:

1. **Decrease threshold**: Use 2.0σ for higher sensitivity
2. **Check baseline data**: Ensure tests run consistently
3. **Verify metric collection**: Confirm metrics are being recorded

## Troubleshooting

### "Insufficient data" Warning

**Cause**: Fewer than 7 historical observations

**Solution**: Run performance tests multiple times to build baseline:
```bash
for i in {1..10}; do npm run test:lighthouse; sleep 60; done
```

### Baseline Seems Inaccurate

**Cause**: Recent performance changes shifted the baseline

**Solution**: Clear baselines and rebuild:
```javascript
import { deleteMetricData } from './ml/performanceRegression/storage';
await deleteMetricData('LCP');
```

### CI Always Fails

**Cause**: Threshold too sensitive or baseline not representative

**Solutions**:
1. Increase threshold to 3.0σ
2. Use dry-run mode temporarily
3. Investigate if performance genuinely degraded

## Best Practices

### 1. Run Tests Consistently

Performance baselines require consistent test conditions:
- Same hardware (use CI for consistency)
- Same network conditions
- Same dataset size
- Same time of day (if metrics vary by time)

### 2. Correlate with Changes

When a regression is detected:
1. Review the correlated commits
2. Profile the suspected changes
3. Use browser DevTools to confirm
4. Bisect to find the exact commit

### 3. Baseline Hygiene

Periodically review baselines:
- Are they representative of current performance?
- Has the application changed significantly?
- Should baselines be reset?

### 4. Document Intentional Changes

If you intentionally change performance characteristics:
1. Update baselines after merge
2. Document the change in commit message
3. Consider temporary threshold adjustment

## API Reference

### `recordMetric(metricName, value, options)`

Records a performance observation and updates baseline.

**Parameters**:
- `metricName` (string): Metric identifier (e.g., 'LCP')
- `value` (number): Observed metric value
- `options.lookbackDays` (number, default: 14): Rolling window size

**Returns**: `Promise<{ baseline, observations }>`

### `analyzePerformanceMetrics(metricValues, options)`

Analyzes metrics for regressions and emits warnings.

**Parameters**:
- `metricValues` (object): Map of metric names to values
- `options.threshold` (number, default: 2.5): Z-score threshold
- `options.emitWarnings` (boolean, default: true): Emit to AlertCenter
- `options.correlateCommits` (boolean, default: true): Include git commits

**Returns**: `Promise<{ regressions, warnings, baselines }>`

### `shouldFailCI(regressions)`

Determines if CI should fail based on regression confidence.

**Parameters**:
- `regressions` (array): Array of regression objects

**Returns**: `boolean` - True if any high-confidence regression exists

## Advanced Usage

### Custom Metrics

Track custom performance metrics:

```javascript
import { recordMetric } from './ml/performanceRegression';

// Track API latency
const start = performance.now();
await fetchData();
await recordMetric('CUSTOM_API_LATENCY', performance.now() - start);
```

### Programmatic Analysis

Use in scripts or tests:

```javascript
import { analyzePerformanceMetrics, shouldFailCI } from './ml/performanceRegression';

// Analyze custom metrics
const { regressions } = await analyzePerformanceMetrics({
  CUSTOM_METRIC: measuredValue,
}, {
  threshold: 2.0,
  emitWarnings: false,
});

if (shouldFailCI(regressions)) {
  console.error('Performance regression detected!');
  process.exit(1);
}
```

### Integration with Other Tools

Export baselines for analysis:

```javascript
import { loadMetricData } from './ml/performanceRegression/storage';

const data = await loadMetricData('LCP');
console.log(JSON.stringify(data, null, 2));
```

## Further Reading

- [Implementation README](../src/ml/performanceRegression/README.md)
- [Web Vitals Documentation](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Statistical Process Control](https://en.wikipedia.org/wiki/Statistical_process_control)
