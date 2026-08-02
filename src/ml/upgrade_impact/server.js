import express from 'express';
import bodyParser from 'body-parser';
import * as tf from '@tensorflow/tfjs';
import { predictImpact, recordFeedback, trainModel, getModelStatus, resetModel } from './predictor.js';
import { extractFeatures } from './feature_extraction.js';

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/analyze', async (req, res) => {
  try {
    const { changes, spec } = req.body;
    if (!changes || !Array.isArray(changes)) {
      return res.status(400).json({ error: 'changes array is required' });
    }

    const result = predictImpact(changes, spec || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/features', async (req, res) => {
  try {
    const { changes, spec } = req.body;
    const features = extractFeatures(changes || [], spec || null);
    res.json({ features });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/feedback', async (req, res) => {
  try {
    const { changes, spec, actualSeverity, actualImpactScore } = req.body;
    if (actualImpactScore === undefined) {
      return res.status(400).json({ error: 'actualImpactScore is required' });
    }
    const result = recordFeedback(changes || [], spec || null, actualSeverity, actualImpactScore);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/train', async (req, res) => {
  try {
    const result = await trainModel(tf);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/status', (req, res) => {
  try {
    const status = getModelStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/reset', (req, res) => {
  try {
    const result = resetModel();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'upgrade-impact' });
});

const port = process.env.UPGRADE_ML_PORT || 4003;
app.listen(port, () => {
  console.log(`[upgrade_impact] Server running on port ${port}`);
});
