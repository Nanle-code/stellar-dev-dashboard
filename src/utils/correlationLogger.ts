/**
 * Correlation-aware logger (#823)
 *
 * Decorates the shared `utils/logger` with the currently active correlation id
 * so every diagnostic line emitted during a user action is attributable to that
 * action. Existing call sites can migrate incrementally — the base logger is
 * untouched.
 */

import { createLogger, type NamespaceLogger } from './logger';
import { getCorrelationId } from '../lib/correlation';

type LogContext = Record<string, unknown>;

function withCorrelationContext(context?: LogContext): LogContext {
  const correlationId = getCorrelationId();
  if (!correlationId) return context ?? {};
  return { ...(context ?? {}), correlationId };
}

/**
 * Create a namespace logger that automatically stamps the active correlation
 * id onto every context object.
 */
export function createCorrelatedLogger(namespace: string): NamespaceLogger {
  const base = createLogger(namespace);
  return {
    debug: (msg, ctx) => base.debug(msg, withCorrelationContext(ctx)),
    info: (msg, ctx) => base.info(msg, withCorrelationContext(ctx)),
    warn: (msg, ctx, err) => base.warn(msg, withCorrelationContext(ctx), err),
    error: (msg, ctx, err) => base.error(msg, withCorrelationContext(ctx), err),
    fatal: (msg, ctx, err) => base.fatal(msg, withCorrelationContext(ctx), err),
  };
}

export default createCorrelatedLogger;
