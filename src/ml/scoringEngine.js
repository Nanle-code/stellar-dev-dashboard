/**
 * ML Scoring Engine — Anomaly Detection for Load Distribution Security
 * =====================================================================
 * Combines Isolation Forest (unsupervised anomaly detection) with a TensorFlow
 * neural network (supervised pattern classification) to score transactions
 * for fraudulent or abnormal behavior. This protects the load distribution
 * system from being exploited by malicious actors during congestion periods.
 *
 * Scoring approach:
 *   1. ISOLATION FOREST — Random forest that isolates anomalies by randomly
 *      partitioning features. Anomalies are easier to isolate (shorter path
 *      lengths). Score is normalized 0-1. Weight: 70%.
 *   2. TFJS NEURAL NET — Supervised classifier trained on labeled transaction
 *      patterns. Outputs probability of fraudulent class. Weight: 30%.
 *   3. COMBINED SCORE — Weighted average (0.7 × IF + 0.3 × NN). Threshold
 *      for flagging: >0.6.
 *
 * Integration with load distribution:
 *   - Flagged transactions are deprioritized in the RateLimiter queue
 *   - High anomaly rates trigger CircuitBreaker sensitivity increase
 *   - Anomaly patterns feed into capacityPrediction.ts for trend analysis
 *   - Scoring results are recorded in performanceMonitoring.js metrics
 *
 * @see ../lib/rateLimiter.js — uses scores for priority queue demotion
 * @see ../lib/errorHandling/CircuitBreaker.ts — adjusts thresholds on anomaly spikes
 * @see ../lib/capacityPrediction.ts — correlates anomalies with load patterns
 */

const path = require('path');
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const { extractFeatures } = require('./feature_extraction');
const { IsolationForest } = require('./isolation_forest');

let models = { iforest: null, tfModel: null };

async function loadModels() {
  const modelsDir = path.resolve(__dirname, '..', '..', 'ml_models');
  const ifPath = path.join(modelsDir, 'isolation_forest.json');
  if (fs.existsSync(ifPath)) {
    models.iforest = IsolationForest.load(ifPath);
  }
  const tfPath = path.join(modelsDir, 'tfjs_model', 'model.json');
  if (fs.existsSync(tfPath)) {
    models.tfModel = await tf.loadLayersModel('file://' + tfPath);
  }
}

async function scoreTransaction(tx) {
  if (!models.iforest || !models.tfModel) {
    // try to load on demand
    await loadModels();
    if (!models.iforest && !models.tfModel) throw new Error('Models not available');
  }
  const feat = extractFeatures(tx);
  const ifScore = models.iforest ? models.iforest.anomalyScore(feat) : 0;
  const tfProb = models.tfModel ? (await models.tfModel.predict(tf.tensor2d([feat])).array())[0][1] : 0;
  // combine scores with simple weighting
  const combined = Math.min(1, 0.7 * ifScore + 0.3 * tfProb);

  const explanation = {
    features: feat,
    isolationScore: ifScore,
    patternProbability: tfProb,
    combinedScore: combined
  };

  return { score: combined, isFraud: combined > 0.6, explanation };
}

module.exports = { loadModels, scoreTransaction };
