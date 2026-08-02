const path = require('path');
const fs = require('fs');
const { extractFeatures } = require('./feature_extraction.cjs');
const { IsolationForest } = require('./isolation_forest.cjs');

let models = { iforest: null, tfModel: null };
let tf = null;

function getTf() {
  if (!tf) {
    try {
      tf = require('@tensorflow/tfjs-node');
    } catch (error) {
      console.warn('Optional tfjs-node dependency is unavailable:', error.message);
      tf = null;
    }
  }
  return tf;
}

async function loadModels() {
  const modelsDir = path.resolve(__dirname, '..', '..', 'ml_models');
  const ifPath = path.join(modelsDir, 'isolation_forest.json');
  if (fs.existsSync(ifPath)) {
    models.iforest = IsolationForest.load(ifPath);
  }
  const tfPath = path.join(modelsDir, 'tfjs_model', 'model.json');
  if (fs.existsSync(tfPath)) {
    const tfjs = getTf();
    if (tfjs) {
      try {
        models.tfModel = await tfjs.loadLayersModel('file://' + tfPath);
      } catch (err) {
        console.warn('Unable to load TFJS model:', err.message);
        models.tfModel = null;
      }
    }
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
  const tfjs = getTf();
  const tfProb = models.tfModel && tfjs ? (await models.tfModel.predict(tfjs.tensor2d([feat])).array())[0][1] : 0;
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
