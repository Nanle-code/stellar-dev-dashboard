# Sentiment Analysis - Quick Start Guide

## 30-Second Setup

```tsx
import SentimentDashboard from '@/components/sentiment/SentimentDashboard';

export function MyPage() {
  return <SentimentDashboard assetCodes={['XLM', 'USDC']} />;
}
```

Done! Full sentiment analysis with visualizations and alerts.

## 5-Minute Integration

### Step 1: Import the Dashboard
```tsx
import SentimentDashboard from '@/components/sentiment/SentimentDashboard';
```

### Step 2: Add to Your Page
```tsx
function Dashboard() {
  return (
    <div>
      {/* Your existing content */}
      
      {/* Add sentiment analysis */}
      <SentimentDashboard 
        assetCodes={['XLM', 'USDC', 'BTC']}
        showDetails={true}
      />
    </div>
  );
}
```

### Step 3: Deploy
```bash
npm run build
```

That's it!

## Using Individual Components

### Sentiment Gauge
```tsx
import { SentimentGauge } from '@/components/sentiment/SentimentVisualizations';

<SentimentGauge sentiment={0.45} confidence={0.85} />
```

### Trend Chart
```tsx
import { SentimentTrendChart } from '@/components/sentiment/SentimentVisualizations';

<SentimentTrendChart trend={trendData} height={300} />
```

### Alert Display
```tsx
import { useSentimentAlerts } from '@/hooks/useSentimentAnalysis';

function Alerts() {
  const alerts = useSentimentAlerts('XLM');
  
  return (
    <div>
      {alerts.map(alert => (
        <div key={alert.id}>
          <h4>{alert.title}</h4>
          <p>{alert.description}</p>
        </div>
      ))}
    </div>
  );
}
```

## Using the Data Hook

```tsx
import { useSentimentAnalysis } from '@/hooks/useSentimentAnalysis';

function SentimentWidget() {
  const data = useSentimentAnalysis(['XLM']);
  
  if (data.isLoading) return <div>Loading...</div>;
  if (data.error) return <div>Error: {data.error.message}</div>;
  
  const aggregated = data.aggregatedSentiment.get('XLM');
  const trend = data.sentimentTrends.get('XLM');
  const alerts = data.alerts;
  
  return (
    <div>
      <p>Sentiment: {aggregated?.averageScore.toFixed(2)}</p>
      <p>Trend: {trend?.overallTrend}</p>
      <p>Alerts: {alerts.length}</p>
    </div>
  );
}
```

## Direct Library Usage

### Analyze Text
```tsx
import { sentimentAnalyzer } from '@/lib/sentimentAnalyzer';

const input = {
  id: '1',
  source: 'twitter',
  assetCode: 'XLM',
  text: 'XLM is looking bullish!',
  timestamp: Date.now(),
};

const result = sentimentAnalyzer.analyzeSentiment(input);
console.log(result.score);      // 0.45
console.log(result.label);      // 'positive'
console.log(result.confidence); // 0.82
```

### Fetch Multi-Source Data
```tsx
import { sentimentPipeline } from '@/lib/sentimentPipeline';

const sentiments = await sentimentPipeline.fetchAllSources(['XLM', 'USDC']);
console.log(sentiments); // Array of AnalyzedSentiment
```

### Aggregate & Analyze Trends
```tsx
import { sentimentAggregator } from '@/lib/sentimentAggregator';

const aggregated = sentimentAggregator.aggregateSentiment(
  sentiments,
  'XLM',
  'day'
);

const trend = sentimentAggregator.analyzeTrend(sentiments, 'XLM');
console.log(trend.overallTrend);  // 'uptrend' | 'downtrend' | 'sideways'
console.log(trend.strengthScore); // 0.75
```

### Generate Alerts
```tsx
import { sentimentAlertManager } from '@/lib/sentimentAlerts';

const alerts = await sentimentAlertManager.analyzeForAlerts(
  'XLM',
  aggregated,
  trend,
  sentiments
);

alerts.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.title}`);
  console.log(alert.description);
});
```

## Configuration

### Change Alert Thresholds
```tsx
import { sentimentAlertManager } from '@/lib/sentimentAlerts';

sentimentAlertManager.updateConfig({
  sentimentSpikeThreshold: 0.20,    // 20% instead of 15%
  divergenceThreshold: 0.40,        // 40% instead of 30%
  anomalyStdDevs: 3,                // 3 stdevs instead of 2
});
```

### Enable/Disable Specific Sources
```tsx
sentimentAlertManager.updateConfig({
  enabledSources: ['onchain', 'news', 'github'], // Only these
});
```

### Customize Alert Channels
```tsx
sentimentAlertManager.updateConfig({
  alertChannels: ['in-app', 'webhook', 'email'],
});
```

## Common Patterns

### Monitor Single Asset
```tsx
import { useAssetSentiment } from '@/hooks/useSentimentAnalysis';

function XLMMonitor() {
  const { aggregated, trend, correlation, isLoading, error } = 
    useAssetSentiment('XLM');
  
  if (isLoading) return <div>Loading...</div>;
  if (!aggregated) return <div>No data</div>;
  
  return (
    <div>
      <p>Score: {aggregated.averageScore}</p>
      <p>Trend: {trend?.overallTrend}</p>
      <p>Correlation: {correlation?.sentimentToPriceChange}</p>
    </div>
  );
}
```

### Real-Time Alert Notification
```tsx
function AlertNotifier() {
  const alerts = useSentimentAlerts();
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  
  useEffect(() => {
    criticalAlerts.forEach(alert => {
      // Show notification
      notify({
        title: alert.title,
        message: alert.description,
        severity: 'error',
      });
    });
  }, [criticalAlerts]);
  
  return null;
}
```

### Compare Multiple Assets
```tsx
function AssetComparison() {
  const data = useSentimentAnalysis(['XLM', 'USDC', 'BTC']);
  
  const assets = Array.from(data.aggregatedSentiment.entries())
    .map(([code, agg]) => ({
      code,
      sentiment: agg.averageScore,
      trend: data.sentimentTrends.get(code)?.overallTrend,
      mentions: agg.totalMentions,
    }))
    .sort((a, b) => b.sentiment - a.sentiment);
  
  return (
    <table>
      <tbody>
        {assets.map(asset => (
          <tr key={asset.code}>
            <td>{asset.code}</td>
            <td>{asset.sentiment.toFixed(2)}</td>
            <td>{asset.trend}</td>
            <td>{asset.mentions}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Testing

### Test in Browser Console
```javascript
// Analyze sentiment
await sentimentAnalyzer.analyzeSentiment({
  id: 'test',
  source: 'twitter',
  assetCode: 'XLM',
  text: 'XLM is amazing!',
  timestamp: Date.now()
});

// Fetch data
await sentimentPipeline.fetchAllSources(['XLM']);

// Check cache stats
sentimentPipeline.getCacheStats();

// Get accuracy
sentimentAnalyzer.getAccuracyMetrics();
```

### Run Test Suite
```bash
npm test -- sentimentAnalysis.test.ts

# Run specific test
npm test -- sentimentAnalysis.test.ts -t "accuracy"

# Watch mode
npm test -- sentimentAnalysis.test.ts --watch
```

## Troubleshooting

### Dashboard Not Showing
```tsx
// Make sure asset codes are provided
<SentimentDashboard assetCodes={['XLM']} />

// Make sure component is imported
import SentimentDashboard from '@/components/sentiment/SentimentDashboard';
```

### No Alerts Generated
```tsx
// Check config
const config = sentimentAlertManager.getConfig();
console.log(config.enableAlerts); // Should be true

// Check thresholds aren't too strict
config.sentimentSpikeThreshold;  // Default: 0.15 (15%)
config.divergenceThreshold;      // Default: 0.30 (30%)
```

### Data Not Updating
```tsx
// Check data is being fetched
const data = await sentimentPipeline.fetchAllSources(['XLM']);
console.log(data.length); // Should be > 0

// Verify hook interval
useSentimentAnalysis(['XLM'], 60000); // 60 second interval
```

### Accuracy Too Low
```tsx
// System needs more data
const metrics = sentimentAnalyzer.getAccuracyMetrics();
console.log(metrics.evaluationSampleSize); // Need 100+

// Check if model trained
metrics.lastUpdated; // Should be recent
```

## API Cheat Sheet

```tsx
// Get sentiment metrics
sentimentAnalyzer.getAccuracyMetrics()
sentimentAnalyzer.getStatistics()

// Fetch data
await sentimentPipeline.fetchAllSources(assetCodes)
await sentimentPipeline.fetchFromSource(source, assetCodes)

// Analyze
sentimentAggregator.aggregateSentiment(data, assetCode, window)
sentimentAggregator.analyzeTrend(data, assetCode, periodMs)

// Correlate
sentimentCorrelationAnalyzer.recordPrice(code, price)
sentimentCorrelationAnalyzer.analyzeSentimentPriceCorrelation(timeSeries, code, period)

// Alert
await sentimentAlertManager.analyzeForAlerts(code, aggregated, trend, data)
sentimentAlertManager.getAlerts(assetCode, limit)
sentimentAlertManager.getRecentCriticalAlerts(limit)

// On-Chain
await onChainIndicatorManager.fetchIndicators(code)
onChainIndicatorManager.calculateMomentum(code)
onChainIndicatorManager.analyzeWhaleActivity(code)
```

## Next Steps

1. **Add to Dashboard**: Integrate into main dashboard page
2. **Configure Alerts**: Set up alert thresholds and channels
3. **Monitor**: Track system performance and accuracy
4. **Customize**: Adjust themes and visualizations as needed
5. **Expand**: Add more assets and sources as needed

## Documentation

- **Full Guide**: [SENTIMENT_ANALYSIS.md](docs/SENTIMENT_ANALYSIS.md)
- **Validation**: [SENTIMENT_VALIDATION.md](docs/SENTIMENT_VALIDATION.md)
- **Types**: [sentiment.ts](src/types/sentiment.ts)
- **Tests**: [sentimentAnalysis.test.ts](tests/unit/sentimentAnalysis.test.ts)

## Support

For issues or questions, refer to:
1. Troubleshooting section above
2. Full documentation in docs/
3. Test suite for usage examples
4. GitHub issues tracker

---

Happy sentiment analysis! 🚀
