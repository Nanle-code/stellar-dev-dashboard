/**
 * Observability Dashboard Configuration
 *
 * Exports:
 *  1. `GRAFANA_DASHBOARD`   – Grafana dashboard JSON (import via the UI or
 *                             provisioning API at /api/dashboards/import)
 *  2. `SENTRY_SAVED_QUERIES` – Pre-built Sentry Discover query definitions
 *                              (paste into Sentry → Discover → Saved Queries)
 *  3. `exportGrafanaDashboard()` – Downloads the JSON file in the browser
 *  4. `getDatadogMonitorTemplate()` – Datadog monitor JSON for p95 latency
 *
 * These configs visualise:
 *  - Error rates and unhandled exception counts
 *  - API latency percentiles (p50 / p95 / p99)
 *  - Core Web Vitals (LCP, CLS, FID)
 *  - Client-side health score over time
 *  - Cache hit ratios
 *  - Memory pressure
 */

// ─── Grafana dashboard JSON ───────────────────────────────────────────────────

/**
 * A ready-to-import Grafana dashboard for the Stellar Dev Dashboard.
 *
 * Assumes:
 *  - Prometheus data source named "Prometheus"  (change `datasource` if yours differs)
 *  - Metrics emitted by your app or a synthetic exporter into Prometheus
 *    following the naming convention below.
 *
 * Metric naming convention (use a Prometheus Pushgateway or custom exporter
 * to forward the RUM events emitted by `src/lib/performance.ts`):
 *
 *   stellar_dashboard_lcp_milliseconds
 *   stellar_dashboard_fid_milliseconds
 *   stellar_dashboard_cls_ratio
 *   stellar_dashboard_health_score        (gauge 0–100)
 *   stellar_dashboard_api_request_duration_seconds{endpoint, method, status}
 *   stellar_dashboard_error_total{category, severity}
 *   stellar_dashboard_cache_hits_total{namespace}
 *   stellar_dashboard_cache_misses_total{namespace}
 */
export const GRAFANA_DASHBOARD = {
  title: 'Stellar Dev Dashboard — Production Health',
  uid: 'stellar-prod-health-v1',
  schemaVersion: 38,
  version: 1,
  refresh: '30s',
  time: { from: 'now-3h', to: 'now' },
  templating: {
    list: [
      {
        name: 'datasource',
        type: 'datasource',
        pluginId: 'prometheus',
        label: 'Prometheus',
        current: { text: 'Prometheus', value: 'Prometheus' },
      },
    ],
  },
  panels: [
    // ── Row 1: Health overview ────────────────────────────────────────────
    {
      id: 1,
      type: 'stat',
      title: 'Health Score (avg)',
      gridPos: { x: 0, y: 0, w: 4, h: 4 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'avg(stellar_dashboard_health_score)',
          legendFormat: 'Health Score',
        },
      ],
      options: {
        colorMode: 'background',
        thresholds: {
          steps: [
            { value: 0,  color: 'red' },
            { value: 50, color: 'orange' },
            { value: 80, color: 'green' },
          ],
        },
      },
    },
    {
      id: 2,
      type: 'stat',
      title: 'Error Rate (5m)',
      gridPos: { x: 4, y: 0, w: 4, h: 4 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'sum(rate(stellar_dashboard_error_total[5m]))',
          legendFormat: 'Errors/s',
        },
      ],
      options: {
        colorMode: 'background',
        thresholds: {
          steps: [
            { value: 0,    color: 'green' },
            { value: 0.01, color: 'orange' },
            { value: 0.1,  color: 'red' },
          ],
        },
      },
    },
    {
      id: 3,
      type: 'stat',
      title: 'LCP (p75)',
      gridPos: { x: 8, y: 0, w: 4, h: 4 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'histogram_quantile(0.75, rate(stellar_dashboard_lcp_milliseconds_bucket[5m]))',
          legendFormat: 'LCP p75 ms',
        },
      ],
      options: {
        unit: 'ms',
        colorMode: 'background',
        thresholds: {
          steps: [
            { value: 0,    color: 'green' },
            { value: 2500, color: 'orange' },
            { value: 4000, color: 'red' },
          ],
        },
      },
    },
    {
      id: 4,
      type: 'stat',
      title: 'Cache Hit Ratio',
      gridPos: { x: 12, y: 0, w: 4, h: 4 },
      datasource: '$datasource',
      targets: [
        {
          expr: `
            sum(rate(stellar_dashboard_cache_hits_total[5m]))
            / (
              sum(rate(stellar_dashboard_cache_hits_total[5m]))
              + sum(rate(stellar_dashboard_cache_misses_total[5m]))
            )
          `,
          legendFormat: 'Hit Ratio',
        },
      ],
      options: {
        unit: 'percentunit',
        colorMode: 'background',
        thresholds: {
          steps: [
            { value: 0,   color: 'red' },
            { value: 0.7, color: 'orange' },
            { value: 0.9, color: 'green' },
          ],
        },
      },
    },

    // ── Row 2: API latency percentiles ────────────────────────────────────
    {
      id: 10,
      type: 'timeseries',
      title: 'API Request Duration — p50 / p95 / p99',
      gridPos: { x: 0, y: 4, w: 16, h: 8 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'histogram_quantile(0.50, sum by (le) (rate(stellar_dashboard_api_request_duration_seconds_bucket[5m])))',
          legendFormat: 'p50',
        },
        {
          expr: 'histogram_quantile(0.95, sum by (le) (rate(stellar_dashboard_api_request_duration_seconds_bucket[5m])))',
          legendFormat: 'p95',
        },
        {
          expr: 'histogram_quantile(0.99, sum by (le) (rate(stellar_dashboard_api_request_duration_seconds_bucket[5m])))',
          legendFormat: 'p99',
        },
      ],
      fieldConfig: {
        defaults: {
          unit: 's',
          custom: { lineWidth: 2 },
        },
      },
    },

    // ── Row 3: Error breakdown ────────────────────────────────────────────
    {
      id: 20,
      type: 'timeseries',
      title: 'Errors by Severity',
      gridPos: { x: 0, y: 12, w: 12, h: 6 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'sum by (severity) (rate(stellar_dashboard_error_total[5m]))',
          legendFormat: '{{severity}}',
        },
      ],
      fieldConfig: { defaults: { unit: 'short' } },
    },
    {
      id: 21,
      type: 'timeseries',
      title: 'Errors by Category',
      gridPos: { x: 12, y: 12, w: 12, h: 6 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'sum by (category) (rate(stellar_dashboard_error_total[5m]))',
          legendFormat: '{{category}}',
        },
      ],
      fieldConfig: { defaults: { unit: 'short' } },
    },

    // ── Row 4: Core Web Vitals ────────────────────────────────────────────
    {
      id: 30,
      type: 'timeseries',
      title: 'Core Web Vitals over time',
      gridPos: { x: 0, y: 18, w: 24, h: 7 },
      datasource: '$datasource',
      targets: [
        {
          expr: 'histogram_quantile(0.75, rate(stellar_dashboard_lcp_milliseconds_bucket[5m]))',
          legendFormat: 'LCP p75 (ms)',
        },
        {
          expr: 'histogram_quantile(0.75, rate(stellar_dashboard_fid_milliseconds_bucket[5m]))',
          legendFormat: 'FID p75 (ms)',
        },
        {
          expr: 'avg(stellar_dashboard_cls_ratio)',
          legendFormat: 'CLS (avg ×1000)',
          transformations: [{ id: 'multiplyBy', options: { value: 1000 } }],
        },
      ],
      fieldConfig: { defaults: { unit: 'ms' } },
    },
  ],
} as const;

// ─── Sentry Discover saved queries ───────────────────────────────────────────

/**
 * Paste each entry's `query` into Sentry → Discover → "Saved Queries".
 * Column definitions map directly to Sentry Discover field names.
 */
export const SENTRY_SAVED_QUERIES = [
  {
    name: 'Unhandled Exceptions — last 24 h',
    query: 'event.type:error !has:handled.exception',
    fields: ['count()', 'issue', 'title', 'project', 'last_seen()'],
    orderby: '-count()',
    range: '24h',
  },
  {
    name: 'P95 Transaction Duration',
    query: 'event.type:transaction',
    fields: ['transaction', 'count()', 'p50(transaction.duration)', 'p95(transaction.duration)', 'p99(transaction.duration)'],
    orderby: '-p95(transaction.duration)',
    range: '1h',
  },
  {
    name: 'Critical Errors by Category',
    query: 'event.type:error level:fatal',
    fields: ['count()', 'issue', 'tags[category]', 'tags[severity]', 'last_seen()'],
    orderby: '-count()',
    range: '7d',
  },
  {
    name: 'Frontend Web Vitals — LCP outliers',
    query: 'event.type:transaction measurements.lcp:>4000',
    fields: ['transaction', 'measurements.lcp', 'measurements.fid', 'measurements.cls', 'count()'],
    orderby: '-measurements.lcp',
    range: '6h',
  },
  {
    name: 'Stellar Horizon API Errors',
    query: 'event.type:error tags[category]:network tags[context]:*horizon*',
    fields: ['count()', 'issue', 'title', 'tags[url]', 'last_seen()'],
    orderby: '-count()',
    range: '24h',
  },
] as const;

// ─── Datadog monitor template ─────────────────────────────────────────────────

/**
 * Datadog monitor JSON for p95 API latency alerting.
 * Use with the Datadog API: POST /api/v1/monitor
 * or import via the Datadog Terraform provider.
 */
export function getDatadogMonitorTemplate(service = 'stellar-dev-dashboard'): object {
  return {
    name:    `[${service}] API p95 Latency SLO breach`,
    type:    'metric alert',
    query:   `percentile(last_5m):p95:stellar.dashboard.api.request.duration.seconds{service:${service}} > 2`,
    message: `
p95 API latency for **${service}** has exceeded 2 seconds over the past 5 minutes.

Runbook: https://your-wiki/runbooks/high-api-latency

@pagerduty-${service} @slack-alerts-${service}
    `.trim(),
    tags: [`service:${service}`, 'team:platform', 'severity:high'],
    options: {
      thresholds: {
        critical: 2,    // seconds
        warning:  1,
      },
      notify_no_data:    true,
      no_data_timeframe: 10,
      renotify_interval: 30,
      include_tags:      true,
      evaluation_delay:  60,
    },
    priority: 2,
  };
}

// ─── Browser download helper ──────────────────────────────────────────────────

/**
 * Downloads the Grafana dashboard JSON as a file in the browser.
 * Wire this to a "Export Dashboard" button in the admin panel.
 */
export function exportGrafanaDashboard(): void {
  const blob = new Blob(
    [JSON.stringify(GRAFANA_DASHBOARD, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), {
    href:     url,
    download: 'stellar-dashboard-grafana.json',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
