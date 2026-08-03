// src/lib/liquidityModel.ts

/**
 * LiquidityModel: Wraps a TensorFlow.js LSTM model for liquidity prediction.
 * The model is loaded from the file system (saved via tfjs `model.save('file://...')`).
 * It provides `predict` for a feature vector and utilities for training.
 */

import * as tf from '@tensorflow/tfjs-node';
import { TimeSeriesFeatures, LiquidityPredictionResult } from '../ml/liquidityPredictionModel';

export class LiquidityModel {
  private model: tf.LayersModel | null = null;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  /** Load the TensorFlow.js model from disk */
  async loadModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
      console.info('[LiquidityModel] Model loaded from', this.modelPath);
    } catch (err) {
      console.error('[LiquidityModel] Failed to load model:', err);
      throw err;
    }
  }

  /** Predict liquidity index and related metrics given a feature vector */
  async predict(features: TimeSeriesFeatures): Promise<Partial<LiquidityPredictionResult>> {
    if (!this.model) {
      await this.loadModel();
    }
    // Convert features to tensor
    const tensor = tf.tensor2d([Object.values(features)], [1, Object.keys(features).length]);
    const raw = this.model!.predict(tensor) as tf.Tensor;
    const data = (await raw.array()) as number[][];
    // Assuming model output shape: [predictedLiquidityDelta]
    const predictedDelta = data[0][0];
    // Return a minimal result; the engine will merge with other calculations
    return {
      predictedLiquidityIndex: predictedDelta,
    };
  }
}
