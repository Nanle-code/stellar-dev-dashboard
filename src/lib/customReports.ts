export type ReportComponentType = "metric" | "chart" | "table";
export type ReportResource = "accounts" | "transactions" | "operations" | "ledgers" | "payments";
export type DeliveryChannel = "email" | "webhook";

export interface ReportComponentDefinition {
  id: string;
  type: ReportComponentType;
  label: string;
  dataKey: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  resource: ReportResource;
  components: ReportComponentDefinition[];
}

export interface HorizonQueryConfig {
  resource: ReportResource;
  network?: "public" | "testnet" | string;
  accountId?: string;
  cursor?: string;
  order?: "asc" | "desc";
  limit?: number;
  filters?: Record<string, string | number | boolean | undefined>;
}

export interface BuiltHorizonQuery {
  resource: ReportResource;
  endpoint: string;
  params: Record<string, string>;
  url: string;
}

export interface ReportDataSet {
  account?: Record<string, any>;
  transactions?: Record<string, any>;
  network?: Record<string, any>;
  activity?: Array<Record<string, any>>;
  risks?: Array<Record<string, any>>;
}

export interface TransformedReportData {
  templateId: string;
  generatedAt: string;
  metrics: Array<{ label: string; value: string | number }>;
  chartData: Array<Record<string, any>>;
  rows: Array<Record<string, any>>;
  columns: string[];
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  channels: DeliveryChannel[];
  recipients: string[];
  webhookUrl?: string;
  nextRunAt: string;
}

const HORIZON_BASE_URLS: Record<string, string> = {
  public: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
};

const RESOURCE_ENDPOINTS: Record<ReportResource, string> = {
  accounts: "/accounts",
  transactions: "/transactions",
  operations: "/operations",
  ledgers: "/ledgers",
  payments: "/payments",
};

export const REPORT_COMPONENT_PALETTE: ReportComponentDefinition[] = [
  { id: "metric-total", type: "metric", label: "Metric", dataKey: "metrics" },
  { id: "chart-activity", type: "chart", label: "Chart", dataKey: "activity" },
  { id: "table-records", type: "table", label: "Table", dataKey: "rows" },
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "account-activity",
    name: "Account Activity",
    description: "Track balances, signer risk, and recent transaction volume for an account.",
    resource: "accounts",
    components: [
      { id: "account-balance", type: "metric", label: "XLM Balance", dataKey: "account.xlmBalance" },
      { id: "account-activity-chart", type: "chart", label: "Daily Activity", dataKey: "activity" },
      { id: "account-risk-table", type: "table", label: "Risk Signals", dataKey: "risks" },
    ],
  },
  {
    id: "portfolio-performance",
    name: "Portfolio Performance",
    description: "Summarize trustlines, asset counts, and fee movement over time.",
    resource: "accounts",
    components: [
      { id: "portfolio-assets", type: "metric", label: "Assets", dataKey: "account.totalAssets" },
      { id: "portfolio-fees", type: "chart", label: "Fee Trend", dataKey: "activity" },
      { id: "portfolio-summary", type: "table", label: "Portfolio Summary", dataKey: "account" },
    ],
  },
  {
    id: "transaction-analysis",
    name: "Transaction Analysis",
    description: "Inspect transaction success rates and operation mix.",
    resource: "transactions",
    components: [
      { id: "tx-success-rate", type: "metric", label: "Success Rate", dataKey: "transactions.successRate" },
      { id: "tx-activity", type: "chart", label: "Transaction Trend", dataKey: "activity" },
      { id: "tx-breakdown", type: "table", label: "Operation Mix", dataKey: "transactions.opTypeCounts" },
    ],
  },
  {
    id: "network-health",
    name: "Network Health",
    description: "Monitor ledger freshness, fees, and close-time health.",
    resource: "ledgers",
    components: [
      { id: "network-ledger", type: "metric", label: "Latest Ledger", dataKey: "network.latestLedgerSequence" },
      { id: "network-close-time", type: "chart", label: "Close Time", dataKey: "activity" },
      { id: "network-fees", type: "table", label: "Network Fees", dataKey: "network" },
    ],
  },
];

function normalizeLimit(limit?: number) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return "200";
  return String(Math.min(Math.max(Math.trunc(parsed), 1), 200));
}

function getNestedValue(source: Record<string, any>, path: string) {
  return path.split(".").reduce<any>((value, key) => value?.[key], source);
}

function normalizeRowSet(value: any): Array<Record<string, any>> {
  if (Array.isArray(value)) return value.map((entry, index) => ({ id: entry.id || index + 1, ...entry }));
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => {
      if (entry && typeof entry === "object") return { id: key, ...entry };
      return { id: key, value: entry };
    });
  }
  return [{ id: "value", value }];
}

function escapeCsvValue(value: any) {
  const stringValue = value == null ? "" : String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function sanitizeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

export function getReportTemplate(templateId: string) {
  return REPORT_TEMPLATES.find((template) => template.id === templateId) || REPORT_TEMPLATES[0];
}

export function buildHorizonQuery(config: HorizonQueryConfig): BuiltHorizonQuery {
  const resource = config.resource;
  const endpoint = RESOURCE_ENDPOINTS[resource];
  if (!endpoint) {
    throw new Error(`Unsupported Horizon report resource: ${resource}`);
  }

  const baseUrl = HORIZON_BASE_URLS[config.network || "testnet"] || String(config.network || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("A Horizon base URL or known network is required");
  }

  const params: Record<string, string> = {
    cursor: config.cursor || "now",
    order: config.order || "desc",
    limit: normalizeLimit(config.limit),
  };

  Object.entries(config.filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params[key] = String(value);
  });

  const accountScoped = ["transactions", "operations", "payments"].includes(resource) && config.accountId;
  const path = accountScoped ? `/accounts/${encodeURIComponent(config.accountId || "")}${endpoint}` : endpoint;
  const search = new URLSearchParams(params);

  return {
    resource,
    endpoint: path,
    params,
    url: `${baseUrl}${path}?${search.toString()}`,
  };
}

export function transformReportData(templateId: string, dataSet: ReportDataSet): TransformedReportData {
  const template = getReportTemplate(templateId);
  const source = {
    account: dataSet.account || {},
    transactions: dataSet.transactions || {},
    network: dataSet.network || {},
    activity: dataSet.activity || [],
    risks: dataSet.risks || [],
  };

  const metrics = template.components
    .filter((component) => component.type === "metric")
    .map((component) => {
      const value = getNestedValue(source, component.dataKey);
      const normalized = typeof value === "number" && component.dataKey.includes("successRate")
        ? `${(value * 100).toFixed(1)}%`
        : value ?? "N/A";
      return { label: component.label, value: normalized };
    });

  const chartComponent = template.components.find((component) => component.type === "chart");
  const tableComponent = template.components.find((component) => component.type === "table");
  const chartData = normalizeRowSet(getNestedValue(source, chartComponent?.dataKey || "activity"));
  const rows = normalizeRowSet(getNestedValue(source, tableComponent?.dataKey || template.resource));
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);

  return {
    templateId: template.id,
    generatedAt: new Date().toISOString(),
    metrics,
    chartData,
    rows,
    columns,
  };
}

export function createReportCache(ttlMs = 5 * 60 * 1000) {
  const entries = new Map<string, { expiresAt: number; value: any }>();

  return {
    get(key: string) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: any) {
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    remember(key: string, factory: () => any) {
      const cached = this.get(key);
      if (cached !== undefined) return cached;
      return this.set(key, factory());
    },
    clear() {
      entries.clear();
    },
    size() {
      return entries.size;
    },
  };
}

export function exportReportAsJson(template: ReportTemplate, data: TransformedReportData) {
  return JSON.stringify({ template, data }, null, 2);
}

export function exportReportAsCsv(data: TransformedReportData) {
  const metricRows: Array<Record<string, any>> = data.metrics.map((metric) => ({
    section: "metric",
    label: metric.label,
    value: metric.value,
  }));
  const tableRows: Array<Record<string, any>> = data.rows.map((row) => ({
    section: "row",
    ...row,
  }));
  const rows: Array<Record<string, any>> = [...metricRows, ...tableRows];
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const body = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(","));
  return [headers.join(","), ...body].join("\n");
}

export function createPdfReportPayload(template: ReportTemplate, data: TransformedReportData) {
  const metricHtml = data.metrics
    .map((metric) => `<li><strong>${metric.label}</strong>: ${metric.value}</li>`)
    .join("");
  const tableHead = data.columns.map((column) => `<th>${column}</th>`).join("");
  const tableBody = data.rows
    .slice(0, 25)
    .map((row) => `<tr>${data.columns.map((column) => `<td>${row[column] ?? ""}</td>`).join("")}</tr>`)
    .join("");

  return {
    filename: `${sanitizeFilePart(template.name)}.pdf.html`,
    contentType: "text/html",
    html: `<!doctype html><html><head><meta charset="utf-8"><title>${template.name}</title></head><body><h1>${template.name}</h1><p>${template.description}</p><h2>Metrics</h2><ul>${metricHtml}</ul><h2>Data</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table></body></html>`,
    chartData: data.chartData,
  };
}

export function parseCronSchedule(expression: string) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Report schedules use five-part cron expressions");
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

function resolveCronPart(part: string, current: number, min: number, max: number) {
  if (part === "*") return current;
  if (part.startsWith("*/")) {
    const step = Number(part.slice(2));
    if (!Number.isFinite(step) || step <= 0) throw new Error(`Invalid cron step: ${part}`);
    const next = current + (step - (current % step));
    return next > max ? min : next;
  }
  const exact = Number(part);
  if (!Number.isInteger(exact) || exact < min || exact > max) {
    throw new Error(`Invalid cron value: ${part}`);
  }
  return exact;
}

export function getNextRunPreview(expression: string, from = new Date()) {
  const cron = parseCronSchedule(expression);
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);
  next.setMinutes(resolveCronPart(cron.minute, next.getMinutes(), 0, 59));
  next.setHours(resolveCronPart(cron.hour, next.getHours(), 0, 23));

  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isWebhook(value?: string) {
  return !value || /^https:\/\/.+/i.test(value);
}

export function createReportSchedule(input: Omit<ReportSchedule, "nextRunAt">): ReportSchedule {
  parseCronSchedule(input.cron);
  if (input.channels.includes("email") && !input.recipients.every(isEmail)) {
    throw new Error("Email report schedules require valid recipients");
  }
  if (input.channels.includes("webhook") && !isWebhook(input.webhookUrl)) {
    throw new Error("Webhook report schedules require an HTTPS URL");
  }

  return {
    ...input,
    timezone: input.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    nextRunAt: getNextRunPreview(input.cron),
  };
}

export function buildDeliveryPlan(schedule: ReportSchedule, template: ReportTemplate, data: TransformedReportData) {
  return schedule.channels.map((channel) => ({
    channel,
    target: channel === "email" ? schedule.recipients.join(", ") : schedule.webhookUrl,
    subject: `${template.name} report`,
    attachments: [
      { filename: `${sanitizeFilePart(template.name)}.json`, contentType: "application/json", body: exportReportAsJson(template, data) },
      { filename: `${sanitizeFilePart(template.name)}.csv`, contentType: "text/csv", body: exportReportAsCsv(data) },
      createPdfReportPayload(template, data),
    ],
  }));
}
