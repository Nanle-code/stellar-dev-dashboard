import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractAllFeatures } from './feature_extraction.js';
import { IsolationForest } from './isolationForest.js';
import { VALIDATION_RULES } from './preBuildValidator.js';

let tf;
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function train() {
  ensureTf();
  const dataPath = path.resolve(__dirname, 'data', 'train.json');
  if (!fs.existsSync(dataPath)) {
    console.warn('No training data found at', dataPath);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const X = raw.map(r => extractAllFeatures(r.change, r.deps, r.history));
  const y = raw.map(r => (r.buildFailed ? 1 : 0));

  const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models');
  fs.mkdirSync(modelsDir, { recursive: true });

  const iforest = new IsolationForest(100, Math.min(256, X.length));
  iforest.fit(X);
  iforest.save(path.join(modelsDir, 'build_iforest.json'));
  console.log('Build Isolation Forest saved.');

  const xs = tf.tensor2d(X);
  const ys = tf.tensor2d(y.map(v => [1 - v, v]));
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [X[0].length] }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  await model.fit(xs, ys, { epochs: 30, batchSize: 16, validationSplit: 0.2, verbose: 1 });
  await model.save('file://' + path.join(modelsDir, 'build_tfjs_model'));
  console.log('Build TFJS model saved.');

  const featureNames = [
    'filesAdded', 'filesModified', 'filesDeleted', 'linesAdded', 'linesDeleted',
    'srcFilesChanged', 'configFilesChanged', 'depFilesChanged', 'testFilesChanged',
    'hasTypeChanges', 'hasBreakingChanges', 'hasNewDeps', 'hasDepUpgrades', 'hasDepDowngrades',
    'commitCount', 'authorExperience',
    'totalDeps', 'newDeps', 'upgradedDeps', 'downgradedDeps', 'removedDeps',
    'majorUpgrades', 'minorUpgrades', 'patchUpgrades', 'hasPeerDepChanges', 'hasEnginesChange',
    'depCount', 'avgDepAge',
    'totalBuilds', 'failedBuilds', 'successRate', 'recentFailures',
    'avgBuildDuration', 'lastBuildDuration', 'durationVariance', 'consecutiveFailures',
    'lastBuildFailed', 'hasLintErrors', 'hasTypeErrors', 'hasTestFailures',
    'bundleSizeChange', 'depCountChange',
  ];

  const metadata = {
    featureNames,
    featureCount: X[0].length,
    trainingSamples: X.length,
    failureRate: y.reduce((a, b) => a + b, 0) / y.length,
    validationRules: Object.keys(VALIDATION_RULES),
    modelVersion: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(modelsDir, 'build_metadata.json'), JSON.stringify(metadata, null, 2));
  console.log('Build model metadata saved.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  train().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
