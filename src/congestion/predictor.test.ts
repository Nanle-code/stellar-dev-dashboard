import { describe, it, expect } from 'vitest';
import { DataPoint, trainModel, forecast } from './predictor';

function generateSyntheticHistory(hours: number): DataPoint[] {
  const out: DataPoint[] = [];
  const now = Date.now() - 24 * 3600_000; // end one day ago
  for (let i = 0; i < hours; i++) {
    const ts = now - (hours - i) * 3600_000;
    const h = new Date(ts).getUTCHours();
    const d = new Date(ts).getUTCDay();
    // base pattern: daily sine
    const base = 100 + 50 * Math.sin((2 * Math.PI * h) / 24) + 20 * Math.cos((2 * Math.PI * d) / 7);
    // active users correlated
    const active = 200 + 30 * Math.sin((2 * Math.PI * h) / 24) + 5 * Math.cos((2 * Math.PI * d) / 7);
    // occasional event spikes at midday
    const event = (h === 12 && (i % 72 === 0)) ? 1 : 0;
    const tx = Math.max(0, Math.round(base + active * 0.2 + event * 200 + (Math.random() - 0.5) * 20));
    out.push({ ts, txCount: tx, activeUsers: Math.round(active), eventFlag: event });
  }
  return out;
}

describe('congestion predictor (synthetic)', () => {
  it('achieves >=80% accuracy on 6-hour horizon (synthetic)', () => {
    const history = generateSyntheticHistory(24 * 20); // 20 days hourly
    const model = trainModel(history, 0.9);
    // choose recent point as last history
    const recent = history[history.length - 1];
    // create ground-truth future using deterministic pattern (no randomness)
    const future: DataPoint[] = [];
    for (let h = 1; h <= 6; h++) {
      const ts = recent.ts + h * 3600_000;
      const hour = new Date(ts).getUTCHours();
      const day = new Date(ts).getUTCDay();
      const base = 100 + 50 * Math.sin((2 * Math.PI * hour) / 24) + 20 * Math.cos((2 * Math.PI * day) / 7);
      const active = 200 + 30 * Math.sin((2 * Math.PI * hour) / 24) + 5 * Math.cos((2 * Math.PI * day) / 7);
      const event = (hour === 12 && (h % 3 === 0)) ? 1 : 0;
      const tx = Math.max(0, Math.round(base + active * 0.2 + event * 200));
      future.push({ ts, txCount: tx, activeUsers: Math.round(active), eventFlag: event });
    }
    const events = future.map(f => f.eventFlag || 0);
    const fc = forecast(model, recent, 6, events);
    // evaluate binary congestion: actual > model.threshold
    const actual = future.map(f => (f.txCount > model.threshold ? 1 : 0));
    const predicted = fc.map(f => (f.probability > 0.5 ? 1 : 0));
    let correct = 0;
    for (let i = 0; i < actual.length; i++) if (actual[i] === predicted[i]) correct++;
    const accuracy = correct / actual.length;
    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});
