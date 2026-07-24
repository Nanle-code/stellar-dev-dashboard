/**
 * Alert Channels & Dashboard Templates (#461)
 *
 * Provides:
 *  - Multi-channel alert delivery (in-app, browser, webhook, email stub)
 *  - Escalation policies with delay and re-escalation
 *  - Dashboard template registry (system health, latency, business metrics)
 *  - Dashboard sharing helpers (export / import JSON)
 */

import { alertCenter } from './alerts'

// ─── Channel types ────────────────────────────────────────────────────────────

export type AlertChannelType = 'in_app' | 'browser' | 'webhook' | 'email'

export interface AlertPayload {
  id: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
  tags?: string[]
}

export interface ChannelConfig {
  type: AlertChannelType
  webhookUrl?: string
  emailAddress?: string
}

// ─── In-app channel ───────────────────────────────────────────────────────────

function deliverInApp(payload: AlertPayload): void {
  alertCenter.push([
    {
      id: payload.id,
      title: payload.title,
      description: payload.description,
      severity: payload.severity,
    },
  ])
}

// ─── Browser notification channel ─────────────────────────────────────────────

function deliverBrowser(payload: AlertPayload): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(`[${payload.severity.toUpperCase()}] ${payload.title}`, {
      body: payload.description,
      icon: '/favicon.ico',
      tag: payload.id,
    })
  } catch {
    // non-fatal: browser may block
  }
}

// ─── Webhook channel ─────────────────────────────────────────────────────────

async function deliverWebhook(payload: AlertPayload, url: string): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    console.warn('[alertChannels] Webhook delivery failed:', url)
  }
}

// ─── Dispatch to all configured channels ─────────────────────────────────────

export async function dispatchToChannels(
  payload: AlertPayload,
  channels: ChannelConfig[],
): Promise<void> {
  for (const ch of channels) {
    switch (ch.type) {
      case 'in_app':
        deliverInApp(payload)
        break
      case 'browser':
        deliverBrowser(payload)
        break
      case 'webhook':
        if (ch.webhookUrl) await deliverWebhook(payload, ch.webhookUrl)
        break
      case 'email':
        // Email delivery is a stub — integrate your email provider here
        console.info('[alertChannels] Email stub for:', ch.emailAddress, payload.title)
        break
    }
  }
}

// ─── Escalation engine ────────────────────────────────────────────────────────

export interface EscalationStep {
  delayMs: number
  channels: ChannelConfig[]
  message?: string
}

export interface EscalationPolicy {
  id: string
  name: string
  steps: EscalationStep[]
}

const _escalationTimers = new Map<string, ReturnType<typeof setTimeout>[]>()

export function triggerEscalation(
  alertId: string,
  payload: AlertPayload,
  policy: EscalationPolicy,
): void {
  cancelEscalation(alertId) // cancel any previous run for same alert

  const timers: ReturnType<typeof setTimeout>[] = []
  for (const step of policy.steps) {
    const t = setTimeout(async () => {
      const escalated = {
        ...payload,
        id: `${alertId}-esc-${step.delayMs}`,
        title: step.message ? `[ESCALATED] ${step.message}` : `[ESCALATED] ${payload.title}`,
      }
      await dispatchToChannels(escalated, step.channels)
    }, step.delayMs)
    timers.push(t)
  }
  _escalationTimers.set(alertId, timers)
}

export function cancelEscalation(alertId: string): void {
  const timers = _escalationTimers.get(alertId) ?? []
  timers.forEach(t => clearTimeout(t))
  _escalationTimers.delete(alertId)
}

// ─── Dashboard Templates ──────────────────────────────────────────────────────

export interface DashboardTemplate {
  id: string
  name: string
  description: string
  widgets: DashboardWidget[]
  createdAt: string
  shared?: boolean
}

export interface DashboardWidget {
  id: string
  type: 'latency_trend' | 'health_score' | 'error_rate' | 'tx_throughput' | 'cache_ratio' | 'anomaly_list' | 'custom_metric'
  title: string
  metricKey?: string
  width: 1 | 2 | 3
}

const BUILT_IN_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'system-health',
    name: 'System Health Overview',
    description: 'Core health score, memory, online status, and latency trend',
    createdAt: new Date().toISOString(),
    widgets: [
      { id: 'w-score', type: 'health_score', title: 'Health Score', width: 1 },
      { id: 'w-latency', type: 'latency_trend', title: 'Network Latency Trend', width: 2 },
      { id: 'w-error', type: 'error_rate', title: 'API Error Rate', width: 1 },
      { id: 'w-anomaly', type: 'anomaly_list', title: 'Detected Anomalies', width: 2 },
    ],
  },
  {
    id: 'business-metrics',
    name: 'Business Metrics',
    description: 'Transaction throughput, success / failure rates, and submission latency',
    createdAt: new Date().toISOString(),
    widgets: [
      { id: 'w-tx', type: 'tx_throughput', title: 'Transaction Throughput', width: 2 },
      { id: 'w-cache', type: 'cache_ratio', title: 'Cache Hit Ratio', width: 1 },
      { id: 'w-api', type: 'latency_trend', title: 'API Latency P95', metricKey: 'technical.api.latency_ms', width: 2 },
    ],
  },
]

const STORAGE_KEY = 'dashboard-templates-v1'

function loadCustomTemplates(): DashboardTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DashboardTemplate[]) : []
  } catch {
    return []
  }
}

function saveCustomTemplates(templates: DashboardTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // quota exceeded – ignore
  }
}

export function getAllTemplates(): DashboardTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()]
}

export function saveTemplate(template: DashboardTemplate): void {
  const custom = loadCustomTemplates().filter(t => t.id !== template.id)
  custom.push(template)
  saveCustomTemplates(custom)
}

export function deleteTemplate(id: string): void {
  const custom = loadCustomTemplates().filter(t => t.id !== id)
  saveCustomTemplates(custom)
}

export function exportTemplate(template: DashboardTemplate): string {
  return JSON.stringify(template, null, 2)
}

export function importTemplate(json: string): DashboardTemplate {
  const parsed = JSON.parse(json) as DashboardTemplate
  if (!parsed.id || !parsed.name || !Array.isArray(parsed.widgets)) {
    throw new Error('Invalid dashboard template format')
  }
  // Re-assign id to avoid collision
  parsed.id = `imported-${Date.now()}`
  parsed.shared = false
  saveTemplate(parsed)
  return parsed
}
