ML Fraud Detection Integration

Overview
--------
This folder contains a lightweight ML integration for anomaly detection and pattern recognition.

Key files
- `src/ml/feature_extraction.js`: feature extractor for transactions
- `src/ml/isolation_forest.js`: simple Isolation Forest implementation
- `src/ml/train.js`: training pipeline (Isolation Forest + TFJS classifier)
- `src/ml/scoringEngine.js`: real-time scoring and explanations
- `src/ml/server.js`: small express server exposing `/score` and `/feedback`

Quick start

1. Install new deps:

```bash
npm install @tensorflow/tfjs-node express
```

2. Train models (will create `ml_models/`):

```bash
node src/ml/train.js
```

3. Start scoring server:

```bash
node src/ml/server.js
```

Notes & Next steps
- The Isolation Forest here is a simplified implementation intended as a scaffold. For production use, replace with a battle-tested implementation or service (Python isotree or sklearn, or a managed ML infra).
- Add model versioning by saving models under `ml_models/v{timestamp}/...` and update the scoring loader to select the active version.
- Add A/B testing and metrics collection in the server for model evaluation and drift monitoring.
