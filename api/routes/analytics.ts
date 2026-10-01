import express, { Request, Response } from 'express';
import { getVersionUsageMetrics, getDeprecatedRouteMetrics } from '../middleware/apiVersioning.js';

export const router = express.Router();

router.get('/version-usage', (req: Request, res: Response) => {
  const metrics = getVersionUsageMetrics();
  
  res.json({
    timestamp: new Date().toISOString(),
    metrics,
  });
});

router.get('/deprecated-routes', (req: Request, res: Response) => {
  const metrics = getDeprecatedRouteMetrics();
  
  res.json({
    timestamp: new Date().toISOString(),
    metrics,
  });
});

router.get('/adoption', (req: Request, res: Response) => {
  const versionMetrics = getVersionUsageMetrics();
  const deprecatedMetrics = getDeprecatedRouteMetrics();
  
  const totalRequests = Object.values(versionMetrics).reduce(
    (sum: number, metric: any) => sum + (metric.count || 0),
    0
  );
  
  const adoptionRates: Record<string, number> = {};
  Object.entries(versionMetrics).forEach(([version, data]: [string, any]) => {
    adoptionRates[version] = totalRequests > 0 ? (data.count / totalRequests) * 100 : 0;
  });
  
  res.json({
    timestamp: new Date().toISOString(),
    totalRequests,
    adoptionRates,
    deprecatedRouteUsage: deprecatedMetrics,
  });
});
