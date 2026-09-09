# Quick Reference: Performance Regression Detection

## At a Glance

**What**: AI-driven system that detects performance regressions before user impact  
**How**: Statistical z-score analysis (2.5σ threshold)  
**When**: Runs in CI after Lighthouse tests  
**Result**: Build fails on high-confidence regressions (≥50%)

## Key Files

```
src/ml/performanceRegression/
├── index.js                    # Public API
├── baselineCalculator.js       # Statistical baselines
├── regressionDetector.js       # Z-score detection
├── changeCorrelation.js        # Git log analysis
├── storage.js                  # IndexedDB persistence
├── earlyWarningSystem.js       # AlertCenter integration
└── README.md                   # Full documentation

scripts/
└── detect-performance-regressions.mjs  # CI script

.github/workflows/
└── testing.yml                 # Modified (added detection step)

docs/
└── PERFORMANCE_REGRESSION_DETECTION.md  # Developer guide
```

## Quick Start

### Record a Metric

```javascript
import { recordMetric } from './ml/performanceRegression';
await recordMetric('LCP', 2400);
```

### Analyze for Regressions

```javascript
import { analyzePerformanceMetrics } from './ml/performanceRegression';

const { regressions, warnings } = await analyzePerformanceMetrics({
  LCP: 3500,
  FCP: 2100,
});

console.log(`Found ${regressions.length} regressions`);
```

### Check CI Decision

```javascript
import { shouldFailCI } from './ml/performanceRegression';

if (shouldFailCI(regressions)) {
  console.error('High-confidence regression detected!');
  process.exit(1);
}
```

## CI Integration

**Workflow**: `.github/workflows/testing.yml`

```yaml
- name: Detect performance regressions
  run: node scripts/detect-performance-regressions.mjs --threshold=2.5
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Exit codes**:
- `0` = Pass (no high-confidence regressions)
- `1` = Fail (high-confidence regression detected)
- `2` = Error (script failure)

## Configuration

### Adjust Sensitivity

```javascript
// More sensitive (detect smaller changes)
analyzePerformanceMetrics(metrics, { threshold: 2.0 });

// Less sensitive (fewer false positives)
analyzePerformanceMetrics(metrics, { threshold: 3.0 });
```

### Change Baseline Window

```javascript
// Use 30-day baseline instead of 14
await recordMetric('LCP', 2400, { lookbackDays: 30 });
```

### Dry Run (CI)

```bash
# Log warnings without failing build
node scripts/detect-performance-regressions.mjs --dry-run
```

## Understanding Warnings

```
⚠️ Performance regression detected: LCP

Current value: 3500.00           ← Observed metric
Baseline: 2000.00 ± 200.00       ← Historical mean ± stdDev
Deviation: 75.0% (7.50σ)         ← How much worse (z-score)
Confidence: 92%                  ← How sure we are (0-100%)

Recent commits:                  ← Potential culprits
- abc123de (2024-01-15) feat: add lazy loading
```

**Action**: Review recent commits, profile changes, verify impact

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Insufficient data" | <7 observations | Run tests 7+ times to build baseline |
| Too many false positives | Threshold too low | Increase to 3.0σ |
| Missing real regressions | Threshold too high | Decrease to 2.0σ |
| Baseline inaccurate | Recent changes shifted baseline | Clear and rebuild baseline |
| CI always fails | Threshold too sensitive | Use dry-run or increase threshold |

## Testing

```bash
# Run all regression detection tests
npm run test -- src/ml/performanceRegression/__tests__

# With coverage
npm run test:coverage -- src/ml/performanceRegression/__tests__

# Property test (80% detection rate validation)
npm run test -- src/ml/performanceRegression/__tests__/integration.test.js
```

## API Cheat Sheet

```javascript
// Record metric + update baseline
await recordMetric(metricName, value, options)

// Analyze metrics for regressions
await analyzePerformanceMetrics(metricValues, options)

// Get high-confidence regressions only
getHighConfidenceRegressions(regressions)

// CI gate decision
shouldFailCI(regressions) // → boolean

// Storage operations
await loadMetricData(metricName)
await saveMetricData(metricName, observations, baseline)
await deleteMetricData(metricName)

// Warning management
emitWarning(regression, commits)
clearWarningHistory()
```

## Key Constants

```javascript
DEFAULT_LOOKBACK_DAYS = 14     // Baseline window
MIN_DATA_POINTS = 7            // Required observations
DEFAULT_THRESHOLD = 2.5        // Z-score threshold (σ)
MIN_CONFIDENCE = 0.5           // High-confidence cutoff
MAX_OBSERVATIONS = 1000        // Storage limit per metric
```

## Statistics Primer

**Z-score**: Number of standard deviations from the mean
- `z = 2.5` → 99.4% of normal values below this
- `z = 3.0` → 99.9% of normal values below this
- Higher z-score = more unusual = likely regression

**Confidence**: How certain we are it's a real regression
- Based on z-score magnitude + sample size
- ≥50% = high confidence = fail CI
- <50% = low confidence = log warning

**Baseline**: Historical "normal" performance
- Mean (μ) = average value
- StdDev (σ) = typical variation
- Requires ≥7 observations

## Resources

- **Full Documentation**: `src/ml/performanceRegression/README.md`
- **Developer Guide**: `docs/PERFORMANCE_REGRESSION_DETECTION.md`
- **PR Description**: `PR_DESCRIPTION_624.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY_624.md`

## Contact

For questions or issues with the regression detection system, refer to the documentation files above or review the inline JSDoc comments in the source code.
