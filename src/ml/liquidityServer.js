// src/ml/liquidityServer.js
/**
 * Minimal ML server exposing the trained liquidity LSTM model.
 * It loads the model from `model/liquidity` on startup and provides a
 * POST /predict endpoint that accepts a JSON body matching the feature
 * vector shape used by `LiquidityModel`.
 */
import express from 'express';
import { createServer } from 'http';
import { LiquidityModel } from '../lib/liquidityModel';

const app = express();
app.use(express.json());

const model = new LiquidityModel('model/liquidity');
await model.loadModel(); // load model at startup

app.post('/predict', async (req, res) => {
  try {
    const features = req.body; // should be an object with numeric fields
    const prediction = await model.predict(features);
    res.json(prediction);
  } catch (err) {
    console.error('Liquidity ML server error:', err);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

const server = createServer(app);
const PORT = process.env.ML_PORT || 5002; // separate port to avoid clash with existing ML server
server.listen(PORT, () => console.log(`Liquidity ML server listening on port ${PORT}`));
