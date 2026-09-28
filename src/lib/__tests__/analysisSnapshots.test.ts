import { describe, expect, it } from 'vitest';
import { createAnalysisSnapshot, parseAnalysisSnapshot, serializeAnalysisSnapshot } from '../analysisSnapshots';

const input = {
  title: 'Operations review',
  query: { metric: 'operations', filters: { network: 'testnet' }, capturedAt: '2026-09-27T10:00:00.000Z' },
  chart: { type: 'area', series: ['operations'], config: { showGrid: true } },
};

describe('analysis snapshots', () => {
  it('round-trips query, chart configuration, and timestamps', () => {
    const snapshot = createAnalysisSnapshot({ ...input, createdAt: '2026-09-27T10:01:00.000Z' });
    expect(parseAnalysisSnapshot(serializeAnalysisSnapshot(snapshot))).toEqual(snapshot);
  });

  it('rejects incomplete snapshots', () => {
    expect(() => createAnalysisSnapshot({ ...input, title: ' ' })).toThrow(/required/);
    expect(() => parseAnalysisSnapshot('{"version":99}')).toThrow(/Unsupported/);
  });

  it('rejects malformed JSON and invalid timestamps', () => {
    expect(() => parseAnalysisSnapshot('{')).toThrow(/valid JSON/);
    expect(() => createAnalysisSnapshot({ ...input, createdAt: 'not-a-date' })).toThrow(/timestamp/);
  });
});
