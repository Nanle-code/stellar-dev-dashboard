# Federated Learning for Privacy-Preserving Analytics

## Overview

This guide explains the federated learning implementation for the Stellar Dev Dashboard, which enables AI model training across multiple user instances without sharing raw data. This improves model accuracy while preserving privacy through differential privacy and secure aggregation techniques.

## Architecture

The federated learning system consists of three main components:

### 1. Federated Client (`src/ml/federated/client.js`)
- Performs local model training on private data
- Applies differential privacy to model updates
- Communicates with the federated server
- Handles model serialization and deserialization

### 2. Federated Server (`src/ml/federated/server.js`)
- Aggregates model updates from multiple clients
- Implements FedAvg (Federated Averaging) algorithm
- Manages global model state
- Provides API endpoints for client communication

### 3. Privacy System (`src/ml/federated/privacy.js`)
- Applies differential privacy to data and model weights
- Anonymizes sensitive identifiers
- Implements secure aggregation masks
- Manages privacy budget

## Key Features

### Privacy Preservation
- **Differential Privacy**: Adds calibrated noise to data and model weights
- **Data Anonymization**: Removes or hashes sensitive identifiers
- **Secure Aggregation**: Uses client-specific masks for secure model updates
- **Privacy Budget**: Tracks and manages privacy budget usage

### Model Training
- **Local Training**: Clients train models on their private data
- **Federated Averaging**: Server aggregates updates using weighted averaging
- **Hybrid Approach**: Combines federated learning with existing ML infrastructure
- **Incremental Learning**: Models improve over multiple rounds

### Scalability
- **Distributed Architecture**: Scales with number of clients
- **Efficient Aggregation**: Only model weights are transmitted
- **Configurable Parameters**: Adjust based on requirements
- **Fault Tolerance**: Handles client failures gracefully

## Installation

The federated learning system uses TensorFlow.js, which is already included in the project dependencies:

```json
{
  "@tensorflow/tfjs": "^4.22.0",
  "@tensorflow/tfjs-node": "^5.0.0"
}
```

No additional dependencies are required.

## Quick Start

### 1. Start the Federated Server

```bash
node src/ml/federated/server.js
```

The server will start on port 4002 by default.

### 2. Configure the ML Server

Set environment variables to enable federated learning:

```bash
export ENABLE_FEDERATED=true
export FEDERATED_SERVER_URL=http://localhost:4002
export PRIVACY_EPSILON=1.0
export PRIVACY_DELTA=1e-5
```

### 3. Start the ML Server

```bash
node src/ml/server.js
```

The ML server will now include federated learning endpoints.

### 4. Use Federated Learning

#### Score with Federated Model

```bash
curl -X POST http://localhost:4001/score-federated \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "timestamp": 1634567890000,
    "senderFreq": 5,
    "recipientFreq": 3,
    "inputs": 2,
    "outputs": 1,
    "geoDistance": 1000
  }'
```

#### Participate in Federated Training Round

```bash
curl -X POST http://localhost:4001/federated-train \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "amount": 1000,
        "timestamp": 1634567890000,
        "senderFreq": 5,
        "recipientFreq": 3,
        "inputs": 2,
        "outputs": 1,
        "geoDistance": 1000,
        "isFraud": 0
      }
    ]
  }'
```

#### Check Federated Status

```bash
curl http://localhost:4001/federated-status
```

## API Endpoints

### ML Server Endpoints (Port 4001)

#### POST `/score-federated`
Score a transaction using the federated model.

**Request Body:**
```json
{
  "amount": 1000,
  "timestamp": 1634567890000,
  "senderFreq": 5,
  "recipientFreq": 3,
  "inputs": 2,
  "outputs": 1,
  "geoDistance": 1000
}
```

**Response:**
```json
{
  "score": 0.35,
  "isFraud": false,
  "explanation": {
    "features": [...],
    "federatedScore": 0.3,
    "combinedScore": 0.35,
    "model": "hybrid"
  }
}
```

#### POST `/federated-train`
Participate in a federated learning round with local data.

**Request Body:**
```json
{
  "transactions": [
    {
      "amount": 1000,
      "timestamp": 1634567890000,
      "senderFreq": 5,
      "recipientFreq": 3,
      "inputs": 2,
      "outputs": 1,
      "geoDistance": 1000,
      "isFraud": 0
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "round": 1,
  "pendingUpdates": 3
}
```

#### GET `/federated-status`
Get the current status of federated learning.

**Response:**
```json
{
  "enabled": true,
  "initialized": true,
  "serverUrl": "http://localhost:4002",
  "hasClient": true,
  "hasModel": true
}
```

#### POST `/federated-sync`
Sync with the federated server to get the latest global model.

**Response:**
```json
{
  "success": true
}
```

### Federated Server Endpoints (Port 4002)

#### GET `/global-model`
Get the current global model.

**Response:**
```json
{
  "round": 1,
  "modelWeights": [...],
  "inputShape": 7,
  "timestamp": 1634567890000
}
```

#### POST `/update`
Submit a local model update.

**Request Body:**
```json
{
  "clientId": "client-123",
  "round": 1,
  "weights": [...],
  "numExamples": 100,
  "metrics": {
    "loss": 0.3,
    "accuracy": 0.85
  }
}
```

#### GET `/status`
Get the current round status.

**Response:**
```json
{
  "round": 1,
  "clients": 2,
  "minClients": 3,
  "isAggregating": false,
  "timestamp": 1634567890000
}
```

#### POST `/initialize-round`
Initialize a new federated learning round.

**Response:**
```json
{
  "success": true,
  "round": 2
}
```

## Configuration

### Client Configuration

```javascript
const client = new FederatedClient({
  clientId: 'my-client-id',
  serverUrl: 'http://localhost:4002',
  localEpochs: 5,
  batchSize: 32,
  learningRate: 0.001,
  privacyBudget: 1.0
});
```

### Server Configuration

```javascript
const server = new FederatedServer({
  port: 4002,
  minClients: 3,
  maxClients: 10,
  roundTimeout: 300000,
  aggregationStrategy: 'fedavg'
});
```

### Privacy Configuration

```javascript
const privacy = new PrivacyPreservingCollector({
  epsilon: 1.0,
  delta: 1e-5,
  sensitivity: 1.0,
  minDataSize: 10,
  maxDataSize: 1000,
  enableLocalDP: true,
  enableSecureAggregation: true
});
```

## Privacy Parameters

### Epsilon (ε)
- **Range**: 0.1 to 10.0
- **Default**: 1.0
- **Effect**: Higher values provide less privacy but more accuracy
- **Recommendation**: Start with 1.0 and adjust based on requirements

### Delta (δ)
- **Range**: 1e-10 to 1e-3
- **Default**: 1e-5
- **Effect**: Probability of privacy failure
- **Recommendation**: Use default for most applications

### Sensitivity
- **Range**: Depends on data
- **Default**: 1.0
- **Effect**: Maximum change in output when one data point changes
- **Recommendation**: Calculate based on your data range

## Testing

Run the federated learning tests:

```bash
npm test -- src/ml/federated/__tests__
```

### Test Coverage

- **Client Tests**: Model initialization, local training, differential privacy
- **Privacy Tests**: Data anonymization, feature privatization, privacy budget
- **Integration Tests**: System initialization, status checking

## Performance Considerations

### Expected Accuracy Improvement
- **Target**: 20% improvement in model accuracy
- **Measurement**: Compare federated model vs. local-only model
- **Timeline**: Typically achieved after 5-10 rounds

### Aggregation Efficiency
- **Minimum Clients**: 3 (configurable)
- **Round Time**: Depends on client participation
- **Network Overhead**: Only model weights transmitted (~1-5 MB)

### Scalability
- **Horizontal Scaling**: Add more clients
- **Vertical Scaling**: Increase server resources
- **Bottleneck**: Network bandwidth for model updates

## Security Best Practices

1. **Use HTTPS**: Always use secure connections in production
2. **Validate Inputs**: Validate all incoming data
3. **Monitor Privacy Budget**: Track and enforce privacy limits
4. **Regular Audits**: Review privacy logs and model updates
5. **Secure Storage**: Encrypt stored models and data

## Troubleshooting

### Server Not Starting
- Check if port 4002 is available
- Verify TensorFlow.js is installed
- Check server logs for errors

### Client Connection Issues
- Verify server URL is correct
- Check network connectivity
- Ensure server is running

### Poor Model Performance
- Increase number of training rounds
- Adjust privacy parameters
- Check data quality and quantity
- Verify feature extraction

### Privacy Budget Exceeded
- Reduce epsilon value
- Reduce number of operations
- Implement privacy budget reset strategy

## Integration with Existing ML Infrastructure

The federated learning system integrates seamlessly with the existing ML infrastructure:

- **Hybrid Scoring**: Combines Isolation Forest, TFJS classifier, and federated model
- **Shared Data**: Uses existing feature extraction
- **Unified API**: Federated endpoints added to existing ML server
- **Model Storage**: Uses same `ml_models/` directory

## Future Enhancements

- [ ] Add support for other aggregation strategies (FedProx, Scaffold)
- [ ] Implement client selection strategies
- [ ] Add model versioning and rollback
- [ ] Implement adaptive privacy budget allocation
- [ ] Add real-time monitoring dashboard
- [ ] Support for custom model architectures

## References

- TensorFlow.js Documentation: https://www.tensorflow.org/js
- Federated Learning: https://ai.googleblog.com/2017/04/federated-learning-collaborative.html
- Differential Privacy: https://www.microsoft.com/en-us/research/project/differential-privacy/
