import express from 'express';
import { clusterNotifications } from '../services/notificationClustering.js';
import { summarizeCluster } from '../services/notificationSummarizer.js';
import { saveFeedback } from '../services/feedbackStore.js';

export const router = express.Router();

// POST /api/v1/notification-summaries/cluster
router.post('/cluster', (req, res) => {
  const { notifications, options } = req.body || {};
  if (!Array.isArray(notifications)) return res.status(400).json({ error: 'notifications array required' });
  const clusters = clusterNotifications(notifications, options || {});
  res.json({ clusters });
});

// POST /api/v1/notification-summaries/summarize
router.post('/summarize', (req, res) => {
  const { cluster } = req.body || {};
  if (!cluster) return res.status(400).json({ error: 'cluster required in body' });
  const summary = summarizeCluster(cluster);
  res.json({ summary });
});

// POST /api/v1/notification-summaries/feedback
router.post('/feedback', async (req, res) => {
  const { clusterId, correctedSummary, userId } = req.body || {};
  if (!clusterId || !correctedSummary) return res.status(400).json({ error: 'clusterId and correctedSummary required' });
  await saveFeedback({ type: 'notification_summary', clusterId, correctedSummary, userId });
  res.json({ status: 'saved' });
});

export default router;
