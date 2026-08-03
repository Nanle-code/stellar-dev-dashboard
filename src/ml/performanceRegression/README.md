# Predictive Performance Regression Detection

## Overview

AI-driven performance regression detection system that analyzes performance metric trends and code changes to detect regressions before they impact users. Integrates with the CI/CD pipeline to provide early warnings and automatic build failures for high-confidence regressions.

**Detection rate**: ≥ 80% (validated via property-based testing)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Performance Metrics                        │
│  (Lighthouse, Web Vitals, Custom Metrics)                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Baseline Calculator                             │
│  • Rolling window (14 days default)                         │
│  • Statistical baseline (mean, stdDev)                      │
│  • Stored in IndexedDB                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Regression Detector                               │
│  • Z-score deviation analysis                               │
│  • Threshold: 2.5σ (configurable)                           │
│  • Confidence scoring                                       │
│  • Severity classification (warning/critical)               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│          Change Correlation                                  │
│  • Git log analysis                                         │
│  • Commit attribution (sanitized)                           │
│  • Temporal correlation                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│       Early Warning System                                   │
│  • AlertCenter integration                                  │
│  • Deduplication (24h window)                               │
│  • PR comments (GitHub Actions)                             │
│  • CI build failure (high confidence)                       │
└─────────────────────────────────────────────────────────────┘
```

## Statistical Method

### Baseline Calculation

For each tracked metric, we compute a rolling baseline over a configurable lookback window (default: 14 days):

- **Mean (μ)**: Average metric value
- **Standard Deviation (σ)**: Measure of variance
- **Sample Count (n)**: Number of observations

**Algorithm**: Welford's online algorithm for numerical stability

**Minimum Data Points**: 7 observations required for reliable statistics

### Regression Detection

For each new metric observation, we compute a **z-score**:

```
z = (x - μ) / σ
```

Where:
- `x` = observed value
- `μ` = baseline mean
- `σ` = baseline standard deviation

**Threshold**: 2.5σ (default)
- Values with `z > 2.5` are flagged as regressions
- Only **degradations** are flagged (positive z-scores for "higher is worse" metrics)

### Confidence Scoring

Confidence is calculated based on:
1. **Deviation magnitude**: Higher z-scores → higher confidence
2. **Sample size**: More baseline data → higher confidence

```javascript
baseConfidence = min((|z| - 2.5) / 2.5 + 0.5, 1.0)
sampleFactor = min(n / 30, 1.0)
confidence = baseConfidence * (0.7 + 0.3 * sampleFactor)
```

**High-confidence threshold**: ≥ 0.5

### Severity Levels

- **WARNING**: `2.5σ ≤ z < 3.75σ`
- **CRITICAL**: `z ≥ 3.75σ`

## Usage

### Recording Metrics

```javascript
import { recordMetric } from './ml/performanceRegression';

// Record a performance observation
await recordMetric('LCP', 2400, { lookbackDays: 14 });
```

### Analyzing Metrics

```javascript
import { analyzePerformanceMetrics, shouldFailCI } from './ml/performanceRegression';

// Analyze current metrics
const { regressions, warnings, baselines } = await analyzePerformanceMetrics({
  LCP: 3500,
  FCP: 2100,
  TBT: 450,
  CLS: 0.15,
}, {
  threshold: 2.5,
  emitWarnings: true,
  correlateCommits: true,
});

// Check if CI should fail
if (shouldFailCI(regressions)) {
  process.exit(1);
}
```

### CI Integration

The system integrates with GitHub Actions via `.github/workflows/testing.yml`:

```yaml
- name: Detect performance regressions
  run: node scripts/detect-performance-regressions.mjs --threshold=2.5 --verbose
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Exit codes**:
- `0`: No high-confidence regressions (CI passes)
- `1`: High-confidence regressions detected (CI fails)
- `2`: Script error

## Configuration

### Detection Thresholds

Adjust the z-score threshold in CI script or runtime:

```javascript
const result = await analyzePerformanceMetrics(metrics, {
  threshold: 3.0, // More conservative (fewer false positives)
});
```

### Lookback Window

Change the rolling window size:

```javascript
await recordMetric('LCP', 2400, { lookbackDays: 30 });
```

### Alert Interpretation

When a regression is detected, the warning includes:

- **Metric name and current value**
- **Baseline (mean ± stdDev)**
- **Deviation (% and σ)**
- **Confidence score**
- **Correlated commits** (last 7 days)
- **Severity level**

Example warning:

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

## Testing

Run the test suite:

```bash
npm run test -- src/ml/performanceRegression/__tests__
```

**Coverage target**: 90%+

### Property-Based Test

The system includes a property-based acceptance test that validates the 80% detection rate requirement:

- Generates 100 synthetic time-series
- Injects 3σ regressions
- Verifies detection rate ≥ 80%

## Security & Privacy

### PII Protection

- **Commit authors**: Email domains are masked (`john@example.com` → `joh***@***`)
- **No secret leakage**: Git logs never include file contents or diffs

### Input Validation

- Metric values are validated (numeric, finite)
- Malformed git log output is sanitized
- Storage operations are isolated (IndexedDB)

## Limitations

1. **Assumes normal distribution**: Metric distributions should be approximately Gaussian
2. **No concept drift handling**: Baselines reset if the mean shifts significantly over time
3. **Simple rolling window**: Does not account for weekday/weekend patterns or seasonality
4. **Bidirectional by default**: Only flags degradations; improvements are not alerted

## Future Enhancements

- [ ] Seasonal decomposition (STL) for trend analysis
- [ ] ARIMA forecasting for predictive alerts
- [ ] Multi-dimensional anomaly detection (Isolation Forest across all metrics)
- [ ] A/B test integration (compare feature branches)
- [ ] Performance budget enforcement (per-metric budgets)
- [ ] Slack/email notifications

## References

- [Welford's Algorithm](https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm)
- [Z-score (Standard Score)](https://en.wikipedia.org/wiki/Standard_score)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
