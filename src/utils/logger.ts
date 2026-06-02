/**
 * Structured logging utility for production debugging
 * Provides leveled logging with context and stack traces
 */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

const LogLevelNames = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'FATAL',
};

let currentLogLevel = LogLevel.INFO;
let logHandlers = [];
let sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Set the minimum log level
 */
export const setLogLevel = (level) => {
  currentLogLevel = level;
};

/**
 * Get current log level
 */
export const getLogLevel = () => currentLogLevel;

/**
 * Set session ID for all logs
 */
export const setSessionId = (id) => {
  sessionId = id;
};

/**
 * Add a log handler (e.g., for remote logging)
 */
export const addLogHandler = (handler) => {
  logHandlers.push(handler);
};

/**
 * Remove a log handler
 */
export const removeLogHandler = (handler) => {
  logHandlers = logHandlers.filter(h => h !== handler);
};

/**
 * Format log entry
 */
function formatLogEntry(level, message, context = {}, error = null) {
  const timestamp = new Date().toISOString();
  const entry = {
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

/**
 * Log a message at specified level
 */
function log(level, message, context = {}, error = null) {
  if (level < currentLogLevel) return;

  const entry = formatLogEntry(level, message, context, error);

  // Console output in development
  const consoleFn = ['debug', 'info', 'warn', 'error', 'error'][level];
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

/**
 * Debug level log
 */
export const debug = (message, context = {}) => {
  log(LogLevel.DEBUG, message, context);
};

/**
 * Info level log
 */
export const info = (message, context = {}) => {
  log(LogLevel.INFO, message, context);
};

/**
 * Warn level log
 */
export const warn = (message, context = {}, error = null) => {
  log(LogLevel.WARN, message, context, error);
};

/**
 * Error level log
 */
export const error = (message, context = {}, errorObj = null) => {
  log(LogLevel.ERROR, message, context, errorObj);
};

/**
 * Fatal level log
 */
export const fatal = (message, context = {}, errorObj = null) => {
  log(LogLevel.FATAL, message, context, errorObj);
};

/**
 * Create a logger instance with a namespace
 */
export const createLogger = (namespace) => {
  return {
    debug: (msg, ctx) => debug(`[${namespace}] ${msg}`, ctx),
    info: (msg, ctx) => info(`[${namespace}] ${msg}`, ctx),
    warn: (msg, ctx, err) => warn(`[${namespace}] ${msg}`, ctx, err),
    error: (msg, ctx, err) => error(`[${namespace}] ${msg}`, ctx, err),
    fatal: (msg, ctx, err) => fatal(`[${namespace}] ${msg}`, ctx, err),
  };
};

// Default export as singleton
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
