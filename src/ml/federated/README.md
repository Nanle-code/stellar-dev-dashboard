# Federated Learning Module

This directory contains the federated learning implementation for privacy-preserving analytics.

## Components

### client.js
Federated learning client that performs local model training with differential privacy.

**Key Features:**
- Local model training on private data
- Differential privacy for model updates
- Communication with federated server
- Model serialization/deserialization

### server.js
Federated learning aggregation server that implements FedAvg algorithm.

**Key Features:**
- Model update aggregation
- Global model management
- Round-based training
- REST API for client communication

### privacy.js
Privacy-preserving data collection system.

**Key Features:**
- Differential privacy noise injection
- Data anonymization
- Secure aggregation masks
- Privacy budget management

### integration.js
Integration layer with existing ML infrastructure.

**Key Features:**
- Hybrid scoring (existing + federated models)
- Seamless integration with ML server
- Feedback collection
- Model evaluation

## Usage

### Start Federated Server
```bash
npm run ml:federated-server
```

### Start ML Server with Federated Learning
```bash
ENABLE_FEDERATED=true npm run ml:server
```

## Testing
```bash
npm test -- src/ml/federated/__tests__
```
