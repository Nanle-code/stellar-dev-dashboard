/**
 * ML Server for Backup Optimization (#626)
 *
 * Express server that provides endpoints for backup scoring,
 * strategy recommendation, and pattern analysis.
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

let model = null;

async function loadModel() {
  try {
    const modelsDir = path.resolve(__dirname, '..', '..', '..', 'ml_models', 'backup', 'tfjs_model');
    if (fs.existsSync(path.join(modelsDir, 'model.json'))) {
      const tf = require('@tensorflow/tfjs-node');
      model = await tf.loadLayersModel('file://' + path.join(modelsDir, 'model.json'));
      console.log('Backup ML model loaded');
    }
  } catch (err) {
    console.warn('Could not load backup ML model:', err.message);
  }
}

function predictStrategy(features) {
  if (!model) {
    return { strategy: 'incremental', confidence: 0.5 };
  }
  try {
    const tf = require('@tensorflow/tfjs-node');
    const input = tf.tensor2d([features]);
    const output = model.predict(input);
    const probs = output.arraySync()[0];
    const strategyMap = ['full', 'incremental', 'differential'];
    const maxIdx = probs.indexOf(Math.max(...probs));
    return { strategy: strategyMap[maxIdx], confidence: probs[maxIdx], probabilities: probs };
  } catch (err) {
    return { strategy: 'incremental', confidence: 0.5, error: err.message };
  }
}

const app = express();
app.use(bodyParser.json());

app.post('/backup/recommend-strategy', (req, res) => {
  try {
    const { features } = req.body;
    const result = predictStrategy(features);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/backup/analyze-patterns', (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.json({ patterns: [] });
    }

    const byType = {};
    for (const e of events) {
      if (!byType[e.entityType]) byType[e.entityType] = [];
      byType[e.entityType].push(e);
    }

    const patterns = Object.entries(byType).map(([entityType, evts]) => {
      const hours = evts.map(e => new Date(e.timestamp || Date.now()).getHours());
      const peakHourCounts = new Array(24).fill(0);
      hours.forEach(h => peakHourCounts[h]++);
      const peakHours = peakHourCounts
        .map((c, i) => ({ hour: i, count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(h => h.hour);

      return {
        entityType,
        eventCount: evts.length,
        peakHours,
        avgSize: evts.reduce((s, e) => s + (e.size || 0), 0) / evts.length,
        uniqueKeys: new Set(evts.map(e => e.key || '')).size,
      };
    });

    res.json({ patterns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/backup/health', (req, res) => {
  res.json({
    status: 'ok',
    modelLoaded: model !== null,
    uptime: process.uptime(),
  });
});

const port = process.env.BACKUP_ML_PORT || 4003;
app.listen(port, () => {
  console.log('Backup ML server running on port', port);
  loadModel();
});
