import * as tf from '@tensorflow/tfjs';
import { trainModel } from './predictor.js';

async function main() {
  console.log('[upgrade_impact] Starting training pipeline...');

  try {
    const result = await trainModel(tf);
    if (result.trained) {
      console.log(`[upgrade_impact] Model trained successfully on ${result.samples} samples (${result.epochs} epochs)`);
    } else {
      console.log(`[upgrade_impact] Training skipped: ${result.reason} (${result.samples}/${result.minRequired})`);
    }
  } catch (err) {
    console.error('[upgrade_impact] Training failed:', err.message);
    process.exit(1);
  }
}

main();
