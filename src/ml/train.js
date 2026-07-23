// Training pipeline: trains Isolation Forest and a simple TFJS classifier for pattern recognition
const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const { extractFeatures } = require('./feature_extraction');
const { IsolationForest } = require('./isolation_forest');

async function train() {
  const dataPath = path.resolve(__dirname, 'data', 'train.json');
  if (!fs.existsSync(dataPath)) {
    console.warn('No training data found at', dataPath);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const X = raw.map(r => extractFeatures(r.tx));
  const y = raw.map(r => r.label ? 1 : 0);

  // Train Isolation Forest
  const iforest = new IsolationForest(80, Math.min(256, X.length));
  iforest.fit(X);
  const modelsDir = path.resolve(__dirname, '..', '..', 'ml_models');
  fs.mkdirSync(modelsDir, { recursive: true });
  iforest.save(path.join(modelsDir, 'isolation_forest.json'));
  console.log('Isolation Forest saved.');

  // Train a simple TFJS classifier for pattern recognition (optional)
  const xs = tf.tensor2d(X);
  const ys = tf.tensor2d(y.map(v => [1 - v, v]));
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [X[0].length] }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  await model.fit(xs, ys, { epochs: 15, batchSize: 32, verbose: 1 });
  await model.save('file://' + path.join(modelsDir, 'tfjs_model'));
  console.log('TFJS model saved.');
}

if (require.main === module) {
  train().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { train };
