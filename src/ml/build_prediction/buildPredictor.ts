import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { extractAllFeatures } from './feature_extraction.js';
import { IsolationForest } from './isolationForest.js';

let tf;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let models = { iforest: null, tfModel: null };

async function ensureTf() {
  if (!tf) {
    try {
      const { createRequire } = await import('module');
      const req = createRequire(import.meta.url);
      tf = req('@tensorflow/tfjs-node');
    } catch {
      throw new Error('TensorFlow.js Node.js addon not available.');
    }
  }
}

export async function loadModels() {
  const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models');
  const ifPath = path.join(modelsDir, 'build_iforest.json');
  if (fs.existsSync(ifPath)) {
    models.iforest = IsolationForest.load(ifPath);
  }
  const tfPath = path.join(modelsDir, 'build_tfjs_model', 'model.json');
  if (fs.existsSync(tfPath)) {
    models.tfModel = await tf.loadLayersModel('file://' + tfPath);
  }
}

export async function predictBuildFailure(change, deps, history) {
  await ensureTf();
  if (!models.iforest || !models.tfModel) {
    await loadModels();
    if (!models.iforest && !models.tfModel) throw new Error('Build prediction models not available');
  }
  const feat = extractAllFeatures(change, deps, history);
  const ifScore = models.iforest ? models.iforest.anomalyScore(feat) : 0;
  const tfProb = models.tfModel
    ? (await models.tfModel.predict(tf.tensor2d([feat])).array())[0][1]
    : 0;
  const combined = Math.min(1, 0.6 * ifScore + 0.4 * tfProb);

  return {
    score: combined,
    isFailurePredicted: combined > 0.6,
    anomalyScore: ifScore,
    patternScore: tfProb,
    features: feat,
  };
}
