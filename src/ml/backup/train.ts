/**
 * ML Training for Backup Optimization (#626)
 *
 * Trains a change-pattern model and backup priority classifier
 * using Isolation Forest and TensorFlow.js.
 */

const path = require('path');
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');

function extractBackupFeatures(event) {
  return [
    Math.log1p(event.size || 0) / 10,
    ((new Date(event.timestamp || Date.now())).getHours()) / 23,
    event.changeType === 'delete' ? 1 : event.changeType === 'update' ? 0.5 : 0,
    Math.log1p(event.frequency || 1) / 10,
    event.volatility || 0,
    event.importance || 0.5,
  ];
}

async function train() {
  const dataPath = path.resolve(__dirname, 'data', 'train.json');
  const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models', 'backup');

  if (!fs.existsSync(dataPath)) {
    console.warn('No training data found at', dataPath);
    return;
  }

  fs.mkdirSync(modelsDir, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const features = raw.map(r => extractBackupFeatures(r));
  const labels = raw.map(r => r.optimalStrategy === 'full' ? 0 : r.optimalStrategy === 'incremental' ? 1 : 2);

  const xs = tf.tensor2d(features);
  const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), 3);

  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [features[0].length] }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  await model.fit(xs, ys, { epochs: 20, batchSize: 32, verbose: 1 });
  await model.save('file://' + path.join(modelsDir, 'tfjs_model'));
  console.log('Backup optimization model saved to', modelsDir);
}

if (require.main === module) {
  train().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { train };
