import type { FeatureSet, TrainingRow } from './types.js';
import { buildTrainingRows, getFeatureVector } from './featureEngineering.js';
import type { OnChainIndicators } from '../../types/sentiment';
import type { PricePoint, SentimentSnapshot } from './types.js';

const FEATURE_COUNT = 21;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function standardizeRows(rows: TrainingRow[]): { rows: number[][]; means: number[]; stds: number[] } {
  const means = Array.from({ length: FEATURE_COUNT }, () => 0);
  const stds = Array.from({ length: FEATURE_COUNT }, () => 1);
  rows.forEach((row) => {
    row.features.forEach((value, index) => {
      means[index] += value;
    });
  });

  means.forEach((value, index) => {
    means[index] = value / Math.max(1, rows.length);
  });

  rows.forEach((row) => {
    row.features.forEach((value, index) => {
      const deviation = value - means[index];
      stds[index] += deviation * deviation;
    });
  });

  stds.forEach((value, index) => {
    stds[index] = Math.sqrt(value / Math.max(1, rows.length));
    if (stds[index] < 0.0001) stds[index] = 1;
  });

  const standardized = rows.map((row) => row.features.map((value, index) => (value - means[index]) / stds[index]));
  return { rows: standardized, means, stds };
}

export interface PricePredictionModel {
  predict(features: FeatureSet): number;
  train(rows: TrainingRow[]): void;
}

class LinearRegressionModel implements PricePredictionModel {
  private weights = Array.from({ length: FEATURE_COUNT }, () => 0);
  private bias = 0;
  private means = Array.from({ length: FEATURE_COUNT }, () => 0);
  private stds = Array.from({ length: FEATURE_COUNT }, () => 1);

  train(rows: TrainingRow[]): void {
    if (!rows.length) return;
    const { rows: standardized, means, stds } = standardizeRows(rows);
    this.means = means;
    this.stds = stds;

    const learningRate = 0.01;
    const epochs = 400;
    for (let epoch = 0; epoch < epochs; epoch += 1) {
      let totalLoss = 0;
      standardized.forEach((features, rowIndex) => {
        const target = rows[rowIndex].target;
        const prediction = this.predictFromStandardized(features);
        const error = prediction - target;
        totalLoss += error * error;
        this.weights.forEach((_, index) => {
          this.weights[index] -= learningRate * error * features[index];
        });
        this.bias -= learningRate * error;
      });
      if (totalLoss < 0.001) break;
    }
  }

  predict(features: FeatureSet): number {
    const values = getFeatureVector(features);
    const standardized = values.map((value, index) => (value - this.means[index]) / this.stds[index]);
    return this.predictFromStandardized(standardized);
  }

  private predictFromStandardized(features: number[]): number {
    const weighted = features.reduce((sum, value, index) => sum + value * this.weights[index], 0) + this.bias;
    return clamp(weighted, -0.4, 0.4);
  }
}

class MomentumModel implements PricePredictionModel {
  predict(features: FeatureSet): number {
    return clamp(features.returns * 0.45 + features.momentum * 0.25 + features.sentimentMomentum * 0.2 + features.onChainMomentum * 0.1, -0.25, 0.25);
  }

  train(): void {
    // Heuristic model does not need training data.
  }
}

class SentimentModel implements PricePredictionModel {
  predict(features: FeatureSet): number {
    return clamp(features.sentimentScore * 0.4 + features.sentimentMomentum * 0.3 + (features.rsi > 70 ? -0.02 : features.rsi < 30 ? 0.02 : 0), -0.2, 0.2);
  }

  train(): void {
    // Heuristic model does not need training data.
  }
}

export class EnsemblePriceModel implements PricePredictionModel {
  private models: PricePredictionModel[];
  private weights: number[];

  constructor(models: PricePredictionModel[] = [], weights: number[] = []) {
    this.models = models;
    this.weights = weights.length ? weights : Array.from({ length: this.models.length }, () => 1 / Math.max(1, this.models.length));
  }

  train(rows: TrainingRow[]): void {
    this.models.forEach((model) => model.train(rows));
  }

  predict(features: FeatureSet): number {
    const weightedPrediction = this.models.reduce((sum, model, index) => sum + model.predict(features) * this.weights[index], 0);
    return clamp(weightedPrediction, -0.3, 0.3);
  }
}

export function trainEnsembleModel(
  history: PricePoint[],
  horizonSteps: number,
  sentimentData: SentimentSnapshot[] = [],
  onChainMetrics?: OnChainIndicators,
): EnsemblePriceModel {
  const rows = buildTrainingRows(history, horizonSteps, sentimentData, onChainMetrics);
  const model = new EnsemblePriceModel([
    new LinearRegressionModel(),
    new MomentumModel(),
    new SentimentModel(),
  ], [0.55, 0.25, 0.2]);
  model.train(rows);
  return model;
}
