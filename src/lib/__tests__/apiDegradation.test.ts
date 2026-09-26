import { describe, expect, it } from 'vitest';
import {
  DEGRADED_ERROR_RATE_PCT,
  DEGRADED_LATENCY_MS,
  classifyServiceHealth,
  computeRetryDelayMs,
  evaluateApiDegradation,
} from '../apiDegradation';

describe('classifyServiceHealth', () => {
  it('classifies a reachable, fast service as operational', () => {
    const result = classifyServiceHealth({ service: 'horizon', reachable: true, latencyMs: 120 });
    expect(result.health).toBe('operational');
    expect(result.service).toBe('horizon');
  });

  it('classifies an unreachable service as an outage', () => {
    const result = classifyServiceHealth({ service: 'soroban-rpc', reachable: false });
    expect(result.health).toBe('outage');
    expect(result.reason).toMatch(/unreachable/i);
  });

  it('treats slow latency and elevated error rate as degraded', () => {
    const slow = classifyServiceHealth({ service: 'horizon', reachable: true, latencyMs: DEGRADED_LATENCY_MS + 1 });
    const erroring = classifyServiceHealth({ service: 'price-feed', reachable: true, errorRatePct: DEGRADED_ERROR_RATE_PCT });
    expect(slow.health).toBe('degraded');
    expect(erroring.health).toBe('degraded');
  });

  it('maps alphanumeric aliases onto canonical service names', () => {
    expect(classifyServiceHealth({ service: 'Horizon-Testnet', reachable: true }).service).toBe('horizon');
    expect(classifyServiceHealth({ service: 'Soroban-RPC', reachable: true }).service).toBe('soroban-rpc');
  });
});

describe('computeRetryDelayMs', () => {
  it('grows exponentially and caps out', () => {
    expect(computeRetryDelayMs(0)).toBe(1_500);
    expect(computeRetryDelayMs(1)).toBe(3_000);
    expect(computeRetryDelayMs(2)).toBe(6_000);
    expect(computeRetryDelayMs(50)).toBe(60_000);
  });

  it('normalises invalid attempt values instead of returning NaN', () => {
    expect(computeRetryDelayMs(-5)).toBe(1_500);
    expect(computeRetryDelayMs(Number.NaN)).toBe(1_500);
  });
});

describe('evaluateApiDegradation', () => {
  it('hides the banner when all services are operational', () => {
    const banner = evaluateApiDegradation([{ service: 'horizon', reachable: true, latencyMs: 80 }]);
    expect(banner.visible).toBe(false);
    expect(banner.severity).toBe('info');
  });

  it('hides the banner for unknown-only signals (no false alarms)', () => {
    const banner = evaluateApiDegradation([{ service: 'horizon' }, { service: 'soroban-rpc', reachable: null }]);
    expect(banner.visible).toBe(false);
    expect(banner.unknown).toHaveLength(2);
  });

  it('surfaces a critical, retryable banner for outages', () => {
    const banner = evaluateApiDegradation(
      [
        { service: 'horizon', reachable: false, message: 'connection refused' },
        { service: 'soroban-rpc', reachable: true, latencyMs: 50 },
      ],
      { attempt: 1 }
    );
    expect(banner.visible).toBe(true);
    expect(banner.severity).toBe('critical');
    expect(banner.affected).toHaveLength(1);
    expect(banner.retry.retryable).toBe(true);
    expect(banner.retry.suggestedDelayMs).toBe(3_000);
    expect(banner.retry.steps.join(' ')).toMatch(/retry/i);
  });

  it('surfaces a warning banner for degraded-but-reachable services', () => {
    const banner = evaluateApiDegradation([
      { service: 'soroban-rpc', reachable: true, latencyMs: DEGRADED_LATENCY_MS * 3 },
    ]);
    expect(banner.visible).toBe(true);
    expect(banner.severity).toBe('warning');
    expect(banner.detail).toMatch(/slow/i);
  });

  it('never throws on malformed input and reports it as unknown', () => {
    const banner = evaluateApiDegradation([
      null as unknown as never,
      'not-an-object' as unknown as never,
      { service: 42, reachable: 'yes' },
    ]);
    expect(banner.visible).toBe(false);
    expect(banner.unknown).toHaveLength(3);
  });

  it('returns an empty, hidden banner for null/undefined lists', () => {
    expect(evaluateApiDegradation(null).visible).toBe(false);
    expect(evaluateApiDegradation(undefined).affected).toEqual([]);
  });
});
