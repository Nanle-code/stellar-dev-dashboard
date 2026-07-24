import { recordMetric, incrementCounter } from '../../utils/metricsCollector.js';
import type { PredictionOutcome } from './types.js';

interface EvaluationRecord {
  timestamp: number;
  predicted: number;
  actual: number;
  previous: number;
  timeframe: string;
}

const history: EvaluationRecord[] = [];
const MAX_HISTORY = 200;

export function recordPredictionOutcome(outcome: PredictionOutcome, actualPrice: number): void {
  const delta = actualPrice > 0 ? (outcome.predictedPrice - actualPrice) / actualPrice : 0;
  history.push({
    timestamp: Date.now(),
    predicted: outcome.predictedPrice,
    actual: actualPrice,
    previous: outcome.observedFeatures.close,
    timeframe: outcome.timeframe,
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }

  incrementCounter('model.price.predictions', 1, { timeframe: outcome.timeframe });
  recordMetric('model.price.error', Math.abs(delta), { timeframe: outcome.timeframe });
}

export function getPerformanceSnapshot(): { rollingAccuracy: number; samples: number } {
  if (!history.length) {
    return { rollingAccuracy: 0.7, samples: 0 };
  }

  const recent = history.slice(-Math.min(20, history.length));
  const correct = recent.filter((entry) => {
    const previousPrice = entry.previous || entry.actual;
    const actualDirection = entry.actual >= previousPrice ? 'up' : 'down';
    const predictedDirection = entry.predicted >= previousPrice ? 'up' : 'down';
    return actualDirection === predictedDirection;
  });

  const rollingAccuracy = correct.length / recent.length;
  return {
    rollingAccuracy,
    samples: recent.length,
  };
}

export function getModelPerformance(): { accuracy: number; samples: number } {
  const snapshot = getPerformanceSnapshot();
  return {
    accuracy: snapshot.rollingAccuracy,
    samples: snapshot.samples,
  };
}
