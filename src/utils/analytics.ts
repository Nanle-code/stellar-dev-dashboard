/**
 * User analytics and event tracking
 * Integrates with performance monitoring for user behavior analysis
 */

const analyticsConfig = {
  enabled: true,
  batchSize: 20,
  flushInterval: 60000, // 60 seconds
  endpoint: null, // Set to your analytics endpoint
  sessionId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};

let eventQueue = [];

/**
 * Track a custom event
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!analyticsConfig.enabled) return;

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
  if (eventQueue.length === 0 || !analyticsConfig.endpoint) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    await fetch(analyticsConfig.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: eventsToSend,
        sessionId: analyticsConfig.sessionId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Analytics flush failed:', error);
    eventQueue.unshift(...eventsToSend); // Re-queue on failure
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
