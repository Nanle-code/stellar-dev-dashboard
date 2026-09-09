import express from 'express';
import { analyzeAccessPatterns, recordAppliedRecommendations } from '../../src/accessControl/engine.js';
import { requireRole } from '../middleware/auth.js';

export const router = express.Router();

router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  return next();
});

// GET /api/v1/access-control/recommendations?since=2026-07-01
router.get('/recommendations', requireRole('admin', 'api_user'), async (req, res) => {
  try {
    const { since } = req.query;
    const result = await analyzeAccessPatterns({ since });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'analysis_failed', message: String(err) });
  }
});

// POST /api/v1/access-control/apply
// body: { applied: [ { user, type, ... } ] }
router.post('/apply', requireRole('admin'), async (req, res) => {
  try {
    const { applied } = req.body || {};
    if (!Array.isArray(applied)) return res.status(400).json({ error: 'invalid_payload' });
    const updated = await recordAppliedRecommendations(applied);
    res.json({ status: 'ok', updated });
  } catch (err) {
    res.status(500).json({ error: 'record_failed', message: String(err) });
  }
});
