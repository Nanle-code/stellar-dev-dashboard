import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent, flushEvents, setAnalyticsEndpoint } from '../analytics';
import { getProviderStats, resetProviderCircuitBreaker } from '../providerCircuitBreaker';

describe('analytics provider circuit breaker', () => {
  beforeEach(() => {
    resetProviderCircuitBreaker('analytics');
    setAnalyticsEndpoint('https://analytics.example.test/collect');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetProviderCircuitBreaker('analytics');
    setAnalyticsEndpoint(null);
  });

  it('delivers queued events through the breaker on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('unit_test');
    await flushEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getProviderStats('analytics').state).toBe('CLOSED');
  });

  it('opens the circuit after repeated failures and stops hitting the network', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('collector unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    for (let i = 0; i < 3; i += 1) {
      trackEvent(`event_${i}`);
      await flushEvents();
    }

    expect(getProviderStats('analytics').state).toBe('OPEN');

    trackEvent('event_after_open');
    const requestsBefore = fetchMock.mock.calls.length;
    await flushEvents();

    expect(fetchMock.mock.calls.length).toBe(requestsBefore);
  });
});
