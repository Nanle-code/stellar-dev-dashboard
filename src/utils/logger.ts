/**
 * Logger utility bridge - delegates to centralized structured logger in src/lib/logging
 * Maintains backward compatibility while enforcing sensitive data redaction.
 */

import {
  logger as structuredLogger,
  LogLevel as StructuredLogLevel,
  LogEntry as StructuredLogEntry,
  createLogger as createStructuredLogger,
  NamespaceLogger as StructuredNamespaceLogger,
} from '../lib/logging/logger';

export { LogLevel } from '../lib/logging/logger';

export interface LogEntry {
  timestamp: string;
  level: string;
  levelValue: StructuredLogLevel;
  message: string;
  context: Record<string, unknown>;
  sessionId: string;
  url: string | null;
  userAgent: string | null;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export type LogHandler = (entry: LogEntry) => void;

const registeredHandlers: LogHandler[] = [];

// Subscribe to structuredLogger to notify legacy handlers if any
structuredLogger.subscribe((entry: StructuredLogEntry) => {
  if (registeredHandlers.length === 0) return;
  const legacyEntry: LogEntry = {
    timestamp: new Date(entry.timestamp).toISOString(),
    level: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'][entry.level] || 'INFO',
    levelValue: entry.level,
    message: entry.message,
    context: entry.context || {},
    sessionId: entry.sessionId || structuredLogger.getSessionId(),
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };
  registeredHandlers.forEach(handler => {
    try {
      handler(legacyEntry);
    } catch {
      // Ignored
    }
  });
});

export const setLogLevel = (level: StructuredLogLevel | string): void => {
  structuredLogger.setLogLevel(level);
};

export const getLogLevel = (): StructuredLogLevel => structuredLogger.getLogLevel();

export const setSessionId = (id: string): void => {
  structuredLogger.setSessionId(id);
};

export const addLogHandler = (handler: LogHandler): void => {
  registeredHandlers.push(handler);
};

export const removeLogHandler = (handler: LogHandler): void => {
  const index = registeredHandlers.indexOf(handler);
  if (index !== -1) {
    registeredHandlers.splice(index, 1);
  }
};

export const debug = (message: string, context: Record<string, unknown> = {}): void => {
  structuredLogger.debug(message, context);
};

export const info = (message: string, context: Record<string, unknown> = {}): void => {
  structuredLogger.info(message, context);
};

export const warn = (
  message: string,
  context: Record<string, unknown> = {},
  error: Error | null = null
): void => {
  structuredLogger.warn(message, context, undefined);
  if (error) {
    structuredLogger.error(error.message, context, undefined, error);
  }
};

export const error = (
  message: string,
  context: Record<string, unknown> = {},
  errorObj: Error | null = null
): void => {
  structuredLogger.error(message, context, undefined, errorObj || undefined);
};

export const fatal = (
  message: string,
  context: Record<string, unknown> = {},
  errorObj: Error | null = null
): void => {
  structuredLogger.critical(message, context, undefined, errorObj || undefined);
};

export type NamespaceLogger = StructuredNamespaceLogger;

export const createLogger = (namespace: string): StructuredNamespaceLogger => {
  return createStructuredLogger(namespace);
};

export const logger = {
  debug,
  info,
  warn,
  error,
  fatal,
  setLogLevel,
  addLogHandler,
};

export default logger;
