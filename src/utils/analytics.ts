/**
 * User analytics and event tracking
 * Integrates with performance monitoring for user behavior analysis
 *
 * Outbound delivery is wrapped in a circuit breaker (Issue #828) so an
 * unavailable analytics collector can never block the dashboard. Analytics is
 * best-effort, so the default policy is `fail-open`.
 */

import { guardProviderSend } from './providerCircuitBreaker';
import {
  hasCurrentAnalyticsConsent,
  subscribeToAnalyticsConsent,
} from './analyticsConsent';

const analyticsConfig = {
  enabled: true,
  batchSize: 20,
  flushInterval: 60000, // 60 seconds
  endpoint: null, // Set to your analytics endpoint
  sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};

let eventQueue = [];
const activeFlushes = new Set<AbortController>();

subscribeToAnalyticsConsent(allowed => {
  if (allowed) return;
  eventQueue = [];
  activeFlushes.forEach(controller => controller.abort());
  activeFlushes.clear();
});

/**
 * Track a custom event
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!analyticsConfig.enabled || !hasCurrentAnalyticsConsent()) return;

  const event = {
    name: eventName,
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      sessionId: analyticsConfig.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  };

  eventQueue.push(event);

  // Flush if batch size reached
  if (eventQueue.length >= analyticsConfig.batchSize) {
    flushEvents();
  }
};

/**
 * Track page view
 */
export const trackPageView = (path, title = null) => {
  trackEvent('page_view', {
    path,
    title: title || (typeof document !== 'undefined' ? document.title : null),
  });
};

/**
 * Track user action
 */
export const trackUserAction = (action, details = {}) => {
  trackEvent('user_action', {
    action,
    ...details,
  });
};

/**
 * Track performance metric
 */
export const trackPerformanceMetric = (metricName, value, unit = 'ms') => {
  trackEvent('performance_metric', {
    metric: metricName,
    value,
    unit,
  });
};

/**
 * Track API call
 */
export const trackApiCall = (endpoint, method, duration, status) => {
  trackEvent('api_call', {
    endpoint,
    method,
    duration,
    status,
  });
};

/**
 * Flush pending events to analytics endpoint
 */
export const flushEvents = async () => {
  if (!analyticsConfig.enabled || !hasCurrentAnalyticsConsent() || eventQueue.length === 0 || !analyticsConfig.endpoint) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];
  if (typeof AbortController === 'undefined') return;
  const controller = new AbortController();
  activeFlushes.add(controller);

  try {
    const result = await guardProviderSend(
      'analytics',
      async () => {
        if (!hasCurrentAnalyticsConsent()) return;
        const response = await fetch(analyticsConfig.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: eventsToSend,
            sessionId: analyticsConfig.sessionId,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Analytics endpoint responded ${response.status}`);
        }
      },
      { failureThreshold: 3, successThreshold: 1, timeout: 30000 },
    );

    if (!result.delivered && !result.skipped && hasCurrentAnalyticsConsent()) {
      // Transient failure while the circuit is still closed — keep the batch.
      // When the circuit is OPEN (`skipped`) the batch is intentionally dropped
      // so the queue cannot grow without bound while the provider is down.
      console.error('Analytics flush failed:', result.error);
      eventQueue.unshift(...eventsToSend);
    }
  } finally {
    activeFlushes.delete(controller);
  }
};

/**
 * Set analytics endpoint
 */
export const setAnalyticsEndpoint = (endpoint) => {
  analyticsConfig.endpoint = endpoint;
};

/**
 * Enable/disable analytics
 */
export const setAnalyticsEnabled = (enabled) => {
  analyticsConfig.enabled = enabled;
};

/**
 * Get current session ID
 */
export const getSessionId = () => analyticsConfig.sessionId;

/**
 * Periodic flush timer
 */
if (typeof window !== 'undefined') {
  setInterval(flushEvents, analyticsConfig.flushInterval);

  // Flush on page unload
  window.addEventListener('beforeunload', flushEvents);
}
