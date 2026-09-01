import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { rateLimiter } from './middleware/rateLimiter.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { apiVersioningMiddleware } from './middleware/apiVersioning.js';
import { oauthAuth } from './middleware/auth.js';
import { router as accountsRouter } from './routes/accounts.js';
import { router as transactionsRouter } from './routes/transactions.js';
import liquidityRouter from './routes/liquidity.js';
import liquidityPredictionRouter from './routes/liquidityPrediction.js';
import { router as accessControlRouter } from './routes/accessControl.js';
import { router as notificationSummariesRouter } from './routes/notificationSummaries.js';
import { router as gasPredictionRouter } from './routes/gasPrediction.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(apiVersioningMiddleware);
app.use(idempotencyMiddleware);
app.use(rateLimiter);

// Public API routes
app.use('/api/v1/accounts', oauthAuth, accountsRouter);
app.use('/api/v1/transactions', oauthAuth, transactionsRouter);
app.use('/api/v1/liquidity', liquidityRouter);
app.use('/api/v1', liquidityPredictionRouter);
app.use('/api/v1/access-control', oauthAuth, accessControlRouter);
app.use('/api/v1/notification-summaries', oauthAuth, notificationSummariesRouter);
app.use('/api/v1', gasPredictionRouter);

// Documentation endpoint
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
      '/ws': 'WebSocket - Subscribe to real-time updates'
    }
  });
});

app.get('/api/docs/idempotency', (_req, res) => {
  res.json({
    header: 'Idempotency-Key',
    supportedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    format: '1–128 characters; letters, numbers, hyphens, and underscores only',
    replayHeader: 'Idempotency-Replayed',
    ttlHours: 24,
    errors: {
      409: 'Key reused with a different payload or a concurrent duplicate is in progress',
      422: 'Malformed or missing Idempotency-Key when supplied',
    },
    documentation: 'docs/api/IDEMPOTENCY.md',
  });
});

// WebSocket support for real-time updates
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  ws.send(JSON.stringify({ type: 'connected', message: 'Successfully connected to real-time updates.' }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'subscribe') {
        ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Simulate real-time updates
  const interval = setInterval(() => {
    ws.send(JSON.stringify({ type: 'update', data: { timestamp: new Date().toISOString(), status: 'active' } }));
  }, 10000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('WebSocket client disconnected');
  });
});

const PORT = process.env.API_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Public API server running on port ${PORT}`);
});