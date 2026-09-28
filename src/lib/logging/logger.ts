/**
 * Comprehensive Logging System - D-026 / #965
 * Structured logging with correlation IDs, log levels, sensitive data redaction,
 * environment-aware level filtering, and monitoring capabilities.
 */

import { redactSensitive } from '../../utils/security';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.CRITICAL]: 'CRITICAL',
};

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  stack?: string;
  tags?: string[];
}

export interface LogFilter {
  level?: LogLevel;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  startTime?: number;
  endTime?: number;
  search?: string;
}

export function parseLogLevel(level: unknown): LogLevel | undefined {
  if (typeof level === 'number' && level in LogLevel) {
    return level as LogLevel;
  }
  if (typeof level === 'string') {
    const normalized = level.trim().toUpperCase();
    switch (normalized) {
      case '0':
      case 'DEBUG':
        return LogLevel.DEBUG;
      case '1':
      case 'INFO':
        return LogLevel.INFO;
      case '2':
      case 'WARN':
      case 'WARNING':
        return LogLevel.WARN;
      case '3':
      case 'ERROR':
        return LogLevel.ERROR;
      case '4':
      case 'CRITICAL':
      case 'FATAL':
        return LogLevel.CRITICAL;
      default:
        return undefined;
    }
  }
  return undefined;
}

function resolveDefaultLogLevel(): LogLevel {
  let envLevel: unknown = undefined;
  if (typeof process !== 'undefined' && process.env) {
    envLevel = process.env.LOG_LEVEL || process.env.VITE_LOG_LEVEL;
  }
  if (!envLevel && typeof import.meta !== 'undefined' && import.meta.env) {
    envLevel = import.meta.env.VITE_LOG_LEVEL || import.meta.env.LOG_LEVEL;
  }

  if (envLevel) {
    const parsed = parseLogLevel(envLevel);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  const isProduction =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ||
    (typeof import.meta !== 'undefined' && (import.meta.env?.PROD || import.meta.env?.MODE === 'production'));

  return isProduction ? LogLevel.WARN : LogLevel.DEBUG;
}

export interface LoggerOptions {
  maxLogs?: number;
  defaultLevel?: LogLevel | string;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 10000;
  private subscribers = new Set<(entry: LogEntry) => void>();
  private currentCorrelationId: string | null = null;
  private sessionId = this.generateId();
  private currentLogLevel: LogLevel = resolveDefaultLogLevel();

  constructor(options?: number | LoggerOptions) {
    if (typeof options === 'number') {
      this.maxLogs = options;
    } else if (options && typeof options === 'object') {
      if (options.maxLogs !== undefined) {
        this.maxLogs = options.maxLogs;
      }
      if (options.defaultLevel !== undefined) {
        this.setLogLevel(options.defaultLevel);
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  setLogLevel(level: LogLevel | string): void {
    const parsed = parseLogLevel(level);
    if (parsed !== undefined) {
      this.currentLogLevel = parsed;
    }
  }

  setLevel(level: LogLevel | string): void {
    this.setLogLevel(level);
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  setCorrelationId(id: string | null) {
    this.currentCorrelationId = id;
  }

  getCorrelationId(): string | null {
    return this.currentCorrelationId;
  }

  setSessionId(id: string) {
    this.sessionId = id;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    tags?: string[]
  ): LogEntry {
    const safeMessage = redactSensitive(message) as string;
    const safeContext = context ? (redactSensitive(context) as Record<string, unknown>) : undefined;
    const safeTags = tags ? (redactSensitive(tags) as string[]) : undefined;

    return {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message: safeMessage,
      context: safeContext,
      correlationId: this.currentCorrelationId || undefined,
      sessionId: this.sessionId,
      tags: safeTags,
    };
  }

  private addLog(entry: LogEntry) {
    // Drop logs lower than current configured level (e.g. debug/info stripped in production default)
    if (entry.level < this.currentLogLevel) {
      return;
    }

    this.logs.push(entry);

    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify subscribers
    this.subscribers.forEach(sub => {
      try {
        sub(entry);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Logger] Subscriber failed:', err);
      }
    });

    // Console output for active entries
    this.logToConsole(entry);
  }

  private logToConsole(entry: LogEntry) {
    const levelName = LogLevelNames[entry.level] || 'INFO';
    const prefix = `[${levelName}]${entry.correlationId ? ` [${entry.correlationId}]` : ''}`;

    /* eslint-disable no-console */
    if (entry.level >= LogLevel.ERROR) {
      console.error(prefix, entry.message, entry.context || '');
    } else if (entry.level === LogLevel.WARN) {
      console.warn(prefix, entry.message, entry.context || '');
    } else if (entry.level === LogLevel.INFO) {
      if (typeof console.info === 'function') {
        console.info(prefix, entry.message, entry.context || '');
      } else {
        console.log(prefix, entry.message, entry.context || '');
      }
    } else {
      if (typeof console.debug === 'function') {
        console.debug(prefix, entry.message, entry.context || '');
      } else {
        console.log(prefix, entry.message, entry.context || '');
      }
    }
    /* eslint-enable no-console */
  }

  debug(message: string, context?: Record<string, unknown>, tags?: string[]) {
    this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context, tags));
  }

  info(message: string, context?: Record<string, unknown>, tags?: string[]) {
    this.addLog(this.createLogEntry(LogLevel.INFO, message, context, tags));
  }

  warn(message: string, context?: Record<string, unknown>, tags?: string[]) {
    this.addLog(this.createLogEntry(LogLevel.WARN, message, context, tags));
  }

  error(message: string, context?: Record<string, unknown>, tags?: string[], error?: Error) {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, tags);
    if (error) {
      entry.stack = error.stack;
      entry.context = {
        ...(entry.context || {}),
        errorName: error.name,
        errorMessage: redactSensitive(error.message),
      };
    }
    this.addLog(entry);
  }

  critical(message: string, context?: Record<string, unknown>, tags?: string[], error?: Error) {
    const entry = this.createLogEntry(LogLevel.CRITICAL, message, context, tags);
    if (error) {
      entry.stack = error.stack;
      entry.context = {
        ...(entry.context || {}),
        errorName: error.name,
        errorMessage: redactSensitive(error.message),
      };
    }
    this.addLog(entry);
  }

  fatal(message: string, context?: Record<string, unknown>, tags?: string[], error?: Error) {
    this.critical(message, context, tags, error);
  }

  log(message: string, context?: Record<string, unknown>, tags?: string[]) {
    this.info(message, context, tags);
  }

  subscribe(callback: (entry: LogEntry) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level >= filter.level!);
      }
      if (filter.correlationId) {
        filtered = filtered.filter(log => log.correlationId === filter.correlationId);
      }
      if (filter.userId) {
        filtered = filtered.filter(log => log.userId === filter.userId);
      }
      if (filter.sessionId) {
        filtered = filtered.filter(log => log.sessionId === filter.sessionId);
      }
      if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter(log =>
          log.tags && filter.tags!.some(tag => log.tags!.includes(tag))
        );
      }
      if (filter.startTime) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(log =>
          log.message.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.context).toLowerCase().includes(searchLower)
        );
      }
    }

    return filtered;
  }

  clear(): void {
    this.logs = [];
  }

  clearLogs(): void {
    this.clear();
  }

  exportLogs(formatOrFilter?: 'json' | 'text' | LogFilter, maybeFilter?: LogFilter): string {
    let format: 'json' | 'text' = 'json';
    let filter: LogFilter | undefined;

    if (typeof formatOrFilter === 'string') {
      format = formatOrFilter;
      filter = maybeFilter;
    } else if (typeof formatOrFilter === 'object') {
      filter = formatOrFilter;
    }

    const logs = this.getLogs(filter);
    if (format === 'text') {
      return logs
        .map(
          entry =>
            `[${new Date(entry.timestamp).toISOString()}] [${LogLevelNames[entry.level] || 'INFO'}]${
              entry.correlationId ? ` [${entry.correlationId}]` : ''
            } ${entry.message}${entry.context ? ` ${JSON.stringify(entry.context)}` : ''}`
        )
        .join('\n');
    }
    return JSON.stringify(logs, null, 2);
  }

  getAnalytics() {
    const levelCounts = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0,
    };

    this.logs.forEach(log => {
      levelCounts[log.level] = (levelCounts[log.level] || 0) + 1;
    });

    const tagCounts = new Map<string, number>();
    this.logs.forEach(log => {
      log.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return {
      total: this.logs.length,
      byLevel: levelCounts,
      byTag: Object.fromEntries(tagCounts),
      timeRange: this.logs.length > 0 ? {
        start: this.logs[0].timestamp,
        end: this.logs[this.logs.length - 1].timestamp,
      } : null,
    };
  }
}

export const logger = new Logger();

export interface NamespaceLogger {
  namespace: string;
  debug: (msg: string, ctx?: Record<string, unknown>, tags?: string[]) => void;
  info: (msg: string, ctx?: Record<string, unknown>, tags?: string[]) => void;
  warn: (msg: string, ctx?: Record<string, unknown>, tags?: string[], err?: Error) => void;
  error: (msg: string, ctx?: Record<string, unknown>, tags?: string[], err?: Error) => void;
  critical: (msg: string, ctx?: Record<string, unknown>, tags?: string[], err?: Error) => void;
  fatal: (msg: string, ctx?: Record<string, unknown>, tags?: string[], err?: Error) => void;
  log: (msg: string, ctx?: Record<string, unknown>, tags?: string[]) => void;
}

export function createLogger(namespace: string): NamespaceLogger {
  return {
    namespace,
    debug: (msg, ctx, tags) => logger.debug(`[${namespace}] ${msg}`, ctx, tags),
    info: (msg, ctx, tags) => logger.info(`[${namespace}] ${msg}`, ctx, tags),
    warn: (msg, ctx, tags, err) => logger.warn(`[${namespace}] ${msg}`, ctx, tags, err),
    error: (msg, ctx, tags, err) => logger.error(`[${namespace}] ${msg}`, ctx, tags, err),
    critical: (msg, ctx, tags, err) => logger.critical(`[${namespace}] ${msg}`, ctx, tags, err),
    fatal: (msg, ctx, tags, err) => logger.fatal(`[${namespace}] ${msg}`, ctx, tags, err),
    log: (msg, ctx, tags) => logger.info(`[${namespace}] ${msg}`, ctx, tags),
  };
}

// Error tracking integration placeholder
export function trackError(error: Error, context?: Record<string, unknown>) {
  logger.error(error.message, context, ['error-tracking'], error);

  // Sentry integration
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, { extra: context });
  }
}

export default logger;
