/**
 * Alert Dispatch – Slack & PagerDuty Webhook Integration
 *
 * Sits on top of the existing `alertChannels.ts` delivery layer and adds
 * production-grade routing to external incident management services.
 *
 * Routing rules:
 *  - severity "info"     → in-app + browser notification only
 *  - severity "warning"  → in-app + browser + Slack (if configured)
 *  - severity "critical" → in-app + browser + Slack + PagerDuty
 *
 * Environment / runtime configuration:
 *  VITE_SLACK_WEBHOOK_URL      – Incoming Webhook URL from your Slack App
 *  VITE_PAGERDUTY_ROUTING_KEY  – PagerDuty Events API v2 Integration Key
 *
 * You can also call `configureAlertDispatch()` at runtime to override or
 * extend the defaults without redeploying.
 */

import * as Sentry from '@sentry/react';
import { dispatchToChannels, type AlertPayload } from './alertChannels';
import { createLogger } from '../utils/logger';

const logger = createLogger('AlertDispatch');

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AlertDispatchConfig {
  /** Slack Incoming Webhook URL – leave undefined to disable Slack delivery. */
  slackWebhookUrl?: string;
  /**
   * PagerDuty Events API v2 routing / integration key.
   * Leave undefined to disable PagerDuty delivery.
   */
  pagerDutyRoutingKey?: string;
  /**
   * Human-readable service name included in Slack/PD payloads.
   * Defaults to "stellar-dev-dashboard".
   */
  serviceName: string;
  /**
   * If `true`, Slack/PagerDuty calls are skipped and payloads are logged
   * to the console instead.  Automatically `true` in non-production builds.
   */
  dryRun: boolean;
}

let _cfg: AlertDispatchConfig = {
  slackWebhookUrl: import.meta.env.VITE_SLACK_WEBHOOK_URL as string | undefined,
  pagerDutyRoutingKey: import.meta.env.VITE_PAGERDUTY_ROUTING_KEY as string | undefined,
  serviceName: 'stellar-dev-dashboard',
  // Only fire live webhooks in production builds to avoid alert noise during dev
  dryRun: import.meta.env.MODE !== 'production',
};

export function configureAlertDispatch(overrides: Partial<AlertDispatchConfig>): void {
  _cfg = { ..._cfg, ...overrides };
  logger.info('Alert dispatch reconfigured', {
    slackEnabled: !!_cfg.slackWebhookUrl,
    pagerDutyEnabled: !!_cfg.pagerDutyRoutingKey,
    dryRun: _cfg.dryRun,
  });
}

// ─── Slack payload builder ────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  info:     ':information_source:',
  warning:  ':warning:',
  critical: ':red_circle:',
};

const SEVERITY_COLOR: Record<string, string> = {
  info:     '#2196F3',
  warning:  '#FF9800',
  critical: '#F44336',
};

function buildSlackPayload(alert: AlertPayload, serviceName: string): object {
  const emoji = SEVERITY_EMOJI[alert.severity] ?? ':bell:';
  const color = SEVERITY_COLOR[alert.severity] ?? '#9E9E9E';

  return {
    text: `${emoji} *[${alert.severity.toUpperCase()}]* ${alert.title}`,
    attachments: [
      {
        color,
        fields: [
          { title: 'Service',     value: serviceName,       short: true },
          { title: 'Severity',    value: alert.severity,    short: true },
          { title: 'Description', value: alert.description, short: false },
          { title: 'Alert ID',    value: alert.id,          short: true },
          { title: 'Timestamp',   value: alert.timestamp,   short: true },
          ...(alert.tags?.length
            ? [{ title: 'Tags', value: alert.tags.join(', '), short: false }]
            : []),
        ],
        footer: serviceName,
        ts: Math.floor(Date.parse(alert.timestamp) / 1000),
      },
    ],
  };
}

async function sendSlack(payload: object, webhookUrl: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned HTTP ${response.status}`);
  }
}

// ─── PagerDuty payload builder ────────────────────────────────────────────────

type PagerDutyEventAction = 'trigger' | 'acknowledge' | 'resolve';

function buildPagerDutyPayload(
  alert: AlertPayload,
  serviceName: string,
  action: PagerDutyEventAction = 'trigger',
): object {
  return {
    routing_key: _cfg.pagerDutyRoutingKey,
    event_action: action,
    dedup_key: alert.id,
    payload: {
      summary:       `[${serviceName}] ${alert.title}`,
      source:        serviceName,
      severity:      alert.severity === 'critical' ? 'critical' : 'warning',
      timestamp:     alert.timestamp,
      class:         'application_alert',
      component:     serviceName,
      group:         serviceName,
      custom_details: {
        description: alert.description,
        alert_id:    alert.id,
        tags:        alert.tags ?? [],
      },
    },
    links: [
      {
        href:  typeof window !== 'undefined' ? window.location.href : serviceName,
        text: 'Open Dashboard',
      },
    ],
  };
}

async function sendPagerDuty(payload: object): Promise<void> {
  const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PagerDuty API returned HTTP ${response.status}: ${body}`);
  }
}

// ─── Core dispatch ────────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** Override auto-resolved PagerDuty action. */
  pagerDutyAction?: PagerDutyEventAction;
}

/**
 * Dispatch an alert through all appropriate channels based on severity.
 *
 * - "info"     → in-app + browser
 * - "warning"  → in-app + browser + Slack
 * - "critical" → in-app + browser + Slack + PagerDuty
 *
 * External webhook calls are fire-and-forget (errors are captured in Sentry
 * and logged, but they never throw to the caller).
 */
export async function dispatchAlert(
  alert: AlertPayload,
  opts: DispatchOptions = {},
): Promise<void> {
  const { serviceName, slackWebhookUrl, pagerDutyRoutingKey, dryRun } = _cfg;

  // Always deliver in-app + browser regardless of severity
  await dispatchToChannels(alert, [{ type: 'in_app' }, { type: 'browser' }]);

  if (alert.severity === 'info') return;

  // ── Slack ─────────────────────────────────────────────────────────────────
  if (slackWebhookUrl) {
    const slackPayload = buildSlackPayload(alert, serviceName);

    if (dryRun) {
      logger.info('[DRY-RUN] Slack alert suppressed', { alert: alert.id, title: alert.title });
    } else {
      sendSlack(slackPayload, slackWebhookUrl).catch(err => {
        logger.warn('Slack delivery failed', { alertId: alert.id }, err);
        Sentry.captureException(err, { tags: { subsystem: 'alertDispatch', channel: 'slack' } });
      });
    }
  }

  if (alert.severity !== 'critical') return;

  // ── PagerDuty ─────────────────────────────────────────────────────────────
  if (pagerDutyRoutingKey) {
    const action = opts.pagerDutyAction ?? 'trigger';
    const pdPayload = buildPagerDutyPayload(alert, serviceName, action);

    if (dryRun) {
      logger.info('[DRY-RUN] PagerDuty alert suppressed', { alert: alert.id, title: alert.title });
    } else {
      sendPagerDuty(pdPayload).catch(err => {
        logger.warn('PagerDuty delivery failed', { alertId: alert.id }, err);
        Sentry.captureException(err, { tags: { subsystem: 'alertDispatch', channel: 'pagerduty' } });
      });
    }
  }
}

/**
 * Convenience wrapper: resolve an active PagerDuty incident by dedup key.
 * Pass the original alert ID that was used to trigger the incident.
 */
export function resolvePagerDutyIncident(alertId: string, title: string): void {
  const { pagerDutyRoutingKey, dryRun } = _cfg;
  if (!pagerDutyRoutingKey) return;

  const resolvePayload = {
    routing_key: pagerDutyRoutingKey,
    event_action: 'resolve' as const,
    dedup_key: alertId,
    payload: {
      summary:   `RESOLVED: ${title}`,
      source:    _cfg.serviceName,
      severity:  'info',
      timestamp: new Date().toISOString(),
    },
  };

  if (dryRun) {
    logger.info('[DRY-RUN] PagerDuty resolve suppressed', { alertId });
    return;
  }

  sendPagerDuty(resolvePayload).catch(err => {
    logger.warn('PagerDuty resolve failed', { alertId }, err);
    Sentry.captureException(err, { tags: { subsystem: 'alertDispatch', channel: 'pagerduty' } });
  });
}

/**
 * Build a standard `AlertPayload` from a raw error.
 * Use with `dispatchAlert()` for one-line critical error dispatch.
 *
 * @example
 * dispatchAlert(buildAlertFromError(err, 'critical', ['stellar', 'horizon']));
 */
export function buildAlertFromError(
  err: unknown,
  severity: AlertPayload['severity'] = 'critical',
  tags: string[] = [],
): AlertPayload {
  const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const name    = err instanceof Error ? err.name    : 'Error';
  const id      = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    title:       `${name}: ${message.slice(0, 80)}`,
    description: err instanceof Error && err.stack
      ? err.stack.split('\n').slice(0, 5).join('\n')
      : message,
    severity,
    timestamp: new Date().toISOString(),
    tags,
  };
}
