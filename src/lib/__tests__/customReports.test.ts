import { describe, expect, it, vi } from "vitest";
import {
  buildDeliveryPlan,
  buildHorizonQuery,
  createPdfReportPayload,
  createReportCache,
  createReportSchedule,
  exportReportAsCsv,
  exportReportAsJson,
  getNextRunPreview,
  REPORT_TEMPLATES,
  transformReportData,
} from "../customReports";

const analytics = {
  account: {
    xlmBalance: 128.5,
    trustlineCount: 3,
    totalAssets: 4,
  },
  transactions: {
    successRate: 0.875,
    opTypeCounts: {
      payment: 5,
      manage_sell_offer: 2,
    },
  },
  network: {
    latestLedgerSequence: 123456,
    baseFee: 100,
  },
  activity: [
    { date: "2026-06-23", transactions: 4, fees: 400 },
    { date: "2026-06-24", transactions: 2, fees: 200 },
  ],
  risks: [{ id: "master-single-point", label: "Single signer", active: true }],
};

describe("custom reports", () => {
  it("ships the required Stellar report templates", () => {
    expect(REPORT_TEMPLATES.map((template) => template.id)).toEqual([
      "account-activity",
      "portfolio-performance",
      "transaction-analysis",
      "network-health",
    ]);
    expect(REPORT_TEMPLATES.every((template) => template.components.length >= 3)).toBe(true);
  });

  it("builds account-scoped Horizon queries with filters", () => {
    const query = buildHorizonQuery({
      resource: "transactions",
      network: "public",
      accountId: "GABC",
      limit: 500,
      filters: { include_failed: true },
    });

    expect(query.endpoint).toBe("/accounts/GABC/transactions");
    expect(query.params.limit).toBe("200");
    expect(query.url).toContain("https://horizon.stellar.org/accounts/GABC/transactions");
    expect(query.url).toContain("include_failed=true");
  });

  it("transforms analytics snapshots into report metrics, charts, and rows", () => {
    const data = transformReportData("transaction-analysis", analytics);

    expect(data.metrics).toContainEqual({ label: "Success Rate", value: "87.5%" });
    expect(data.chartData).toHaveLength(2);
    expect(data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "payment", value: 5 }),
        expect.objectContaining({ id: "manage_sell_offer", value: 2 }),
      ]),
    );
  });

  it("caches report data until the ttl expires", () => {
    vi.useFakeTimers();
    const cache = createReportCache(1000);

    cache.set("activity", { rows: 1 });
    expect(cache.get("activity")).toEqual({ rows: 1 });

    vi.advanceTimersByTime(1001);
    expect(cache.get("activity")).toBeUndefined();
    vi.useRealTimers();
  });

  it("exports JSON, CSV, and PDF-ready report payloads", () => {
    const template = REPORT_TEMPLATES[0];
    const data = transformReportData(template.id, analytics);

    expect(JSON.parse(exportReportAsJson(template, data)).template.id).toBe(template.id);
    expect(exportReportAsCsv(data)).toContain("section,label,value");
    const pdf = createPdfReportPayload(template, data);
    expect(pdf.filename).toBe("account-activity.pdf.html");
    expect(pdf.html).toContain("<h1>Account Activity</h1>");
    expect(pdf.chartData).toEqual(data.chartData);
  });

  it("validates schedules and builds email and webhook deliveries", () => {
    const schedule = createReportSchedule({
      id: "weekly-activity",
      reportId: "account-activity",
      cron: "0 9 * * 1",
      timezone: "UTC",
      enabled: true,
      channels: ["email", "webhook"],
      recipients: ["ops@example.com"],
      webhookUrl: "https://example.com/reports",
    });
    const data = transformReportData("account-activity", analytics);
    const plan = buildDeliveryPlan(schedule, REPORT_TEMPLATES[0], data);

    expect(schedule.nextRunAt).toEqual(getNextRunPreview("0 9 * * 1"));
    expect(plan).toHaveLength(2);
    expect(plan[0].attachments.map((attachment) => attachment.contentType)).toEqual([
      "application/json",
      "text/csv",
      "text/html",
    ]);
  });
});
