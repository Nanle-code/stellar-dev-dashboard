import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { rateLimiter } from './middleware/rateLimiter.js';
import { oauthAuth } from './middleware/auth.js';
import { router as accountsRouter } from './routes/accounts.js';
import { router as transactionsRouter } from './routes/transactions.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(rateLimiter);

// Public API routes
app.use('/api/v1/accounts', oauthAuth, accountsRouter);
app.use('/api/v1/transactions', oauthAuth, transactionsRouter);

// Documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    version: '1.0',
    description: 'Stellar Dev Dashboard Public API',
    endpoints: {
      '/api/v1/accounts/:accountId': 'GET - Retrieve account data',
      '/api/v1/transactions': 'GET - Query transactions (query params: accountId, limit)',
      '/ws': 'WebSocket - Subscribe to real-time updates'
    }
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
