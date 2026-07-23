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
