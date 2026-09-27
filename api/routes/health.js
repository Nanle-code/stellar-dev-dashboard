import express from 'express';
import { getRuntimeEnvironment } from '../middleware/auth.js';

export const router = express.Router();

let simulatedFailure = null;

/**
 * Reset simulated failure (used in tests).
 */
export function _resetSimulatedFailure() {
  simulatedFailure = null;
}

/**
 * Configure simulated failure for testing failure paths and error budget breaches.
 * Only active in test, development, or canary environments.
 */
export function _setSimulatedFailure(config) {
  simulatedFailure = config;
}

// Liveness probe — fast, lightweight, unauthenticated check for container orchestrators and canary monitors.
router.get('/', (req, res) => {
  if (simulatedFailure) {
    const statusCode = simulatedFailure.statusCode || 503;
    return res.status(statusCode).json({
      status: 'error',
      message: simulatedFailure.message || 'Simulated health probe failure',
      environment: getRuntimeEnvironment(),
      timestamp: new Date().toISOString(),
    });
  }

  const env = getRuntimeEnvironment();
  return res.status(200).json({
    status: 'ok',
    service: 'api',
    version: '1.0.0',
    environment: env,
    canary: process.env.CANARY === 'true',
    uptime: Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
  });
});

// Deep readiness probe — verifies memory limits, optional Redis connectivity, and subsystem state.
router.get('/deep', async (req, res) => {
  if (simulatedFailure) {
    const statusCode = simulatedFailure.statusCode || 503;
    return res.status(statusCode).json({
      status: 'unhealthy',
      message: simulatedFailure.message || 'Simulated readiness failure',
      environment: getRuntimeEnvironment(),
      timestamp: new Date().toISOString(),
    });
  }

  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);

  // Memory health check (flag if heap usage exceeds 1.5GB)
  const memoryStatus = heapUsedMb > 1536 ? 'degraded' : 'ok';

  // Optional Redis check if REDIS_URL is provided
  let redisStatus = 'not_configured';
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      await redis.connect();
      const ping = await redis.ping();
      redisStatus = ping === 'PONG' ? 'connected' : 'degraded';
      await redis.quit();
    } catch {
      redisStatus = 'unavailable';
    }
  }

  const isHealthy = memoryStatus !== 'unhealthy' && redisStatus !== 'unavailable';

  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    service: 'api',
    version: '1.0.0',
    environment: getRuntimeEnvironment(),
    canary: process.env.CANARY === 'true',
    uptime: Math.round(process.uptime() * 100) / 100,
    timestamp: new Date().toISOString(),
    checks: {
      memory: {
        status: memoryStatus,
        heapUsedMb,
        heapTotalMb,
        rssMb,
      },
      redis: {
        status: redisStatus,
        configured: Boolean(process.env.REDIS_URL),
      },
      routes: {
        status: 'ok',
        accounts: '/api/v1/accounts/:accountId',
        transactions: '/api/v1/transactions',
        gasPredict: '/api/v1/gas/predict',
        docs: '/api/docs',
      },
    },
  });
});

// Simulation endpoint for end-to-end rehearsal of canary auto-abort (restricted to test/dev/canary)
router.post('/simulate-failure', (req, res) => {
  const currentEnv = getRuntimeEnvironment();
  if (currentEnv === 'production' && process.env.CANARY !== 'true') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Simulated failure injection is disabled in standard production.',
    });
  }

  const { enabled = true, statusCode = 503, message = 'Simulated canary failure' } = req.body || {};
  if (enabled) {
    simulatedFailure = { statusCode, message };
  } else {
    simulatedFailure = null;
  }

  return res.json({
    simulationActive: Boolean(simulatedFailure),
    config: simulatedFailure,
  });
});
