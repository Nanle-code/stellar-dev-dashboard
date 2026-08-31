import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { rateLimiter } from './middleware/rateLimiter.js';
import { oauthAuth, requireRole, getRuntimeEnvironment } from './middleware/auth.js';
import { router as accountsRouter } from './routes/accounts.js';
import { router as transactionsRouter } from './routes/transactions.js';
import { router as behaviorRouter } from './routes/behavior.js';
import { router as accessControlRouter } from './routes/accessControl.js';
import { router as notificationSummariesRouter } from './routes/notificationSummaries.js';
import { router as gasPredictionRouter } from './routes/gasPrediction.js';

export const app = express();
export const server = createServer(app);
export const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(apiVersioningMiddleware);
app.use(idempotencyMiddleware);
app.use(rateLimiter);

getRuntimeEnvironment();

app.use('/api/v1/accounts', oauthAuth, accountsRouter);
app.use('/api/v1/transactions', oauthAuth, transactionsRouter);
app.use('/api/v1/behavior', oauthAuth, behaviorRouter);
app.use('/api/v1/access-control', oauthAuth, requireRole('admin'), accessControlRouter);
app.use('/api/v1/notification-summaries', oauthAuth, notificationSummariesRouter);
app.use('/api/v1', oauthAuth, gasPredictionRouter);

app.get('/api/docs', (req, res) => {
  res.json({
    apiVersion: '1.0.0',
    version: '1.0',
    description: 'Stellar Dev Dashboard Public API',
    idempotency: {
      header: 'Idempotency-Key',
      methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
      docs: '/api/docs/idempotency',
      notes:
        'Optional on mutating proxy calls. Retries with the same key and payload replay the original response.',
    },
    endpoints: {
      '/api/v1/accounts/:accountId': 'GET - Retrieve account data',
      '/api/v1/transactions': 'GET - Query transactions (query params: accountId, limit)',
      '/api/v1/liquidity': 'GET - Liquidity predictions and metrics',
      '/api/v1/behavior': 'Behavior prediction, suggestions, personalization',
      '/api/v1/behavior/predict/intent': 'POST - Predict user intent',
      '/api/v1/behavior/predict/next-action': 'POST - Predict next user action',
      '/api/v1/behavior/profile': 'GET - Get behavior profile',
      '/api/v1/behavior/suggestions': 'GET - Get proactive suggestions',
      '/api/v1/behavior/personalization': 'GET - Get personalization summary',
      '/api/v1/behavior/personalization/settings': 'GET/PUT - Personalization settings',
      '/api/v1/notification-summaries': 'GET - Retrieve notification summaries',
      '/api/v1/gas/predict': 'POST - Predict gas cost for contract call',
      '/api/v1/gas/record': 'POST - Record actual gas cost for accuracy',
      '/api/v1/gas/metrics': 'GET - Gas prediction accuracy metrics',
      '/api/v1/gas/thresholds': 'GET/POST - Cost threshold configuration',
      '/ws': 'WebSocket - Subscribe to real-time updates',
    },
  });
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'Successfully connected to real-time updates.' }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'update', data: { timestamp: new Date().toISOString(), status: 'active' } }));
  }, 10000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('WebSocket client disconnected');
  });
});

const PORT = process.env.API_PORT || 4000;

if (process.argv[1] && process.argv[1].endsWith('api/server.js')) {
  server.listen(PORT, () => {
    console.log(`Public API server running on port ${PORT}`);
  });
}