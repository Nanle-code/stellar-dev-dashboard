// src/api/routes/liquidityPrediction.ts
import { Router, Request, Response } from 'express';
import { cacheMiddleware } from '../middleware/predictCache';
import { liquidityEngine } from '../../src/lib/liquidityEngine';

const router = Router();

// POST endpoint – expects JSON body { pair: string }
router.post('/v1/transactions/liquidity-prediction', cacheMiddleware, async (req: Request, res: Response) => {
  const { pair } = req.body;
  if (!pair) {
    return res.status(400).json({ error: 'Missing required field: pair' });
  }
  // Preserve current pair
  const previousPair = liquidityEngine.getActivePair();
  // Temporarily set the requested pair (base/counter placeholders for demo)
  liquidityEngine.setActivePair({
    id: pair,
    name: pair,
    base: 'native',
    counter: pair.split(':')[1] ?? ''
  });
  try {
    const prediction = await liquidityEngine.refreshPredictions();
    res.json(prediction);
  } catch (err) {
    console.error('[LiquidityPrediction API] error', err);
    res.status(500).json({ error: 'Failed to generate prediction' });
  } finally {
    // Restore original pair
    liquidityEngine.setActivePair(previousPair);
  }
});

export default router;
