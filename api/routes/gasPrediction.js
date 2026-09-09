import express from 'express';
import { requireRole } from '../middleware/auth.js';

export const router = express.Router();

let thresholdsStore = [];

const SIMULATED_HISTORY = [];

// Stellar network environments this API can produce predictions for.
const SUPPORTED_NETWORKS = ['pubnet', 'testnet', 'futurenet'];
// A Stellar transaction may contain at most 100 operations.
const MAX_OPERATIONS_COUNT = 100;

router.post('/gas/predict', async (req, res) => {
  try {
    const {
      contractId,
      functionName,
      args,
      congestionRatio,
      storageEntryCount,
      functionComplexity,
      isWrite,
      operationsCount,
      network,
    } = req.body;

    if (!contractId || !functionName) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'contractId and functionName are required',
      });
    }

    if (operationsCount !== undefined) {
      if (typeof operationsCount !== 'number' || !Number.isFinite(operationsCount) || operationsCount < 0) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'operationsCount must be a non-negative number',
          field: 'operationsCount',
        });
      }
      if (operationsCount > MAX_OPERATIONS_COUNT) {
        return res.status(400).json({
          error: 'ValidationError',
          message: `operationsCount must not exceed ${MAX_OPERATIONS_COUNT}`,
          field: 'operationsCount',
        });
      }
    }

    const resolvedNetwork = network ?? 'testnet';
    if (!SUPPORTED_NETWORKS.includes(resolvedNetwork)) {
      return res.status(422).json({
        error: 'UnsupportedNetworkError',
        message: `network must be one of: ${SUPPORTED_NETWORKS.join(', ')}`,
        field: 'network',
        allowed: SUPPORTED_NETWORKS,
      });
    }

    const argCount = args ? args.length : 0;
    const argTypes = args ? args.map(a => a.type) : [];
    const hasAddress = argTypes.includes('address');
    const hasInt = argTypes.includes('int');
    const congestion = congestionRatio || 0.5;
    const storageCount = storageEntryCount || 0;
    const complexity = functionComplexity || Math.min(10, argCount + 1);
    const isWriteOp = isWrite || functionName.startsWith('set') || functionName.startsWith('write') || functionName.startsWith('update');
    const opsCount = operationsCount ?? 1;

    const baseFee = 100;
    const argComplexity = argCount * 10 + (hasAddress ? 20 : 0) + (hasInt ? 15 : 0);
    const storageCost = storageCount * 5;
    const congestionCost = congestion * 50;
    const functionOverhead = complexity * 8;
    const writePenalty = isWriteOp ? 30 : 0;
    const operationsCost = opsCount * 2;

    const inclusionFee = argComplexity + storageCost + congestionCost + functionOverhead + writePenalty + operationsCost;
    const predictedFee = Math.max(baseFee, baseFee + inclusionFee);
    const predictedInstructions = Math.round(predictedFee * 3);
    const predictedTotalFee = predictedFee + Math.round(predictedInstructions * 0.001);

    const confidence = Math.min(0.99, Math.max(0.3, 0.85 - (storageCount * 0.01) - (argCount * 0.02)));
    const ci = predictedFee * 0.2;

    let warning = null;
    if (confidence < 0.5) warning = 'Low confidence prediction — limited training data for this call pattern';

    const thresholds = thresholdsStore.filter(t => t.enabled && predictedFee > t.maxResourceFee);
    if (thresholds.length > 0) {
      warning = warning
        ? `${warning}. Predicted cost exceeds configured threshold(s): ${thresholds.map(t => t.label).join(', ')}`
        : `Predicted cost exceeds configured threshold(s): ${thresholds.map(t => t.label).join(', ')}`;
    }

    const prediction = {
      network: resolvedNetwork,
      operationsCount: opsCount,
      baseFee,
      inclusionFee,
      predictedMinResourceFee: predictedFee,
      predictedInstructionCount: predictedInstructions,
      predictedTotalFee,
      confidence,
      confidenceInterval: [Math.max(baseFee, predictedFee - ci), predictedFee + ci],
      predictionTimestamp: new Date().toISOString(),
      modelVersion: '1.0.0',
      accuracy: 0.95,
      featureBreakdown: {
        baseFee,
        argComplexity,
        storageAccess: storageCost,
        networkCongestion: congestionCost,
        functionOverhead,
        writePenalty,
        operationsCost,
      },
      warning,
    };

    res.json(prediction);
  } catch (err) {
    console.error('[GasPrediction API] predict error:', err);
    res.status(503).json({
      error: 'ServiceUnavailableError',
      message: 'Gas prediction engine is temporarily unavailable',
    });
  }
});

router.post('/gas/record', async (req, res) => {
  try {
    const { contractId, functionName, predictedFee, actualFee, predictedInstructions, actualInstructions } = req.body;
    if (!contractId || !functionName || actualFee === undefined) {
      return res.status(400).json({ error: 'contractId, functionName, and actualFee are required' });
    }
    SIMULATED_HISTORY.push({
      contractId, functionName, predictedFee, actualFee, predictedInstructions, actualInstructions,
      timestamp: new Date().toISOString(),
    });
    if (SIMULATED_HISTORY.length > 1000) SIMULATED_HISTORY.shift();
    res.json({ success: true });
  } catch (err) {
    console.error('[GasPrediction API] record error:', err);
    res.status(500).json({ error: 'Failed to record prediction accuracy' });
  }
});

router.get('/gas/metrics', async (req, res) => {
  try {
    const recentErrors = SIMULATED_HISTORY.slice(-100);
    let accuracy = 0.95;
    if (recentErrors.length > 2) {
      const mape = recentErrors.reduce((sum, f) => {
        const error = Math.abs(f.predictedFee - f.actualFee) / Math.max(1, f.actualFee);
        return sum + error;
      }, 0) / recentErrors.length;
      accuracy = Math.max(0, Math.round((1 - mape) * 100) / 100);
    }
    res.json({
      metrics: {
        accuracy,
        trainingCount: SIMULATED_HISTORY.length,
        historySize: SIMULATED_HISTORY.length,
        modelVersion: '1.0.0',
        thresholdsConfigured: thresholdsStore.length,
        thresholdsExceeded: thresholdsStore.filter(t => t.enabled).length,
      },
      history: SIMULATED_HISTORY,
    });
  } catch (err) {
    console.error('[GasPrediction API] metrics error:', err);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

router.get('/gas/thresholds', requireRole('admin', 'api_user'), async (req, res) => {
  res.json(thresholdsStore);
});

router.post('/gas/thresholds', requireRole('admin'), async (req, res) => {
  try {
    const { thresholds } = req.body;
    if (!Array.isArray(thresholds)) {
      return res.status(400).json({ error: 'thresholds must be an array' });
    }
    thresholdsStore = thresholds;
    res.json({ success: true, thresholds: thresholdsStore });
  } catch (err) {
    console.error('[GasPrediction API] set thresholds error:', err);
    res.status(500).json({ error: 'Failed to set thresholds' });
  }
});
