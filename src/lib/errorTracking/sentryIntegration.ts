/**
 * Sentry Integration for Error Tracking
 * Provides comprehensive error tracking with context and user information
 */

export interface SentryConfig {
  enabled: boolean;
  dsn: string;
  environment: string;
  release: string;
  sampleRate: number;
  tracesSampleRate: number;
  beforeSendFilter?: (event: SentryEvent) => SentryEvent | null;
}

export interface SentryEvent {
  message?: string;
  level: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: SentryUser;
  contexts?: Record<string, unknown>;
  breadcrumbs?: SentryBreadcrumb[];
  stacktrace?: {
    frames: Array<{
      filename: string;
      lineno: number;
      colno: number;
      function: string;
    }>;
  };
}

export interface SentryUser {
  id: string;
  email?: string;
  username?: string;
  ipAddress?: string;
}

export interface SentryBreadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level?: string;
  data?: Record<string, unknown>;
}

export class SentryIntegration {
  private config: SentryConfig;
  private breadcrumbs: SentryBreadcrumb[] = [];
  private user: SentryUser | null = null;
  private context: Record<string, unknown> = {};

  constructor(config: SentryConfig) {
    this.config = config;
  }

  /**
   * Initialize Sentry integration
   */
  initialize(): void {
    if (!this.config.enabled) {
      console.log('[Sentry Integration] Disabled');
      return;
    }

    // In a real implementation, you would initialize Sentry here:
    // import * as Sentry from '@sentry/browser';
    // Sentry.init({
    //   dsn: this.config.dsn,
    //   environment: this.config.environment,
    //   release: this.config.release,
    //   sampleRate: this.config.sampleRate,
    //   tracesSampleRate: this.config.tracesSampleRate,
    //   beforeSend: this.config.beforeSendFilter
    // });

    console.log('[Sentry Integration] Initialized with config:', {
      dsn: this.config.dsn,
      environment: this.config.environment,
      release: this.config.release
    });

    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    window.addEventListener('error', (event) => {
      this.captureException(event.error, {
        category: 'javascript',
        level: 'error'
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason, {
        category: 'promise',
        level: 'error'
      });
    });
  }

  /**
   * Capture an exception
   */
  captureException(error: Error | unknown, extra?: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    const event: SentryEvent = {
      level: 'error',
      extra: {
        ...extra,
        ...this.context
      },
      tags: {
        environment: this.config.environment,
        release: this.config.release
      },
      breadcrumbs: [...this.breadcrumbs]
    };

    if (this.user) {
      event.user = this.user;
    }

    if (error instanceof Error) {
      event.message = error.message;
      event.stacktrace = this.parseStackTrace(error);
    } else {
      event.message = String(error);
    }

    // Apply beforeSend filter if configured
    let finalEvent = event;
    if (this.config.beforeSendFilter) {
      finalEvent = this.config.beforeSendFilter(event) || event;
    }

    // Send to Sentry (placeholder)
    this.sendToSentry(finalEvent);
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: string = 'info', extra?: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    const event: SentryEvent = {
      message,
      level,
      extra: {
        ...extra,
        ...this.context
      },
      tags: {
        environment: this.config.environment,
        release: this.config.release
      },
      breadcrumbs: [...this.breadcrumbs]
    };

    if (this.user) {
      event.user = this.user;
    }

    this.sendToSentry(event);
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(category: string, message: string, level?: string, data?: Record<string, unknown>): void {
    const breadcrumb: SentryBreadcrumb = {
      timestamp: Date.now() / 1000,
      category,
      message,
      level,
      data
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only last 100 breadcrumbs
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Set user context
   */
  setUser(user: SentryUser): void {
    this.user = user;
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    this.user = null;
  }

  /**
   * Set additional context
   */
  setContext(key: string, value: unknown): void {
    this.context[key] = value;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Parse stack trace from error
   */
  private parseStackTrace(error: Error): SentryEvent['stacktrace'] {
    if (!error.stack) return undefined;

    const lines = error.stack.split('\n');
    const frames: SentryEvent['stacktrace']['frames'] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                   line.match(/at\s+(.+?):(\d+):(\d+)/);

      if (match) {
        frames.push({
          filename: match[2] || match[1],
          lineno: parseInt(match[3] || match[2], 10),
          colno: parseInt(match[4] || match[3], 10),
          function: match[1] || 'anonymous'
        });
      }
    }

    return { frames };
  }

  /**
   * Send event to Sentry (placeholder implementation)
   */
  private sendToSentry(event: SentryEvent): void {
    // In a real implementation, this would use the Sentry SDK:
    // Sentry.captureEvent(event);

    console.log('[Sentry] Event captured:', {
      message: event.message,
      level: event.level,
      user: event.user,
      breadcrumbs: event.breadcrumbs?.length
    });
  }

  /**
   * Get current breadcrumbs
   */
  getBreadcrumbs(): SentryBreadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }
}

export function createSentryIntegration(config: SentryConfig): SentryIntegration {
  return new SentryIntegration(config);
}

// ── User Information Collection ─────────────────────────────────────────────────

export class UserInfoCollector {
  /**
   * Collect user information for error context
   */
  static collectUserInfo(): SentryUser {
    return {
      id: this.getUserId(),
      email: this.getUserEmail(),
      username: this.getUsername(),
      ipAddress: this.getIPAddress()
    };
  }

  private static getUserId(): string {
    let userId = localStorage.getItem('sentry-user-id');
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('sentry-user-id', userId);
    }
    return userId;
  }

  private static getUserEmail(): string | undefined {
    // In a real implementation, this would come from your auth system
    return localStorage.getItem('user-email') || undefined;
  }

  private static getUsername(): string | undefined {
    // In a real implementation, this would come from your auth system
    return localStorage.getItem('user-username') || undefined;
  }

  private static getIPAddress(): string | undefined {
    // IP address would typically be collected server-side
    return undefined;
  }

  /**
   * Collect device information
   */
  static collectDeviceInfo(): Record<string, unknown> {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,
      touchSupport: 'ontouchstart' in window,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack
    };
  }

  /**
   * Collect application context
   */
  static collectAppContext(): Record<string, unknown> {
    return {
      url: window.location.href,
      path: window.location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }
}
