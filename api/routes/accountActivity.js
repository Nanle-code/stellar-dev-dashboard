import express from 'express';
import {
  analyzeAccountActivity,
  predictAccountActivity,
  detectDailyPatterns,
  detectWeeklyPatterns,
  detectMonthlyPatterns,
  generateActivityHeatmap,
  generateActivityNotifications,
  estimateModelAccuracy,
  operationsToActivityRecords,
  detectBehaviorChange,
  DEFAULT_MODEL_CONFIG,
} from '../../src/lib/accountActivityModeling.js';

export const router = express.Router();

/**
 * POST /api/v1/activity/analyze
 * Full account activity analysis: predictions, patterns, heatmap, notifications.
 *
 * Body: { records: AccountActivityRecord[], horizon?: 'day'|'week'|'month', calendarEvents?: CalendarEvent[], config?: ActivityModelConfig }
 */
router.post('/analyze', (req, res) => {
  try {
    const { records, horizon = 'week', calendarEvents = [], config } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }
    if (!['day', 'week', 'month'].includes(horizon)) {
      return res.status(400).json({ error: '`horizon` must be one of: day, week, month.' });
    }

    const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...(config ?? {}) };
    const result = analyzeAccountActivity(records, horizon, calendarEvents, mergedConfig);
    return res.json(result);
  } catch (err) {
    console.error('[activity/analyze]', err);
    return res.status(500).json({ error: 'Internal activity modeling error.' });
  }
});

/**
 * POST /api/v1/activity/predict
 * Generate activity predictions for a single horizon.
 *
 * Body: { records: AccountActivityRecord[], horizon?: 'day'|'week'|'month', calendarEvents?: [], config?: {} }
 */
router.post('/predict', (req, res) => {
  try {
    const { records, horizon = 'week', calendarEvents = [], config } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }

    const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...(config ?? {}) };
    const predictions = predictAccountActivity(records, horizon, calendarEvents, mergedConfig);
    return res.json({ predictions, count: predictions.length });
  } catch (err) {
    console.error('[activity/predict]', err);
    return res.status(500).json({ error: 'Internal prediction error.' });
  }
});

/**
 * POST /api/v1/activity/patterns
 * Detect recurring patterns for an account.
 *
 * Body: { records: AccountActivityRecord[] }
 */
router.post('/patterns', (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }

    const daily = detectDailyPatterns(records);
    const weekly = detectWeeklyPatterns(records);
    const monthly = detectMonthlyPatterns(records);
    const behaviorChanged = detectBehaviorChange(records);

    return res.json({
      daily,
      weekly,
      monthly,
      behaviorChanged,
      totalPatterns: daily.length + weekly.length + monthly.length,
    });
  } catch (err) {
    console.error('[activity/patterns]', err);
    return res.status(500).json({ error: 'Internal pattern detection error.' });
  }
});

/**
 * POST /api/v1/activity/heatmap
 * Generate a 24×7 activity heatmap for an account.
 *
 * Body: { records: AccountActivityRecord[] }
 */
router.post('/heatmap', (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }

    const heatmap = generateActivityHeatmap(records);
    return res.json({ heatmap, hours: 24, daysOfWeek: 7 });
  } catch (err) {
    console.error('[activity/heatmap]', err);
    return res.status(500).json({ error: 'Internal heatmap error.' });
  }
});

/**
 * POST /api/v1/activity/notifications
 * Generate proactive activity notifications.
 *
 * Body: { accountId: string, predictions: ActivityPrediction[], records: AccountActivityRecord[], calendarEvents?: [], config?: {} }
 */
router.post('/notifications', (req, res) => {
  try {
    const { accountId, predictions, records, calendarEvents = [], config } = req.body;

    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ error: '`accountId` string is required.' });
    }
    if (!Array.isArray(predictions)) {
      return res.status(400).json({ error: '`predictions` array is required.' });
    }
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }

    const mergedConfig = { ...DEFAULT_MODEL_CONFIG, ...(config ?? {}) };
    const notifications = generateActivityNotifications(
      accountId,
      predictions,
      records,
      calendarEvents,
      mergedConfig,
    );
    return res.json({ notifications, count: notifications.length });
  } catch (err) {
    console.error('[activity/notifications]', err);
    return res.status(500).json({ error: 'Internal notification error.' });
  }
});

/**
 * POST /api/v1/activity/accuracy
 * Estimate model accuracy for a set of records.
 *
 * Body: { records: AccountActivityRecord[] }
 */
router.post('/accuracy', (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: '`records` array is required.' });
    }

    const accuracy = estimateModelAccuracy(records);
    return res.json({ accuracy, accuracyPercent: parseFloat((accuracy * 100).toFixed(1)) });
  } catch (err) {
    console.error('[activity/accuracy]', err);
    return res.status(500).json({ error: 'Internal accuracy estimation error.' });
  }
});

/**
 * POST /api/v1/activity/convert
 * Convert Stellar operation records to AccountActivityRecords.
 *
 * Body: { operations: StellarOperationRecord[], accountId: string, bucket?: 'hourly'|'daily' }
 */
router.post('/convert', (req, res) => {
  try {
    const { operations, accountId, bucket = 'daily' } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: '`operations` array is required.' });
    }
    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ error: '`accountId` string is required.' });
    }
    if (!['hourly', 'daily'].includes(bucket)) {
      return res.status(400).json({ error: '`bucket` must be one of: hourly, daily.' });
    }

    const records = operationsToActivityRecords(operations, accountId, bucket);
    return res.json({ records, count: records.length });
  } catch (err) {
    console.error('[activity/convert]', err);
    return res.status(500).json({ error: 'Internal conversion error.' });
  }
});
