import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasCurrentAnalyticsConsent,
  needsAnalyticsConsentReview,
  saveAnalyticsConsentDecision,
} from '../analyticsConsent';
import { ANALYTICS_POLICY_VERSION } from '../preferences';
import { flushEvents, setAnalyticsEndpoint, trackEvent } from '../analytics';
import { resetProviderCircuitBreaker } from '../providerCircuitBreaker';

vi.mock('../logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('versioned analytics consent', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProviderCircuitBreaker('analytics');
    setAnalyticsEndpoint('https://analytics.example.test/collect');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    setAnalyticsEndpoint(null);
    resetProviderCircuitBreaker('analytics');
    // Clearing saved preferences revokes the module's in-memory test override.
    saveAnalyticsConsentDecision(false);
  });

  it('records an explicit choice against the reviewed policy version', () => {
    expect(hasCurrentAnalyticsConsent()).toBe(false);
    expect(needsAnalyticsConsentReview()).toBe(true);

    saveAnalyticsConsentDecision(true);

    expect(hasCurrentAnalyticsConsent()).toBe(true);
    expect(needsAnalyticsConsentReview()).toBe(false);
    expect(JSON.parse(localStorage.getItem('user-preferences') || '{}')).toMatchObject({
      analyticsConsent: true,
      diagnosticsConsent: true,
      analyticsConsentPolicyVersion: ANALYTICS_POLICY_VERSION,
      analyticsConsentReviewedVersion: ANALYTICS_POLICY_VERSION,
    });

    saveAnalyticsConsentDecision(false);
    expect(hasCurrentAnalyticsConsent()).toBe(false);
  });

  it('requires review and disables tracking when an accepted policy version is stale', () => {
    localStorage.setItem('user-preferences', JSON.stringify({
      analyticsConsent: true,
      diagnosticsConsent: true,
      analyticsConsentPolicyVersion: 'older-policy',
      analyticsConsentReviewedVersion: 'older-policy',
    }));

    expect(hasCurrentAnalyticsConsent()).toBe(false);
    expect(needsAnalyticsConsentReview()).toBe(true);
  });

  it('treats malformed stored preferences and invalid choices as no consent', () => {
    localStorage.setItem('user-preferences', '{invalid json');

    expect(hasCurrentAnalyticsConsent()).toBe(false);
    expect(needsAnalyticsConsentReview()).toBe(true);
    expect(() => saveAnalyticsConsentDecision('yes' as unknown as boolean)).toThrow(TypeError);
  });

  it('does not keep telemetry enabled when the accepted and reviewed versions disagree', () => {
    localStorage.setItem('user-preferences', JSON.stringify({
      analyticsConsent: true,
      analyticsConsentPolicyVersion: ANALYTICS_POLICY_VERSION,
      analyticsConsentReviewedVersion: 'older-policy',
    }));

    expect(hasCurrentAnalyticsConsent()).toBe(false);
    expect(needsAnalyticsConsentReview()).toBe(true);
  });

  it('fails closed when browser storage cannot save an opt-in', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => saveAnalyticsConsentDecision(true)).toThrow('storage unavailable');
    expect(hasCurrentAnalyticsConsent()).toBe(false);
  });

  it('keeps telemetry off when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(hasCurrentAnalyticsConsent()).toBe(false);
    expect(needsAnalyticsConsentReview()).toBe(true);
    expect(() => saveAnalyticsConsentDecision(true)).toThrow('Preferences cannot be saved');
    expect(hasCurrentAnalyticsConsent()).toBe(false);
  });

  it('drops queued analytics immediately when consent is withdrawn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    saveAnalyticsConsentDecision(true);

    trackEvent('before-withdrawal');
    saveAnalyticsConsentDecision(false);
    await flushEvents();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts an in-flight analytics request when consent is withdrawn', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, options: { signal?: AbortSignal } = {}) => {
      requestSignal = options.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    saveAnalyticsConsentDecision(true);
    trackEvent('in-flight');

    const flush = flushEvents();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    saveAnalyticsConsentDecision(false);
    await flush;

    expect(requestSignal?.aborted).toBe(true);
  });
});
