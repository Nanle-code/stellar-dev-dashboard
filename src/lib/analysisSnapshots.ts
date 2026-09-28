export const ANALYSIS_SNAPSHOT_VERSION = 1 as const;

export interface AnalysisSnapshot {
  version: typeof ANALYSIS_SNAPSHOT_VERSION;
  id: string;
  createdAt: string;
  title: string;
  query: {
    metric: string;
    filters: Record<string, string | number | boolean>;
    capturedAt: string;
  };
  chart: {
    type: string;
    series: string[];
    config: Record<string, string | number | boolean>;
  };
}

type SnapshotInput = Omit<AnalysisSnapshot, "version" | "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

const MAX_SNAPSHOT_BYTES = 50_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSnapshot(value: unknown): asserts value is AnalysisSnapshot {
  if (!isRecord(value) || value.version !== ANALYSIS_SNAPSHOT_VERSION || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.createdAt !== "string") {
    throw new Error("Unsupported analysis snapshot format");
  }
  if (!isRecord(value.query) || typeof value.query.metric !== "string" || !isRecord(value.query.filters) || typeof value.query.capturedAt !== "string") {
    throw new Error("Analysis snapshot query is invalid");
  }
  if (!isRecord(value.chart) || typeof value.chart.type !== "string" || !Array.isArray(value.chart.series) || !value.chart.series.every((item) => typeof item === "string") || !isRecord(value.chart.config)) {
    throw new Error("Analysis snapshot chart configuration is invalid");
  }
  if (Number.isNaN(Date.parse(value.createdAt)) || Number.isNaN(Date.parse(value.query.capturedAt))) {
    throw new Error("Analysis snapshot timestamp is invalid");
  }
}

export function createAnalysisSnapshot(input: SnapshotInput): AnalysisSnapshot {
  if (!input.title.trim() || !input.query.metric.trim() || !input.chart.type.trim()) {
    throw new Error("Analysis snapshot title, metric, and chart type are required");
  }
  const snapshot: AnalysisSnapshot = {
    version: ANALYSIS_SNAPSHOT_VERSION,
    id: input.id ?? `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
    title: input.title.trim(),
    query: input.query,
    chart: input.chart,
  };
  assertSnapshot(snapshot);
  if (serializeAnalysisSnapshot(snapshot).length > MAX_SNAPSHOT_BYTES) {
    throw new Error("Analysis snapshot is too large");
  }
  return snapshot;
}

export function serializeAnalysisSnapshot(snapshot: AnalysisSnapshot): string {
  assertSnapshot(snapshot);
  return JSON.stringify(snapshot);
}

export function parseAnalysisSnapshot(serialized: string): AnalysisSnapshot {
  if (typeof serialized !== "string" || serialized.length > MAX_SNAPSHOT_BYTES) {
    throw new Error("Analysis snapshot is too large");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Analysis snapshot is not valid JSON");
  }
  assertSnapshot(parsed);
  return parsed;
}
