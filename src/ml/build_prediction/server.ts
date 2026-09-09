import express from 'express';
import bodyParser from 'body-parser';
import { analyzeBuildRisk, loadModels } from './index.js';
import { validateCommit } from './preBuildValidator.js';
import { generateRecommendations } from './recommendationEngine.js';
import { scoreCommit } from './riskScorer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(bodyParser.json());

app.post('/analyze', async (req, res) => {
  try {
    const commitData = req.body;
    const result = await analyzeBuildRisk(commitData);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/validate', async (req, res) => {
  try {
    const result = await validateCommit(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/recommend', async (req, res) => {
  try {
    const { change, deps, history } = req.body;
    const result = generateRecommendations(change, deps, history);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/score', async (req, res) => {
  try {
    const result = await scoreCommit(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/feedback', (req, res) => {
  try {
    const { commitData, buildActuallyFailed } = req.body;
    const fbDir = path.resolve(__dirname, 'data');
    fs.mkdirSync(fbDir, { recursive: true });
    const fbPath = path.join(fbDir, 'build_feedback.json');
    const arr = fs.existsSync(fbPath)
      ? JSON.parse(fs.readFileSync(fbPath))
      : [];
    arr.push({ commitData, buildActuallyFailed, timestamp: Date.now() });
    fs.writeFileSync(fbPath, JSON.stringify(arr, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'build-prediction' });
});

const port = process.env.BUILD_ML_PORT || 4002;
app.listen(port, () => {
  console.log('Build prediction server running on port', port);
});
