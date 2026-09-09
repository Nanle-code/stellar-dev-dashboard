const path = require('path');
const fs = require('fs');
let tf = null;
let tfLoaded = false;
try {
  tf = require('@tensorflow/tfjs-node');
  tfLoaded = true;
} catch {
  tfLoaded = false;
}
const { extractFeatures } = require('./feature_extraction.cjs');
const { IsolationForest } = require('./isolation_forest.cjs');

let models = { iforest: null, tfModel: null };

async function loadModels() {
  const modelsDir = path.resolve(__dirname, '..', '..', 'ml_models');
  const ifPath = path.join(modelsDir, 'isolation_forest.json');
  if (fs.existsSync(ifPath) && IsolationForest) {
    models.iforest = IsolationForest.load(ifPath);
  }
  if (!tfLoaded) return;
  const tfPath = path.join(modelsDir, 'tfjs_model', 'model.json');
  if (fs.existsSync(tfPath)) {
    models.tfModel = await tf.loadLayersModel('file://' + tfPath);
  }
}

async function scoreTransaction(tx) {
  if (!models.iforest && !models.tfModel) {
    await loadModels();
    if (!models.iforest && !models.tfModel) {
      const feat = extractFeatures(tx);
      return { score: 0.5, isFraud: false, explanation: { features: feat, isolationScore: 0, patternProbability: 0, combinedScore: 0.5 } };
    }
  }
  const feat = extractFeatures(tx);
  const ifScore = models.iforest ? models.iforest.anomalyScore(feat) : 0;
  const tfProb = models.tfModel && tf ? (await models.tfModel.predict(tf.tensor2d([feat])).array())[0][1] : 0;
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
