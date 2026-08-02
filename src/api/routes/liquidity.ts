import { Router, Request, Response } from 'express';
import { checkLiquidityAlertRules } from '../../lib/liquidityAlerts';
import { cacheMiddleware } from '../middleware/predictCache';
import { POPULAR_DEX_PAIRS, liquidityEngine } from '../../lib/liquidityEngine';
import { getModelMetrics } from '../../ml/liquidityPredictionModel';

const router = Router();

// GET prediction for a specific trading pair (uses ML model via LiquidityEngine)
router.get('/v1/liquidity/predict', cacheMiddleware, async (req: Request, res: Response) => {
  const pair = req.query.pair as string;
  if (pair) {
    const pairObj = POPULAR_DEX_PAIRS.find(p => p.id === pair);
    if (pairObj) {
      liquidityEngine.setActivePair(pairObj);
    }
  }
  try {
    const prediction = await liquidityEngine.refreshPredictions();
    // Run alert rules and fire notifications if conditions are met
    checkLiquidityAlertRules(prediction);
    res.json(prediction);
  } catch (err) {
    console.error('Liquidity prediction error', err);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// GET model health & metrics (deterministic metrics from model code)
router.get('/v1/liquidity/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = getModelMetrics();
    res.json(metrics);
  } catch (err) {
    console.error('Metrics error', err);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

export default router;
