import express from 'express';
import {
  analyzeTransactionVolume,
  forecastVolume,
  detectVolumeAnomalies,
  evaluateVolumeAlerts,
  ledgerRecordsToVolumePoints,
  shouldRetrain,
  computeRetrainingConfig,
} from '../../src/lib/transactionVolumeForecasting.js';

export const router = express.Router();

/**
 * POST /api/v1/forecasting/volume/analyze
 * Full transaction volume analysis: forecasts + anomalies + alerts.
 *
 * Body: { points: VolumeDataPoint[], alerts?: VolumeAlert[], lastTrainedAt?: string }
 */
router.post('/analyze', (req, res) => {
  try {
    const { points, alerts = [], lastTrainedAt } = req.body;

    if (!Array.isArray(points)) {
      return res.status(400).json({ error: '`points` array is required.' });
    }

    const result = analyzeTransactionVolume(points, alerts, lastTrainedAt);
    return res.json(result);
  } catch (err) {
    console.error('[volume/analyze]', err);
    return res.status(500).json({ error: 'Internal forecasting error.' });
  }
});

/**
 * POST /api/v1/forecasting/volume/forecast
 * Generate a forecast for a single horizon.
 *
 * Body: { points: VolumeDataPoint[], horizon: 'hourly'|'daily'|'weekly', steps?: number }
 */
router.post('/forecast', (req, res) => {
  try {
    const { points, horizon = 'daily', steps } = req.body;

    if (!Array.isArray(points)) {
      return res.status(400).json({ error: '`points` array is required.' });
    }
    if (!['hourly', 'daily', 'weekly'].includes(horizon)) {
      return res.status(400).json({ error: '`horizon` must be one of: hourly, daily, weekly.' });
    }

    const forecast = forecastVolume(points, horizon, steps);
    return res.json(forecast);
  } catch (err) {
    console.error('[volume/forecast]', err);
    return res.status(500).json({ error: 'Internal forecasting error.' });
  }
});

/**
 * POST /api/v1/forecasting/volume/anomalies
 * Detect volume anomalies in historical data.
 *
 * Body: { points: VolumeDataPoint[] }
 */
router.post('/anomalies', (req, res) => {
  try {
    const { points } = req.body;

    if (!Array.isArray(points)) {
      return res.status(400).json({ error: '`points` array is required.' });
    }

    const anomalies = detectVolumeAnomalies(points);
    return res.json({ anomalies, count: anomalies.length });
  } catch (err) {
    console.error('[volume/anomalies]', err);
    return res.status(500).json({ error: 'Internal anomaly detection error.' });
  }
});

/**
 * POST /api/v1/forecasting/volume/alerts/evaluate
 * Evaluate volume alerts against forecasts.
 *
 * Body: { alerts: VolumeAlert[], forecasts: Record<ForecastHorizon, VolumeForecast> }
 */
router.post('/alerts/evaluate', (req, res) => {
  try {
    const { alerts, forecasts } = req.body;

    if (!Array.isArray(alerts)) {
      return res.status(400).json({ error: '`alerts` array is required.' });
    }
    if (!forecasts || typeof forecasts !== 'object') {
      return res.status(400).json({ error: '`forecasts` object is required.' });
    }

    const triggered = evaluateVolumeAlerts(alerts, forecasts);
    return res.json({ triggered, count: triggered.length });
  } catch (err) {
    console.error('[volume/alerts/evaluate]', err);
    return res.status(500).json({ error: 'Internal alert evaluation error.' });
  }
});

/**
 * POST /api/v1/forecasting/volume/convert
 * Convert ledger records to VolumeDataPoints.
 *
 * Body: { records: LedgerRecord[], bucket?: 'hourly'|'daily' }
 */
router.post('/convert', (req, res) => {
  try {
    const { records, bucket = 'daily' } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }
    if (!['hourly', 'daily'].includes(bucket)) {
      return res.status(400).json({ error: '`bucket` must be one of: hourly, daily.' });
    }

    const points = ledgerRecordsToVolumePoints(records, bucket);
    return res.json({ points, count: points.length });
  } catch (err) {
    console.error('[volume/convert]', err);
    return res.status(500).json({ error: 'Internal conversion error.' });
  }
});

/**
 * GET /api/v1/forecasting/volume/retraining-status
 * Check if the model should be retrained.
 *
 * Query: lastTrainedAt (ISO string, optional)
 */
router.get('/retraining-status', (req, res) => {
  try {
    const { lastTrainedAt } = req.query;
    const config = computeRetrainingConfig(
      typeof lastTrainedAt === 'string' ? lastTrainedAt : undefined,
    );
    const needsRetrain = shouldRetrain(config);
    return res.json({ needsRetrain, config });
  } catch (err) {
    console.error('[volume/retraining-status]', err);
    return res.status(500).json({ error: 'Internal error.' });
  }
});
