# AI-Enhanced Transaction Fee Prediction API

## Overview

This document details the public API for the AI-Enhanced Transaction Fee Prediction system, which provides machine learning-based fee recommendations for Stellar transactions.

## API Endpoints

### 1. GET /api/v1/fee-prediction

Get fee predictions for specified transactions or operations.

**Query Parameters:**
- `accountId` (string, required): Source account ID
- `operations` (array, optional): Array of operation objects
- `targetConfirmationTime` (string, optional): 'slow' | 'standard' | 'priority' | 'instant' (default: 'standard')
- `network` (string, optional): 'testnet' | 'mainnet' | 'futurenet' | 'local' | 'custom' (default: 'testnet')
- `userPreferences` (object, optional): User preference settings

**Response:**
```json
{
  "prediction": {
    "predictedFee": 123,
    "confidence": 0.95,
    "expectedConfirmationTime": "1-2 ledgers",
    "networkCongestion": 0.25,
    "modelVersion": "2.0.0",
    "predictionTimestamp": "2024-01-01T12:00:00Z",
    "alternativeFees": [
      {
        "type": "slow",
        "fee": 100,
        "expectedInclusion": "~3-4 ledgers",
        "probability": 0.25
      }
    ],
    "metadata": {
      "features": [0.5, 0.3, 0.2, 0.1, 1, 2],
      "modelType": "combined_isolation_forest_tfjs",
      "historicalAccuracy": 0.95,
      "lastUpdated": "2024-01-01T11:00:00Z"
    }
  },
  "transaction": {
    "sourceAccount": "GD...",
    "operations": [...],
    "network": "testnet",
    "baseFee": 123,
    "timeBounds": {...}
  }
}
```

### 2. POST /api/v1/fee-prediction/train

Trigger model training with new historical data.

**Request:**
```json
{
  "transactions": [...],
  "operations": [...],
  "networkStats": {
    "ledgerCount": 1000000,
    "congestionRatio": 0.3,
    "recentCloseTime": 5.2
  }
}
```

**Response:**
```json
{
  "status": "success",
  "accuracy": 0.95,
  "trainingTimeSeconds": 45,
  "modelVersion": "2.0.1"
}
```

### 3. GET /api/v1/fee-prediction/metrics

Get prediction performance metrics and analytics.

**Response:**
```json
{
  "predictionMetrics": {
    "accuracy": 0.95,
    "totalPredictions": 1000,
    "recentAccuracy": 0.93,
    "cacheHitRate": 0.85
  },
  "systemHealth": {
    "networkMonitorStatus": "active",
    "lastUpdate": "2024-01-01T12:00:00Z",
    "modelDriftDetected": false
  }
}
```

## Model Training

### Endpoint: POST /api/v1/fee-prediction/train

Trigger training of ML models with new historical data.

**Training Process:**
1. Extract features from historical transactions
2. Train Isolation Forest for anomaly detection
3. Train TensorFlow.js classifier for pattern recognition
4. Save trained models to `ml_models/` directory

**Required Data Format:**
```json
{
  "transactions": [
    {
      "id": "tx_123",
      "source_account": "GD...",
      "created_at": "2024-01-01T10:00:00Z",
      "fee_charged": "100",
      "operation_count": 1,
      "successful": true,
      "memo": "payment"
    }
  ],
  "operations": [
    {
      "id": "op_123",
      "type": "payment",
      "amount": "1000",
      "asset_type": "native",
      "from": "GD...",
      "to": "GC..."
    }
  ]
}
```

## Integration Methods

### JavaScript/TypeScript API

```typescript
import { 
  FeePredictor, 
  FeePredictionIntegration,
  type FeePredictionInput,
  type UserFeePreferences
} from './lib/feePredictor'

// Method 1: Direct fee prediction
const predictor = new FeePredictor()

const prediction = await predictor.predictFee({
  operations: paymentOps,
  userPreferences: {
    targetConfirmationTime: 'priority',
    riskTolerance: 'aggressive'
  }
})

// Method 2: Full integration with transaction building
const integration = new FeePredictionIntegration({
  enableRealTimeMonitoring: true,
  cachePredictions: true
})

const { transaction, prediction } = await integration.predictFeeForTransaction({
  sourceAccount: 'GD...',
  operations: paymentOps,
  network: 'testnet',
  userPreferences: { targetConfirmationTime: 'instant' }
})
```

### REST API

```javascript
// Fetch fee prediction
const response = await fetch('/api/v1/fee-prediction?accountId=GD...&targetConfirmationTime=priority')
const result = await response.json()

// Trigger model training
const trainResponse = await fetch('/api/v1/fee-prediction/train', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(trainingData)
})
```

## Response Formats

### Successful Prediction

```json
{
  "success": true,
  "data": {
    "prediction": { ... },
    "transaction": { ... }
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "modelVersion": "2.0.0"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "PREDICTION_FAILED",
    "message": "Unable to generate fee prediction",
    "details": "ML model not available or requires training"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Monitoring and Health Checks

### Health Endpoint

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "feePrediction": "operational",
    "mlModels": "loaded",
    "networkMonitor": "active"
  },
  "lastHealthCheck": "2024-01-01T12:00:00Z"
}
```

## Authentication

This system uses the existing Stellar Dev Dashboard authentication system. API endpoints require valid API tokens:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.stellar.dev/dashboard/api/v1/fee-prediction?accountId=GD...
```

## Error Codes

| Code | Description |
|------|-------------|
| PREDICTION_FAILED | Unable to generate fee prediction |
| MODELS_NOT_AVAILABLE | ML models not trained or loaded |
| INVALID_INPUT | Invalid prediction input parameters |
| NETWORK_ERROR | Network monitoring service unavailable |
| AUTH_FAILED | Invalid API token |

## Rate Limiting

- Standard API calls: 100 requests per minute
- Model training: 10 requests per hour
- Fee prediction details: 200 requests per minute

## WebSocket Updates

Real-time network state changes are available via WebSocket:

```javascript
const ws = new WebSocket('wss://api.stellar.dev/dashboard/ws')

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'network-state'
  }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'update') {
    // Update prediction UI
    updatePredictionUI(data.networkCongestion)
  }
}
```

## Development

### Local Development

```bash
# Start development server
npm run dev

# Start ML training pipeline
npm run ml:train

# Start ML scoring server
npm run ml:server

# Run tests
npm run test
```

### Testing

Run tests to verify fee prediction functionality:

```bash
# Unit tests for fee prediction
npm run test -w src/lib/feePredictor.ts

# Unit tests for prediction integration
npm run test -w src/lib/feePredictionIntegration.ts

# Integration tests
npm run test:integration

# All tests
npm run test
```

## Performance Requirements

- **Prediction Latency**: < 50ms for fee predictions
- **Accuracy**: 95% within 10% of actual fees
- **Update Frequency**: Every 15 seconds for network monitoring
- **Cache Size**: Configurable up to 1000 predictions
- **Storage**: Models and cache stored in `ml_models/` directory

## Deployment

### Environment Variables

```bash
# Enable debug logging
VITE_FEE_PREDICTION_DEBUG=1

# Set custom network endpoints
VITE_STELLAR_HORIZON_URL=https://horizon.stellar.org

# Configure cache TTL
VITE_FEE_PREDICTION_CACHE_TTL=86400

# Set prediction accuracy threshold
VITE_FEE_PREDICTION_ACCURACY_THRESHOLD=0.95

# Enable/disable real-time monitoring
VITE_FEE_PREDICTION_REALTIME_MONITORING=true
```

## License

MIT
