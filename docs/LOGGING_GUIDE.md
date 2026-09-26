# Structured Logging Guide (#965)

This guide outlines the logging architecture, security redaction, environment configuration, and migration guidelines for the Stellar Developer Dashboard.

---

## 1. Overview

Ad-hoc `console.log` statements are prohibited in production source code (`src/`) to prevent sensitive data leakage (such as Stellar secret keys, authentication tokens, private keys, and raw payload data) to browser/node consoles.

All logging must go through the centralized structured logging module:
```ts
import { logger, createLogger, LogLevel } from '@/lib/logging';
// or from 'src/lib/logging'
```

---

## 2. Core Features

### 2.1 Log Levels
The logging module supports 5 standardized levels:
- `DEBUG` (0): Detailed diagnostic output for local development. Filtered out by default in production.
- `INFO` (1): General application milestones and lifecycle events. Filtered out by default in production.
- `WARN` (2): Recoverable anomalies, fallback behaviors, or performance warnings.
- `ERROR` (3): Handled exceptions and operational errors.
- `CRITICAL` (4): Severe failures that impact system stability or fatal errors.

### 2.2 Environment-Aware Level Filtering
- **Development**: Defaults to `LogLevel.DEBUG`.
- **Production (`NODE_ENV === 'production'` or Vite `PROD`)**: Defaults to `LogLevel.WARN`. All `debug` and `info` entries are stripped/dropped from the log buffer and console output.
- **Custom Configuration**: You can override the log level via environment variables:
  - `LOG_LEVEL=DEBUG` (or `VITE_LOG_LEVEL=INFO`)
  - Or programmatically via `logger.setLogLevel(LogLevel.DEBUG)` / `logger.setLevel('info')`.

---

## 3. Sensitive Data Redaction (#774 / #965)

The structured logger automatically redacts sensitive data from log messages, context objects, and tag arrays before storing or outputting:
1. **Stellar Secret Keys**: Any StrKey secret starting with `S` (56 base32 characters) is replaced with `[REDACTED_SECRET_KEY]`.
2. **Bearer & Authorization Tokens**: `Bearer <token>` / `Token <token>` patterns are replaced with `Bearer [REDACTED]`.
3. **Sensitive Context Keys**: Fields named `password`, `secret`, `privateKey`, `seed`, `apiKey`, `token`, `authorization`, etc. are automatically redacted to `[REDACTED]` even in deeply nested objects.

---

## 4. Usage Examples

### 4.1 Basic Logging
```ts
import { logger } from '@/lib/logging';

logger.debug('Fetching horizon ledger data', { sequence: 123456 });
logger.info('User profile updated successfully', { userId: 'usr_abc' });
logger.warn('Rate limit approaching', { remaining: 2, resetInMs: 1500 });
logger.error('Failed to submit transaction', { txHash: '0x123' }, ['stellar', 'horizon']);
```

### 4.2 Namespaced Loggers
Use `createLogger(namespace)` for component- or module-specific logging:
```ts
import { createLogger } from '@/lib/logging';

const log = createLogger('TransactionBuilder');

log.info('Building payment transaction');
log.error('Transaction build error', { code: 'OP_MALFORMED' });
```

### 4.3 Correlation IDs & Tracing
```ts
logger.setCorrelationId('req-98765-abcd');
logger.setSessionId('sess-12345');

logger.info('Handling incoming RPC request');
// Logs emitted will include the correlation ID and session ID for distributed tracing
```

### 4.4 Subscribing & Exporting Logs
```ts
// Subscribe to live log events (e.g. for developer UI or telemetry)
const unsubscribe = logger.subscribe((entry) => {
  // entry contains { id, timestamp, level, message, context, correlationId, tags }
});

// Export logs for diagnostics
const jsonDump = logger.exportLogs('json');
const textDump = logger.exportLogs('text');
```

---

## 5. Migration Guide from `console.log`

| Legacy Code | Modern Structured Logging |
| :--- | :--- |
| `console.log('App started')` | `logger.info('App started')` |
| `console.debug('Loaded cache', data)` | `logger.debug('Loaded cache', { data })` |
| `console.warn('Slow network', latency)` | `logger.warn('Slow network', { latency })` |
| `console.error('API Error', err)` | `logger.error('API Error: ' + err.message, { error: err })` |
| In CommonJS (`.cjs`): `console.log(...)` | `const { logger } = require('../../lib/logging/logger.js'); logger.info(...)` |

---

## 6. Linting Rules

ESLint enforces `no-console: ['error', { allow: ['warn', 'error'] }]` across all source files in `src/`.
Direct calls to `console.log`, `console.info`, `console.debug` are flagged as errors during CI checks.
Use `logger` from `src/lib/logging` for all diagnostics.
