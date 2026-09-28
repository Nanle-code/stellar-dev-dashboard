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
  category?: string;
  tags?: string[];
  aiHint?: string;
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
  insights?: string[];
  summary?: string;
  focusAreas?: string[];
}

export interface ParsedReportRequest {
  templateId: string;
  accountId?: string;
  focusAreas: string[];
  frequency?: string;
  resource: ReportResource;
  prompt: string;
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

const REPORT_TEMPLATE_DEFINITIONS: ReportTemplate[] = [
  {
    id: "account-activity",
    name: "Account Activity",
    description: "Track balances, signer risk, and recent transaction volume for an account.",
    resource: "accounts",
    category: "account",
    tags: ["account", "activity", "risk"],
    aiHint: "Summarize balances, signer risk, and recent volume for a specific account.",
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
    category: "portfolio",
    tags: ["portfolio", "assets", "performance"],
    aiHint: "Highlight asset exposure and fee trends across a portfolio.",
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
    category: "transactions",
    tags: ["transactions", "payments", "success"],
    aiHint: "Inspect success rates and the mix of operations in a transaction stream.",
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
    category: "network",
    tags: ["network", "ledger", "health"],
    aiHint: "Monitor ledger freshness, fee pressure, and network stability.",
    components: [
      { id: "network-ledger", type: "metric", label: "Latest Ledger", dataKey: "network.latestLedgerSequence" },
      { id: "network-close-time", type: "chart", label: "Close Time", dataKey: "activity" },
      { id: "network-fees", type: "table", label: "Network Fees", dataKey: "network" },
    ],
  },
  {
    id: "asset-allocation",
    name: "Asset Allocation",
    description: "Review trustline concentration and balance allocation across assets.",
    resource: "accounts",
    category: "portfolio",
    tags: ["asset", "allocation", "trustline"],
    aiHint: "Summarize concentration by asset and trustline coverage.",
    components: [
      { id: "asset-count", type: "metric", label: "Trustlines", dataKey: "account.trustlineCount" },
      { id: "asset-chart", type: "chart", label: "Asset Mix", dataKey: "activity" },
      { id: "asset-table", type: "table", label: "Asset Distribution", dataKey: "account" },
    ],
  },
  {
    id: "signer-risk-review",
    name: "Signer Risk Review",
    description: "Focus on signature policy and single-signer exposure.",
    resource: "accounts",
    category: "security",
    tags: ["signer", "risk", "security"],
    aiHint: "Call out singlesigner exposure and signing policy anomalies.",
    components: [
      { id: "signer-metric", type: "metric", label: "Risk Signals", dataKey: "risks.length" },
      { id: "signer-chart", type: "chart", label: "Risk Timeline", dataKey: "risks" },
      { id: "signer-table", type: "table", label: "Signer Risks", dataKey: "risks" },
    ],
  },
  {
    id: "fee-efficiency",
    name: "Fee Efficiency",
    description: "Compare activity volume against fees to surface efficiency opportunities.",
    resource: "payments",
    category: "cost",
    tags: ["fee", "cost", "efficiency"],
    aiHint: "Compare transaction volume and fees to estimate efficiency.",
    components: [
      { id: "fee-metric", type: "metric", label: "Base Fee", dataKey: "network.baseFee" },
      { id: "fee-chart", type: "chart", label: "Fee Trend", dataKey: "activity" },
      { id: "fee-table", type: "table", label: "Fee Summary", dataKey: "network" },
    ],
  },
  {
    id: "payment-velocity",
    name: "Payment Velocity",
    description: "Review throughput and cadence of payments over time.",
    resource: "payments",
    category: "payments",
    tags: ["payment", "velocity", "throughput"],
    aiHint: "Track payment cadence and volume spikes.",
    components: [
      { id: "velocity-metric", type: "metric", label: "Payment Count", dataKey: "activity.length" },
      { id: "velocity-chart", type: "chart", label: "Payment Trend", dataKey: "activity" },
      { id: "velocity-table", type: "table", label: "Payment Snapshot", dataKey: "activity" },
    ],
  },
  {
    id: "liquidity-watch",
    name: "Liquidity Watch",
    description: "Measure available liquidity and reserve pressure for key accounts.",
    resource: "accounts",
    category: "liquidity",
    tags: ["liquidity", "reserve", "balance"],
    aiHint: "Highlight reserve pressure and balance sufficiency.",
    components: [
      { id: "liquidity-metric", type: "metric", label: "Available Balance", dataKey: "account.xlmBalance" },
      { id: "liquidity-chart", type: "chart", label: "Balance Trend", dataKey: "activity" },
      { id: "liquidity-table", type: "table", label: "Liquidity Signals", dataKey: "account" },
    ],
  },
  {
    id: "ledger-freshness",
    name: "Ledger Freshness",
    description: "Inspect the last ledger close and proximity to current activity.",
    resource: "ledgers",
    category: "network",
    tags: ["ledger", "freshness", "timing"],
    aiHint: "Compare close-time cadence with activity volume.",
    components: [
      { id: "ledger-metric", type: "metric", label: "Latest Ledger", dataKey: "network.latestLedgerSequence" },
      { id: "ledger-chart", type: "chart", label: "Close Timeline", dataKey: "activity" },
      { id: "ledger-table", type: "table", label: "Ledger Snapshot", dataKey: "network" },
    ],
  },
  {
    id: "compliance-review",
    name: "Compliance Review",
    description: "Surface policy-sensitive activity for audit and review workflows.",
    resource: "transactions",
    category: "compliance",
    tags: ["compliance", "audit", "review"],
    aiHint: "Summarize reviewable activity that may need policy attention.",
    components: [
      { id: "compliance-metric", type: "metric", label: "Review Items", dataKey: "risks.length" },
      { id: "compliance-chart", type: "chart", label: "Review Trend", dataKey: "activity" },
      { id: "compliance-table", type: "table", label: "Compliance Signals", dataKey: "risks" },
    ],
  },
  {
    id: "recovery-readiness",
    name: "Recovery Readiness",
    description: "Assess how prepared an account is for recovery or incident response.",
    resource: "accounts",
    category: "operations",
    tags: ["recovery", "incident", "prepare"],
    aiHint: "Highlight account resiliency and operational readiness.",
    components: [
      { id: "recovery-metric", type: "metric", label: "Risk Signals", dataKey: "risks.length" },
      { id: "recovery-chart", type: "chart", label: "Operational Trend", dataKey: "activity" },
      { id: "recovery-table", type: "table", label: "Recovery Notes", dataKey: "risks" },
    ],
  },
  {
    id: "validator-health",
    name: "Validator Health",
    description: "Monitor validator-related network stability indicators.",
    resource: "ledgers",
    category: "network",
    tags: ["validator", "stability", "network"],
    aiHint: "Review network health cues around validator and ledger performance.",
    components: [
      { id: "validator-metric", type: "metric", label: "Latest Ledger", dataKey: "network.latestLedgerSequence" },
      { id: "validator-chart", type: "chart", label: "Health Trend", dataKey: "activity" },
      { id: "validator-table", type: "table", label: "Validator Snapshot", dataKey: "network" },
    ],
  },
  {
    id: "market-activity",
    name: "Market Activity",
    description: "Capture trading and flow shifts that indicate momentum.",
    resource: "transactions",
    category: "market",
    tags: ["market", "momentum", "flow"],
    aiHint: "Summarize trend shifts in transaction flow and trading behavior.",
    components: [
      { id: "market-metric", type: "metric", label: "Transactions", dataKey: "activity.length" },
      { id: "market-chart", type: "chart", label: "Flow Trend", dataKey: "activity" },
      { id: "market-table", type: "table", label: "Market Notes", dataKey: "activity" },
    ],
  },
  {
    id: "trustline-risk",
    name: "Trustline Risk",
    description: "Focus on trustline concentration and exposure hotspots.",
    resource: "accounts",
    category: "risk",
    tags: ["trustline", "exposure", "risk"],
    aiHint: "Surface concentration risk and trustline coverage gaps.",
    components: [
      { id: "trustline-metric", type: "metric", label: "Trustlines", dataKey: "account.trustlineCount" },
      { id: "trustline-chart", type: "chart", label: "Exposure Trend", dataKey: "activity" },
      { id: "trustline-table", type: "table", label: "Trustline Risks", dataKey: "account" },
    ],
  },
  {
    id: "reserve-management",
    name: "Reserve Management",
    description: "Monitor reserve usage and balance sustainability.",
    resource: "accounts",
    category: "operations",
    tags: ["reserve", "balance", "sustainability"],
    aiHint: "Flag reserve strain and sustainability concerns.",
    components: [
      { id: "reserve-metric", type: "metric", label: "Balance", dataKey: "account.xlmBalance" },
      { id: "reserve-chart", type: "chart", label: "Reserve Trend", dataKey: "activity" },
      { id: "reserve-table", type: "table", label: "Reserve Snapshot", dataKey: "account" },
    ],
  },
  {
    id: "ops-drift",
    name: "Operations Drift",
    description: "Identify changes in operations mix over consecutive windows.",
    resource: "operations",
    category: "operations",
    tags: ["operations", "drift", "change"],
    aiHint: "Spot drift in the operations mix over time.",
    components: [
      { id: "ops-metric", type: "metric", label: "Operations", dataKey: "activity.length" },
      { id: "ops-chart", type: "chart", label: "Drift Trend", dataKey: "activity" },
      { id: "ops-table", type: "table", label: "Operations Mix", dataKey: "activity" },
    ],
  },
  {
    id: "asset-flow",
    name: "Asset Flow",
    description: "Trace asset movement and transfer patterns across accounts.",
    resource: "payments",
    category: "payments",
    tags: ["asset", "flow", "transfer"],
    aiHint: "Trace transfer flow and highlight movement hotspots.",
    components: [
      { id: "asset-flow-metric", type: "metric", label: "Payments", dataKey: "activity.length" },
      { id: "asset-flow-chart", type: "chart", label: "Flow Trend", dataKey: "activity" },
      { id: "asset-flow-table", type: "table", label: "Asset Flow", dataKey: "activity" },
    ],
  },
  {
    id: "activity-forecast",
    name: "Activity Forecast",
    description: "Generate a forecast-style snapshot for recurring activity patterns.",
    resource: "transactions",
    category: "forecast",
    tags: ["forecast", "trend", "activity"],
    aiHint: "Generate a forward-looking review of recurring activity patterns.",
    components: [
      { id: "forecast-metric", type: "metric", label: "Trend Score", dataKey: "activity.length" },
      { id: "forecast-chart", type: "chart", label: "Forecast Trend", dataKey: "activity" },
      { id: "forecast-table", type: "table", label: "Forecast Notes", dataKey: "activity" },
    ],
  },
  {
    id: "route-coverage",
    name: "Route Coverage",
    description: "Review how routing and payment coverage hold up across the network.",
    resource: "payments",
    category: "network",
    tags: ["routing", "payments", "coverage"],
    aiHint: "Review the breadth of payment routing coverage.",
    components: [
      { id: "route-metric", type: "metric", label: "Payments", dataKey: "activity.length" },
      { id: "route-chart", type: "chart", label: "Coverage Trend", dataKey: "activity" },
      { id: "route-table", type: "table", label: "Routing Snapshot", dataKey: "activity" },
    ],
  },
];

export const REPORT_TEMPLATES: ReportTemplate[] = REPORT_TEMPLATE_DEFINITIONS;

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

const SAVED_REPORT_TEMPLATE_STORAGE_KEY = "stellar-dev-dashboard-saved-report-templates";
let savedReportTemplateMemory: ReportTemplate[] = [];

function readSavedReportTemplatesFromStorage(): ReportTemplate[] {
  if (typeof globalThis === "undefined") return savedReportTemplateMemory;
  const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
  if (!storage) return savedReportTemplateMemory;

  try {
    const rawValue = storage.getItem(SAVED_REPORT_TEMPLATE_STORAGE_KEY);
    if (!rawValue) return savedReportTemplateMemory;
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return savedReportTemplateMemory;
    savedReportTemplateMemory = parsed as ReportTemplate[];
    return savedReportTemplateMemory;
  } catch {
    return savedReportTemplateMemory;
  }
}

export function getAllReportTemplates() {
  return [...REPORT_TEMPLATES, ...readSavedReportTemplatesFromStorage()];
}

export function getReportTemplate(templateId: string) {
  return getAllReportTemplates().find((template) => template.id === templateId) || REPORT_TEMPLATES[0];
}

export function parseNaturalLanguageRequest(request: string): ParsedReportRequest {
  const normalizedRequest = request.trim();
  const lower = normalizedRequest.toLowerCase();

  const templateIds: Array<{ id: string; keywords: string[] }> = [
    { id: "account-activity", keywords: ["account", "balance", "signer", "risk", "trustline", "review"] },
    { id: "portfolio-performance", keywords: ["portfolio", "asset", "allocation", "holdings", "balance"] },
    { id: "transaction-analysis", keywords: ["transaction", "payment", "operation", "volume", "flow"] },
    { id: "network-health", keywords: ["network", "fee", "ledger", "validator", "health", "stability"] },
  ];

  const templateId = templateIds.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)))?.id || "account-activity";
  const accountIdMatch = normalizedRequest.match(/\b(G[A-Z2-7]{3,})\b/i);
  const frequency = ["daily", "weekly", "monthly", "quarterly"].find((candidate) => lower.includes(candidate));
  const focusAreas = [
    { area: "risks", keywords: ["risk", "signer", "security", "compliance"] },
    { area: "fees", keywords: ["fee", "cost", "expense"] },
    { area: "assets", keywords: ["asset", "portfolio", "holdings", "allocation"] },
    { area: "volume", keywords: ["volume", "throughput", "flow", "velocity"] },
    { area: "health", keywords: ["health", "stability", "ledger", "network"] },
  ]
    .filter(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)))
    .map(({ area }) => area);

  const resource: ReportResource = lower.includes("ledger") || lower.includes("network") || lower.includes("validator")
    ? "ledgers"
    : lower.includes("payment") || lower.includes("transfer")
      ? "payments"
      : lower.includes("operation")
        ? "operations"
        : "accounts";

  return {
    templateId,
    accountId: accountIdMatch?.[1],
    focusAreas: focusAreas.length > 0 ? focusAreas : ["summary"],
    frequency,
    resource,
    prompt: normalizedRequest,
  };
}

export function saveReportTemplate(template: ReportTemplate) {
  const stored = readSavedReportTemplatesFromStorage();
  const nextTemplates = [...stored.filter((item) => item.id !== template.id), template];
  savedReportTemplateMemory = nextTemplates;

  if (typeof globalThis !== "undefined") {
    const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
    if (storage) {
      storage.setItem(SAVED_REPORT_TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
    }
  }

  return template;
}

export function loadSavedReportTemplates() {
  return readSavedReportTemplatesFromStorage();
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

function buildNarrativeInsights(
  template: ReportTemplate,
  metrics: Array<{ label: string; value: string | number }>,
  rows: Array<Record<string, any>>,
  focusAreas: string[],
  dataSet: ReportDataSet,
) {
  const insights: string[] = [];

  if (metrics.length > 0) {
    const firstMetric = metrics[0];
    insights.push(`${firstMetric.label} is ${firstMetric.value} in the current snapshot.`);
  }

  if (focusAreas.includes("risks") && rows.length > 0) {
    const activeSignals = rows.filter((row) => row.active === true || row.risk === true || row.label?.toLowerCase().includes("risk"));
    if (activeSignals.length > 0) {
      insights.push(`Risk signals are visible across ${activeSignals.length} entry${activeSignals.length === 1 ? "" : "ies"}.`);
    }
  }

  if (focusAreas.includes("fees") && dataSet.network?.baseFee) {
    insights.push(`The current base fee is ${dataSet.network.baseFee} stroops.`);
  }

  if (template.aiHint) {
    insights.push(template.aiHint);
  }

  return insights.slice(0, 3);
}

export function transformReportData(
  templateId: string,
  dataSet: ReportDataSet,
  options?: { focusAreas?: string[]; request?: string },
): TransformedReportData {
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
  const focusAreas = options?.focusAreas || [];

  return {
    templateId: template.id,
    generatedAt: new Date().toISOString(),
    metrics,
    chartData,
    rows,
    columns,
    insights: buildNarrativeInsights(template, metrics, rows, focusAreas, dataSet),
    summary: options?.request ? `AI-generated ${template.name} summary based on: ${options.request}` : `${template.name} summary`,
    focusAreas,
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
  const insightHtml = (data.insights || []).map((insight) => `<li>${insight}</li>`).join("");
  const tableHead = data.columns.map((column) => `<th>${column}</th>`).join("");
  const tableBody = data.rows
    .slice(0, 25)
    .map((row) => `<tr>${data.columns.map((column) => `<td>${row[column] ?? ""}</td>`).join("")}</tr>`)
    .join("");

  return {
    filename: `${sanitizeFilePart(template.name)}.pdf.html`,
    contentType: "text/html",
    html: `<!doctype html><html><head><meta charset="utf-8"><title>${template.name}</title></head><body><h1>${template.name}</h1><p>${template.description}</p><h2>Metrics</h2><ul>${metricHtml}</ul><h2>Insights</h2><ul>${insightHtml}</ul><h2>Data</h2><table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table></body></html>`,
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
