/**
 * Enhanced error reporting service with detailed categorization and analytics.
 * In a real application, this could be integrated with Sentry, LogRocket, Bugsnag, etc.
 */

import { createLogger } from '../utils/logger'

const logger = createLogger('ErrorReporting')

// Error reporting configuration
const ERROR_REPORTING_CONFIG = {
  enabled: true,
  maxErrorsPerSession: 50,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  endpoint: null, // Set this to your error reporting endpoint
};

// In-memory error queue for batching
let errorQueue = [];
let errorCount = 0;
let sessionId = generateSessionId();

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get user context information
 */
function getUserContext() {
  return {
    sessionId,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth
    },
    connection: navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    } : null,
    memory: navigator.deviceMemory || null,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine
  };
}

/**
 * Sanitize error data to remove sensitive information
 */
function sanitizeErrorData(error, errorInfo) {
  const sanitized = { ...errorInfo };
  
  // Remove potentially sensitive data
  if (sanitized.props) {
    delete sanitized.props.children;
    delete sanitized.props.apiKey;
    delete sanitized.props.token;
    delete sanitized.props.password;
  }
  
  // Sanitize URL parameters
  if (sanitized.url) {
    try {
      const url = new URL(sanitized.url);
      url.searchParams.delete('token');
      url.searchParams.delete('key');
      url.searchParams.delete('secret');
      sanitized.url = url.toString();
    } catch (e) {
      // Keep original URL if parsing fails
    }
  }
  
  return sanitized;
}

/**
 * Enhanced error reporting with detailed context
 */
export const reportError = (error, errorInfo = null) => {
  if (!ERROR_REPORTING_CONFIG.enabled || errorCount >= ERROR_REPORTING_CONFIG.maxErrorsPerSession) {
    return;
  }

  errorCount++;

  const userContext = getUserContext();
  const sanitizedErrorInfo = errorInfo ? sanitizeErrorData(error, errorInfo) : {};
  
  const errorReport = {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    error: {
      name: error?.name || 'Unknown',
      message: error?.message || 'Unknown error',
      stack: error?.stack || null,
      code: error?.code || null,
      type: typeof error
    },
    context: userContext,
    details: sanitizedErrorInfo,
    severity: sanitizedErrorInfo.severity || 'medium',
    category: sanitizedErrorInfo.category || 'unknown',
    fingerprint: generateErrorFingerprint(error, sanitizedErrorInfo),
    breadcrumbs: getBreadcrumbs(),
    tags: {
      component: sanitizedErrorInfo.context || 'unknown',
      network: getNetworkInfo(),
      retryCount: sanitizedErrorInfo.retryCount || 0
    }
  };

  // Log to console and structured logger
  console.error('[Error Reporting Service] Error captured:', errorReport);
  logger.error('Error captured and queued for reporting', {
    errorId: errorReport.id,
    category: errorReport.category,
    severity: errorReport.severity,
    url: userContext.url,
  }, error);

  // Add to queue for batching
  errorQueue.push(errorReport);

  // Flush immediately for critical errors
  if (sanitizedErrorInfo.severity === 'critical') {
    flushErrorQueue();
  } else if (errorQueue.length >= ERROR_REPORTING_CONFIG.batchSize) {
    flushErrorQueue();
  }

  // Store in localStorage as backup
  try {
    const storedErrors = JSON.parse(localStorage.getItem('stellar-dashboard-errors') || '[]');
    storedErrors.push(errorReport);
    
    // Keep only last 20 errors
    if (storedErrors.length > 20) {
      storedErrors.splice(0, storedErrors.length - 20);
    }
    
    localStorage.setItem('stellar-dashboard-errors', JSON.stringify(storedErrors));
  } catch (e) {
    console.warn('Failed to store error in localStorage:', e);
  }
};

/**
 * Generate a fingerprint for error deduplication
 */
function generateErrorFingerprint(error, errorInfo) {
  const components = [
    error?.name || 'Unknown',
    error?.message || 'Unknown',
    errorInfo.category || 'unknown',
    errorInfo.context || 'unknown'
  ];
  
  return btoa(components.join('|')).substr(0, 16);
}

/**
 * Get network information
 */
function getNetworkInfo() {
  return {
    online: navigator.onLine,
    connection: navigator.connection ? {
      type: navigator.connection.effectiveType,
      downlink: navigator.connection.downlink,
      rtt: navigator.connection.rtt
    } : null
  };
}

/**
 * Simple breadcrumb system
 */
let breadcrumbs = [];

export const addBreadcrumb = (message, category = 'info', data = {}) => {
  breadcrumbs.push({
    timestamp: new Date().toISOString(),
    message,
    category,
    data
  });
  
  // Keep only last 20 breadcrumbs
  if (breadcrumbs.length > 20) {
    breadcrumbs.shift();
  }
};

function getBreadcrumbs() {
  return [...breadcrumbs];
}

/**
 * Flush error queue to reporting service
 */
async function flushErrorQueue() {
  if (errorQueue.length === 0) return;

  const errorsToSend = [...errorQueue];
  errorQueue = [];

  if (ERROR_REPORTING_CONFIG.endpoint) {
    try {
      await fetch(ERROR_REPORTING_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors: errorsToSend,
          sessionId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Failed to send errors to reporting service:', e);
      // Re-add errors to queue for retry
      errorQueue.unshift(...errorsToSend);
    }
  }
}

/**
 * Report warnings with context
 */
export const reportWarning = (message, data = null, category = 'warning') => {
  const warningReport = {
    id: `warning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level: 'warning',
    message,
    data,
    category,
    context: getUserContext(),
    timestamp: new Date().toISOString()
  };

  console.warn(`[Error Reporting Service - Warning] ${message}`, warningReport);
  
  // Add as breadcrumb
  addBreadcrumb(message, category, data);
};

/**
 * Report performance issues
 */
export const reportPerformance = (metric, value, context = {}) => {
  const performanceReport = {
    id: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level: 'info',
    metric,
    value,
    context: {
      ...getUserContext(),
      ...context
    },
    timestamp: new Date().toISOString()
  };

  console.info(`[Error Reporting Service - Performance] ${metric}: ${value}`, performanceReport);
};

/**
 * Initialize error reporting
 */
export const initializeErrorReporting = (config = {}) => {
  Object.assign(ERROR_REPORTING_CONFIG, config);
  
  // Set up periodic flushing
  setInterval(flushErrorQueue, ERROR_REPORTING_CONFIG.flushInterval);
  
  // Flush on page unload
  window.addEventListener('beforeunload', flushErrorQueue);
  
  // Add global error handlers
  window.addEventListener('error', (event) => {
    reportError(event.error, {
      context: 'Global Error Handler',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      category: 'javascript',
      severity: 'high'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      context: 'Unhandled Promise Rejection',
      category: 'promise',
      severity: 'high'
    });
  });

  console.log('[Error Reporting Service] Initialized with config:', ERROR_REPORTING_CONFIG);
};

/**
 * Get error statistics for debugging
 */
export const getErrorStats = () => {
  return {
    sessionId,
    errorCount,
    queueLength: errorQueue.length,
    breadcrumbsCount: breadcrumbs.length,
    config: ERROR_REPORTING_CONFIG
  };
};

/**
 * Clear error data (useful for testing)
 */
export const clearErrorData = () => {
  errorQueue = [];
  breadcrumbs = [];
  errorCount = 0;
  sessionId = generateSessionId();
  
  try {
    localStorage.removeItem('stellar-dashboard-errors');
  } catch (e) {
    console.warn('Failed to clear stored errors:', e);
  }
};
