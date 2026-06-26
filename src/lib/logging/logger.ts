/**
 * Comprehensive Logging System - D-026
 * Structured logging with correlation IDs, log levels, and monitoring capabilities
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

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

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 10000;
  private subscribers = new Set<(entry: LogEntry) => void>();
  private currentCorrelationId: string | null = null;
  private sessionId = this.generateId();

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setCorrelationId(id: string | null) {
    this.currentCorrelationId = id;
  }

  getCorrelationId(): string | null {
    return this.currentCorrelationId;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    tags?: string[]
  ): LogEntry {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      correlationId: this.currentCorrelationId || undefined,
      sessionId: this.sessionId,
      tags,
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep logs under limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Notify subscribers
    this.subscribers.forEach(sub => sub(entry));

    // Console output in development
    if (process.env.NODE_ENV !== 'production') {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: LogEntry) {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const levelName = levelNames[entry.level];
    const prefix = `[${levelName}] ${entry.correlationId ? `[${entry.correlationId}]` : ''}`;
    
    const consoleMethod = entry.level >= LogLevel.ERROR ? console.error : 
                         entry.level === LogLevel.WARN ? console.warn :
                         entry.level === LogLevel.DEBUG ? console.debug : console.log;
    
    consoleMethod(prefix, entry.message, entry.context || '');
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
      entry.context = { ...entry.context, errorName: error.name, errorMessage: error.message };
    }
    this.addLog(entry);
  }

  critical(message: string, context?: Record<string, unknown>, tags?: string[], error?: Error) {
    const entry = this.createLogEntry(LogLevel.CRITICAL, message, context, tags);
    if (error) {
      entry.stack = error.stack;
      entry.context = { ...entry.context, errorName: error.name, errorMessage: error.message };
    }
    this.addLog(entry);
  }

  subscribe(callback: (entry: LogEntry) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level >= filter.level);
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

  clear() {
    this.logs = [];
  }

  exportLogs(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
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
      levelCounts[log.level]++;
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

// Error tracking integration placeholder
export function trackError(error: Error, context?: Record<string, unknown>) {
  logger.error(error.message, context, ['error-tracking'], error);
  
  // Sentry integration would go here
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    (window as any).Sentry.captureException(error, { extra: context });
  }
}
