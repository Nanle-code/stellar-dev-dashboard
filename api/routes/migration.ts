import express, { Request, Response } from 'express';
import {
  getMigrationGuide,
  getAllMigrationGuides,
  checkVersionCompatibility,
  getBreakingChanges,
  getSunsetPolicy,
  getVersionInfo,
} from '../utils/migrationTools.js';

export const router = express.Router();

router.get('/guides', (req: Request, res: Response) => {
  const guides = getAllMigrationGuides();
  
  res.json({
    guides,
    policy: getSunsetPolicy(),
  });
});

router.get('/guides/:from/:to', (req: Request, res: Response) => {
  const { from, to } = req.params;
  const guide = getMigrationGuide(from, to);
  
  if (!guide) {
    return res.status(404).json({
      error: 'Migration guide not found',
      message: `No migration guide available from ${from} to ${to}`,
    });
  }
  
  res.json(guide);
});

router.get('/compatibility/:version', (req: Request, res: Response) => {
  const { version } = req.params;
  const compatibility = checkVersionCompatibility(version);
  
  res.json(compatibility);
});

router.get('/breaking-changes', (req: Request, res: Response) => {
  const { from } = req.query;
  const changes = getBreakingChanges(from ? String(from) : undefined);
  
  res.json({
    changes,
    timestamp: new Date().toISOString(),
  });
});

router.get('/version-info', (req: Request, res: Response) => {
  const info = getVersionInfo();
  
  res.json({
    ...info,
    timestamp: new Date().toISOString(),
  });
});

router.get('/sunset-policy', (req: Request, res: Response) => {
  const policy = getSunsetPolicy();
  
  res.json({
    policy,
    timestamp: new Date().toISOString(),
  });
});
