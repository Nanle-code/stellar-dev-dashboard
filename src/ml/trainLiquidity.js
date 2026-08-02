// src/ml/trainLiquidity.js
/**
 * Training pipeline for the AI liquidity prediction model.
 * Runs as an ES module (package.json defines "type": "module").
 * Uses @tensorflow/tfjs (CPU) to avoid native bindings.
 */
import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Helper: generate a random feature vector matching TimeSeriesFeatures shape */
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

/** Generate synthetic dataset (features + target liquidity delta) */
function generateSyntheticSamples(count = 500) {
  const samples = [];
  for (let i = 0; i < count; i++) {
    const features = generateRandomFeatures();
    const target = Math.round(Math.random() * 100); // 0‑100 liquidity index delta
    samples.push({ features, target });
  }
  return samples;
}

/** Load dataset – for now we always synthesize data */
async function loadDataset() {
  // In a real deployment you would read snapshots from DATA_DIR and extract features.
  // Here we fallback to synthetic data for quick training.
  return generateSyntheticSamples(800);
}

async function train() {
  const samples = await loadDataset();
  const X = tf.tensor2d(samples.map((s) => Object.values(s.features)));
  const y = tf.tensor2d(samples.map((s) => [s.target]));

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 32, inputShape: [X.shape[1], 1], returnSequences: false }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });

  const Xseq = X.reshape([X.shape[0], X.shape[1], 1]);
  console.log('Training LSTM model on', samples.length, 'synthetic samples');
  await model.fit(Xseq, y, { epochs: 1, batchSize: 32, verbose: 1 });

  const modelDir = path.resolve(__dirname, '..', '..', 'model', 'liquidity');
  fs.mkdirSync(modelDir, { recursive: true });
  await model.save('file://' + modelDir);
  console.log('Liquidity LSTM model saved to', modelDir);
}

if (import.meta.url === `file://${__filename}`) {
  train().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { train };
