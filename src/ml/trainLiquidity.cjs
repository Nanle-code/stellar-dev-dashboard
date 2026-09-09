// src/ml/trainLiquidity.cjs
/**
 * Node (CommonJS) training script for the liquidity LSTM model.
 * Uses @tensorflow/tfjs-node which provides filesystem saving capabilities.
 */
const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const { extractTimeSeriesFeatures } = require('./liquidityPredictionModel.js');

// Directory for optional real snapshots – not used in this synthetic version
const DATA_DIR = path.resolve(__dirname, 'data', 'liquidity');

function generateRandomFeatures() {
  return {
    midPrice: Math.random() * 10,
    bidAskSpread: Math.random() * 1,
    bidAskSpreadPct: Math.random() * 5,
    orderBookImbalance: Math.random() * 2 - 1,
    bidDepthTotal: Math.random() * 200000,
    askDepthTotal: Math.random() * 200000,
    volume5m: Math.random() * 100000,
    volume15m: Math.random() * 500000,
    priceVolatility15m: Math.random(),
    priceSma5m: Math.random() * 10,
    priceSma15m: Math.random() * 10,
    priceEma15m: Math.random() * 10,
    ledgerCloseTime: Math.random() * 10,
    networkFeePressure: Math.random(),
    ammReserveRatio: Math.random() * 5,
  };
}

function generateSyntheticSamples(count = 800) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const features = generateRandomFeatures();
    const target = Math.round(Math.random() * 100);
    samples.push({ features, target });
  }
  return samples;
}

async function loadDataset() {
  // For simplicity we always generate synthetic data.
  if (!fs.existsSync(DATA_DIR)) {
    console.warn('Data directory not found – using synthetic data');
  }
  return generateSyntheticSamples(800);
}

async function train() {
  const samples = await loadDataset();
  const X = tf.tensor2d(samples.map(s => Object.values(s.features)));
  const y = tf.tensor2d(samples.map(s => [s.target]));

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 32, inputShape: [X.shape[1], 1], returnSequences: false }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });

  const Xseq = X.reshape([X.shape[0], X.shape[1], 1]);
  console.log('Training LSTM on', samples.length, 'synthetic samples');
  await model.fit(Xseq, y, { epochs: 3, batchSize: 32, verbose: 1 });

  const modelDir = path.resolve(__dirname, '..', '..', 'model', 'liquidity');
  fs.mkdirSync(modelDir, { recursive: true });
  await model.save('file://' + modelDir);
  console.log('Model saved to', modelDir);
}

if (require.main === module) {
  train().catch(err => {
    console.error('Training error:', err);
    process.exit(1);
  });
}

module.exports = { train };
