import express from 'express';
import {
  predictIntent,
  predictNextAction,
  buildOrUpdateProfile,
  getProfile,
  getAccuracy,
  recordPredictionFeedback,
  resetProfile,
} from '../../src/lib/behaviorPrediction.js';
import {
  generateSuggestions,
  recordSuggestionFeedback,
  getSuggestionEffectiveness,
  getState,
  updateState,
} from '../../src/lib/proactiveSuggestions.js';
import {
  getPersonalizationSummary,
  getDashboardAdaptation,
  getSettings,
  updateSettings,
  refreshPersonalization,
  clearPersonalizationData,
} from '../../src/lib/personalizationEngine.js';

export const router = express.Router();

router.use((req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId && req.path !== '/settings') {
    return res.status(400).json({ error: 'x-user-id header or userId query parameter is required' });
  }
  req.userId = userId;
  next();
});

router.post('/predict/intent', async (req, res) => {
  try {
    const { context = 'default' } = req.body || {};
    const prediction = await predictIntent(req.userId, context);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/predict/next-action', async (req, res) => {
  try {
    const prediction = await predictNextAction(req.userId);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/predict/feedback', async (req, res) => {
  try {
    const { predictionId, actualAction, correct } = req.body || {};
    if (!predictionId || !actualAction) {
      return res.status(400).json({ error: 'predictionId and actualAction are required' });
    }
    recordPredictionFeedback({
      predictionId,
      userId: req.userId,
      actualAction,
      correct: Boolean(correct),
      timestamp: Date.now(),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    let profile = getProfile(req.userId);
    if (!profile) {
      profile = await buildOrUpdateProfile(req.userId);
    }
    const accuracy = getAccuracy(req.userId);
    res.json({ success: true, data: { ...profile, accuracy } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/profile/refresh', async (req, res) => {
  try {
    const profile = await buildOrUpdateProfile(req.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/profile', async (req, res) => {
  try {
    resetProfile(req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const context = req.query.context || 'default';
    const suggestions = await generateSuggestions(req.userId, context);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/suggestions/feedback', async (req, res) => {
  try {
    const { suggestionId, action } = req.body || {};
    if (!suggestionId || !action) {
      return res.status(400).json({ error: 'suggestionId and action are required' });
    }
    recordSuggestionFeedback({
      suggestionId,
      userId: req.userId,
      action,
      timestamp: Date.now(),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suggestions/effectiveness', async (req, res) => {
  try {
    const effectiveness = getSuggestionEffectiveness(req.userId);
    res.json({ success: true, data: { effectiveness } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suggestions/settings', async (req, res) => {
  try {
    const state = getState();
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/suggestions/settings', async (req, res) => {
  try {
    const state = updateState(req.body || {});
    res.json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/personalization', async (req, res) => {
  try {
    const summary = await getPersonalizationSummary(req.userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/personalization/dashboard', async (req, res) => {
  try {
    const adaptation = await getDashboardAdaptation(req.userId);
    res.json({ success: true, data: adaptation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/personalization/settings', async (req, res) => {
  try {
    const settings = getSettings(req.userId);
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/personalization/settings', async (req, res) => {
  try {
    const settings = updateSettings(req.userId, req.body || {});
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/personalization/refresh', async (req, res) => {
  try {
    await refreshPersonalization(req.userId);
    const summary = await getPersonalizationSummary(req.userId);
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/personalization', async (req, res) => {
  try {
    await clearPersonalizationData(req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
