import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorReporting');

export interface ErrorReportingConfig {
  enabled: boolean;
  maxErrorsPerSession: number;
  batchSize: number;
  flushInterval: number;
  endpoint: string | null;
}

const ERROR_REPORTING_CONFIG: ErrorReportingConfig = {
  enabled: true,
  maxErrorsPerSession: 50,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  endpoint: null,
};

export interface ErrorReport {
  id: string;
  error: {
    name: string;
    message: string;
    stack: string | null;
    code: string | number | null;
    type: string;
  };
  context: {
    sessionId: string;
    timestamp: string;
    url: string;
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    screen: {
      width: number;
      height: number;
      colorDepth: number;
    };
    connection: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    } | null;
    memory: number | null;
    language: string;
    timezone: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
  details: Record<string, unknown>;
  severity: string;
  category: string;
  fingerprint: string;
  breadcrumbs: Breadcrumb[];
  tags: {
    component: string;
    network: {
      online: boolean;
      connection: {
        type?: string;
        downlink?: number;
        rtt?: number;
      } | null;
    };
    retryCount: number;
  };
}

export interface Breadcrumb {
  timestamp: string;
  message: string;
  category: string;
  data: Record<string, unknown>;
}

let errorQueue: ErrorReport[] = [];
let errorCount = 0;
let sessionId = generateSessionId();

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

interface SanitizedData {
  props?: {
    children?: unknown;
    apiKey?: unknown;
    token?: unknown;
    password?: unknown;
    [key: string]: unknown;
  };
  url?: string;
  severity?: string;
  category?: string;
  context?: string;
  retryCount?: number;
  [key: string]: unknown;
}

function sanitizeErrorData(error: unknown, errorInfo: SanitizedData): SanitizedData {
  const sanitized = { ...errorInfo };
  
  if (sanitized.props) {
    const newProps = { ...sanitized.props };
    delete newProps.children;
    delete newProps.apiKey;
    delete newProps.token;
    delete newProps.password;
    sanitized.props = newProps;
  }
  
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

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    type?: string;
  };
}

function getUserContext() {
  const nav = navigator as ExtendedNavigator;
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
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth
    },
    connection: nav.connection ? {
      effectiveType: nav.connection.effectiveType,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt
    } : null,
    memory: nav.deviceMemory || null,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine
  };
}

function generateErrorFingerprint(error: unknown, errorInfo: SanitizedData): string {
  const err = error as Record<string, unknown> | null | undefined;
  const components = [
    String(err?.name || 'Unknown'),
    String(err?.message || 'Unknown'),
    (errorInfo.category as string) || 'unknown',
    (errorInfo.context as string) || 'unknown'
  ];
  
  return btoa(components.join('|')).substring(0, 16);
}

function getNetworkInfo() {
  const nav = navigator as ExtendedNavigator;
  return {
    online: navigator.onLine,
    connection: nav.connection ? {
      type: nav.connection.type,
      downlink: nav.connection.downlink,
      rtt: nav.connection.rtt
    } : null
  };
}

export const reportError = (error: unknown, errorInfo: Record<string, unknown> | null = null): void => {
  if (!ERROR_REPORTING_CONFIG.enabled || errorCount >= ERROR_REPORTING_CONFIG.maxErrorsPerSession) {
    return;
  }

  errorCount++;

  const userContext = getUserContext();
  const sanitizedErrorInfo = errorInfo ? sanitizeErrorData(error, errorInfo as SanitizedData) : {};
  const err = error as Record<string, unknown> | null | undefined;
  
  const errorReport: ErrorReport = {
    id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    error: {
      name: String(err?.name || 'Unknown'),
      message: String(err?.message || 'Unknown error'),
      stack: typeof err?.stack === 'string' ? err.stack : null,
      code: typeof err?.code === 'string' || typeof err?.code === 'number' ? err.code : null,
      type: typeof error
    },
    context: userContext,
    details: sanitizedErrorInfo as Record<string, unknown>,
    severity: (sanitizedErrorInfo.severity as string) || 'medium',
    category: (sanitizedErrorInfo.category as string) || 'unknown',
    fingerprint: generateErrorFingerprint(error, sanitizedErrorInfo),
    breadcrumbs: getBreadcrumbs(),
    tags: {
      component: (sanitizedErrorInfo.context as string) || 'unknown',
      network: getNetworkInfo(),
      retryCount: (sanitizedErrorInfo.retryCount as number) || 0
    }
  };

  console.error('[Error Reporting Service] Error captured:', errorReport);
  logger.error('Error captured and queued for reporting', {
    errorId: errorReport.id,
    category: errorReport.category,
    severity: errorReport.severity,
    url: userContext.url,
  }, error instanceof Error ? error : new Error(String(error)));

  errorQueue.push(errorReport);

  if (sanitizedErrorInfo.severity === 'critical') {
    flushErrorQueue();
  } else if (errorQueue.length >= ERROR_REPORTING_CONFIG.batchSize) {
    flushErrorQueue();
  }

  try {
    const storedErrors = JSON.parse(localStorage.getItem('stellar-dashboard-errors') || '[]');
    storedErrors.push(errorReport);
    
    if (storedErrors.length > 20) {
      storedErrors.splice(0, storedErrors.length - 20);
    }
    
    localStorage.setItem('stellar-dashboard-errors', JSON.stringify(storedErrors));
  } catch (e) {
    console.warn('Failed to store error in localStorage:', e);
  }
};

let breadcrumbs: Breadcrumb[] = [];

export const addBreadcrumb = (message: string, category = 'info', data: Record<string, unknown> = {}): void => {
  breadcrumbs.push({
    timestamp: new Date().toISOString(),
    message,
    category,
    data
  });
  
  if (breadcrumbs.length > 20) {
    breadcrumbs.shift();
  }
};

function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

async function flushErrorQueue(): Promise<void> {
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
      errorQueue.unshift(...errorsToSend);
    }
  }
}

export const reportWarning = (message: string, data: Record<string, unknown> | null = null, category = 'warning'): void => {
  const warningReport = {
    id: `warning-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    level: 'warning',
    message,
    data,
    category,
    context: getUserContext(),
    timestamp: new Date().toISOString()
  };

  console.warn(`[Error Reporting Service - Warning] ${message}`, warningReport);
  addBreadcrumb(message, category, data || {});
};

export const reportPerformance = (metric: string, value: number, context: Record<string, unknown> = {}): void => {
  const performanceReport = {
    id: `perf-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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

export const initializeErrorReporting = (config: Partial<ErrorReportingConfig> = {}): void => {
  Object.assign(ERROR_REPORTING_CONFIG, config);
  
  setInterval(flushErrorQueue, ERROR_REPORTING_CONFIG.flushInterval);
  window.addEventListener('beforeunload', flushErrorQueue);
  
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

export const getErrorStats = () => {
  return {
    sessionId,
    errorCount,
    queueLength: errorQueue.length,
    breadcrumbsCount: breadcrumbs.length,
    config: ERROR_REPORTING_CONFIG
  };
};

export const clearErrorData = (): void => {
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
