export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

const LogLevelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

export interface LogEntry {
  timestamp: string;
  level: string;
  levelValue: LogLevel;
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

let currentLogLevel: LogLevel = LogLevel.INFO;
let logHandlers: LogHandler[] = [];
let sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

export const getLogLevel = (): LogLevel => currentLogLevel;

export const setSessionId = (id: string): void => {
  sessionId = id;
};

export const addLogHandler = (handler: LogHandler): void => {
  logHandlers.push(handler);
};

export const removeLogHandler = (handler: LogHandler): void => {
  logHandlers = logHandlers.filter(h => h !== handler);
};

function formatLogEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
  error: Error | null = null
): LogEntry {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = {
    timestamp,
    level: LogLevelNames[level],
    levelValue: level,
    message,
    context,
    sessionId,
    url: typeof window !== 'undefined' ? window.location.href : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return entry;
}

function log(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
  error: Error | null = null
): void {
  if (level < currentLogLevel) return;

  const entry = formatLogEntry(level, message, context, error);

  // Console output in development
  const consoleFn = (['debug', 'info', 'warn', 'error', 'error'] as const)[level];
  if (typeof console !== 'undefined' && console[consoleFn]) {
    console[consoleFn](`[${entry.level}] ${message}`, context);
    if (error) console.error(error);
  }

  // Call registered handlers
  logHandlers.forEach(handler => {
    try {
      handler(entry);
    } catch (err) {
      console.error('Log handler error:', err);
    }
  });
}

export const debug = (message: string, context: Record<string, unknown> = {}): void => {
  log(LogLevel.DEBUG, message, context);
};

export const info = (message: string, context: Record<string, unknown> = {}): void => {
  log(LogLevel.INFO, message, context);
};

export const warn = (message: string, context: Record<string, unknown> = {}, error: Error | null = null): void => {
  log(LogLevel.WARN, message, context, error);
};

export const error = (message: string, context: Record<string, unknown> = {}, errorObj: Error | null = null): void => {
  log(LogLevel.ERROR, message, context, errorObj);
};

export const fatal = (message: string, context: Record<string, unknown> = {}, errorObj: Error | null = null): void => {
  log(LogLevel.FATAL, message, context, errorObj);
};

export interface NamespaceLogger {
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
  error: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
  fatal: (msg: string, ctx?: Record<string, unknown>, err?: Error | null) => void;
}

export const createLogger = (namespace: string): NamespaceLogger => {
  return {
    debug: (msg, ctx) => debug(`[${namespace}] ${msg}`, ctx),
    info: (msg, ctx) => info(`[${namespace}] ${msg}`, ctx),
    warn: (msg, ctx, err) => warn(`[${namespace}] ${msg}`, ctx, err),
    error: (msg, ctx, err) => error(`[${namespace}] ${msg}`, ctx, err),
    fatal: (msg, ctx, err) => fatal(`[${namespace}] ${msg}`, ctx, err),
  };
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
