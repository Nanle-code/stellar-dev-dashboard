import express from 'express';
import { getRuntimeEnvironment } from '../middleware/auth.js';
import {
  getAIKillSwitch,
  getAIKillSwitchHistory,
  isOperatorTokenValid,
  updateAIKillSwitch,
  validateKillSwitchUpdate,
} from '../services/aiKillSwitch.js';

export const router = express.Router();

function sendUnavailable(res, error) {
  console.error(
    '[ai-controls] Runtime control unavailable:',
    error instanceof Error ? error.message : error
  );
  return res
    .status(503)
    .json({ error: 'ai_control_unavailable', message: 'AI runtime controls are unavailable.' });
}

router.get('/', async (_req, res) => {
  try {
    getRuntimeEnvironment();
    const state = await getAIKillSwitch();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: state });
  } catch (error) {
    return sendUnavailable(res, error);
  }
});

router.get('/audit', async (_req, res) => {
  try {
    getRuntimeEnvironment();
    const history = await getAIKillSwitchHistory();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: history });
  } catch (error) {
    return sendUnavailable(res, error);
  }
});

router.put('/', async (req, res) => {
  const authorization = req.headers.authorization;
  const token =
    typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
  if (!isOperatorTokenValid(token)) {
    return res
      .status(403)
      .json({ error: 'forbidden', message: 'A configured operator token is required.' });
  }

  let update;
  try {
    update = validateKillSwitchUpdate(req.body);
    getRuntimeEnvironment();
  } catch (error) {
    if (error?.status === 400)
      return res.status(400).json({ error: 'invalid_payload', message: error.message });
    return res.status(503).json({
      error: 'unsupported_environment',
      message: 'AI runtime control is unsupported in this environment.',
    });
  }

  try {
    const state = await updateAIKillSwitch(update.enabled, 'configured-operator', update.reason);
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: state });
  } catch (error) {
    return sendUnavailable(res, error);
  }
});
