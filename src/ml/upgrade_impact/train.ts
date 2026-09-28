import * as tf from '@tensorflow/tfjs';
import { trainModel } from './predictor.js';
import { logger } from '../../lib/logging/index.js';

async function main() {
  logger.info('[upgrade_impact] Starting training pipeline...');

  try {
    const result = await trainModel(tf);
    if (result.trained) {
      logger.info(`[upgrade_impact] Model trained successfully on ${result.samples} samples (${result.epochs} epochs)`);
    } else {
      logger.info(`[upgrade_impact] Training skipped: ${result.reason} (${result.samples}/${result.minRequired})`);
    }
  } catch (err: any) {
    logger.error('[upgrade_impact] Training failed:', undefined, undefined, err instanceof Error ? err : new Error(String(err?.message || err)));
    process.exit(1);
  }
}

main();
