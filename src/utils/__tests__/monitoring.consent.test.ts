import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';
import * as preferences from '../preferences';

vi.mock('@sentry/react', () => {
  // Return a stable client so callers that fetch it again observe the same
  // `close` spy that `revokeSentryConsent` invoked.
  const client = { close: vi.fn() };
  return {
    init: vi.fn(),
    getClient: vi.fn(() => client),
    browserTracingIntegration: vi.fn(),
    replayIntegration: vi.fn(),
    breadcrumbsIntegration: vi.fn(),
    withScope: vi.fn(),
    captureException: vi.fn(),
    setUser: vi.fn(),
    startSpan: vi.fn(),
    ErrorBoundary: vi.fn(),
  };
});

vi.mock('../preferences', () => ({
  ANALYTICS_POLICY_VERSION: '1',
  loadPreferences: vi.fn(),
  savePreferences: vi.fn((value) => value),
}));

function consentPreferences(allowed: boolean) {
  return {
    compactMode: false,
    showAdvancedPanels: true,
    autoRefreshDashboard: true,
    defaultSearchScope: 'all',
    diagnosticsConsent: allowed,
    analyticsConsent: allowed,
    analyticsConsentPolicyVersion: allowed ? '1' : null,
    analyticsConsentReviewedVersion: allowed ? '1' : null,
  } as ReturnType<typeof preferences.loadPreferences>;
}

vi.mock('../logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('monitoring Sentry consent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes Sentry when diagnosticsConsent is true', async () => {
    vi.mocked(preferences.loadPreferences).mockReturnValue(consentPreferences(true));
    
    const monitoring = await import('../monitoring');
    monitoring.initMonitoring({ sentryDsn: 'http://test-dsn@sentry.io/1' });

    expect(Sentry.init).toHaveBeenCalled();
    const initArgs = vi.mocked(Sentry.init).mock.calls[0][0];
    expect(initArgs?.dsn).toBe('http://test-dsn@sentry.io/1');
  });

  it('does not initialize Sentry when diagnosticsConsent is false (defaults to no consent)', async () => {
    vi.mocked(preferences.loadPreferences).mockReturnValue(consentPreferences(false));
    
    const monitoring = await import('../monitoring');
    monitoring.initMonitoring({ sentryDsn: 'http://test-dsn@sentry.io/1' });

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('applies external provider circuit-breaker policies during init', async () => {
    vi.mocked(preferences.loadPreferences).mockReturnValue(consentPreferences(true));

    const monitoring = await import('../monitoring');
    monitoring.initMonitoring({
      sentryDsn: 'http://test-dsn@sentry.io/1',
      providerPolicies: { analytics: 'fail-closed' },
    });

    expect(monitoring.getProviderPolicy('analytics')).toBe('fail-closed');
    expect(monitoring.getProviderStats('analytics').state).toBe('CLOSED');
  });

  it('closes Sentry client when consent is revoked', async () => {
    vi.mocked(preferences.loadPreferences).mockReturnValue(consentPreferences(true));
    
    const monitoring = await import('../monitoring');
    monitoring.revokeSentryConsent();

    const getClient = vi.mocked(Sentry.getClient);
    expect(getClient).toHaveBeenCalled();
    
    const client = getClient();
    expect(client?.close).toHaveBeenCalledWith(0);
  });

  it('disconnects performance observers immediately when consent is withdrawn', async () => {
    vi.mocked(preferences.loadPreferences).mockReturnValue(consentPreferences(true));
    const disconnects: Array<ReturnType<typeof vi.fn>> = [];
    class MockPerformanceObserver {
      disconnect = vi.fn();
      observe = vi.fn();

      constructor(_callback: unknown) {
        disconnects.push(this.disconnect);
      }
    }
    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);

    const monitoring = await import('../monitoring');
    const consent = await import('../analyticsConsent');
    monitoring.initMonitoring({ sentryDsn: 'http://test-dsn@sentry.io/1' });

    expect(disconnects.length).toBeGreaterThan(0);
    consent.saveAnalyticsConsentDecision(false);

    expect(disconnects.every(disconnect => disconnect.mock.calls.length === 1)).toBe(true);
  });
});
