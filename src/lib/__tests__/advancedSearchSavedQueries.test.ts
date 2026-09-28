import { describe, expect, it, vi } from "vitest";
import { AdvancedSearchService } from "../advancedSearch.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

function createService() {
  const service = new AdvancedSearchService({ storage: createStorage(), cacheTtlMs: 1000 });
  service.indexData("transactions", [
    {
      id: "tx-1",
      hash: "hash-payment",
      type: "payment",
      created_at: "2026-06-24T10:00:00Z",
      amount: "25",
      asset_type: "native",
      source_account: "GABC",
      successful: true,
      memo: "rent payment",
      network: "testnet",
    },
    {
      id: "tx-2",
      hash: "hash-failed",
      type: "set_options",
      created_at: "2026-06-24T11:00:00Z",
      amount: "5",
      asset_code: "USDC",
      source_account: "GDEF",
      successful: false,
      memo: "failed threshold update",
      network: "mainnet",
    },
  ]);
  return service;
}

describe("advanced search saved queries", () => {
  it("saves searches into folders and tracks usage", () => {
    const service = createService();
    const saved = service.saveSearch(
      "Payments over 10 XLM",
      { text: "payment", types: ["transactions"], filters: { amountRange: { min: 10 } } },
      { folder: "Payments", tags: ["finance"] },
    );

    expect(service.getSavedSearchFolders()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Payments", count: 1 })]),
    );
    expect(service.getSavedSearches({ folder: "Payments" })).toHaveLength(1);
    expect(service.loadSavedSearch(saved.id).usageCount).toBe(1);
  });

  it("shares and imports saved searches", () => {
    const service = createService();
    const saved = service.saveSearch("Failed updates", { text: "failed", types: ["transactions"] }, { folder: "Ops" });
    const token = service.shareSearch(saved.id, { users: ["ops@example.com"] });
    const imported = service.importSharedSearch(token, { folder: "Shared" });

    expect(token).toEqual(expect.any(String));
    expect(service.getSavedSearches({ folder: "Shared" })).toContainEqual(expect.objectContaining({ id: imported.id }));
    expect(service.getSavedSearches({ folder: "Ops" })[0].sharedWith).toContain("ops@example.com");
  });

  it("caches repeated searches and records analytics", () => {
    const service = createService();
    const first = service.search({ text: "payment", types: ["transactions"], page: 1, limit: 20 });
    const second = service.search({ text: "payment", types: ["transactions"], page: 1, limit: 20 });
    const analytics = service.getSearchAnalytics();

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.total).toBe(1);
    expect(second.queryPlan.usesIndex).toBe(true);
    expect(analytics.totalSearches).toBe(2);
    expect(analytics.cachedSearches).toBe(1);
    expect(analytics.cacheEntries).toBe(1);
  });

  it("expires cached search results", () => {
    vi.useFakeTimers();
    const service = createService();

    service.search({ text: "payment", types: ["transactions"] });
    vi.advanceTimersByTime(1001);
    const result = service.search({ text: "payment", types: ["transactions"] });

    expect(result.cached).toBe(false);
    vi.useRealTimers();
  });

  it("creates and evaluates scheduled search alerts", () => {
    const service = createService();
    const saved = service.saveSearch("Payment alert", { text: "payment", types: ["transactions"] }, { folder: "Alerts" });
    const alert = service.createSearchAlert({
      savedSearchId: saved.id,
      name: "Payment alert",
      cron: "0 * * * *",
      threshold: 1,
    });
    service.searchAlerts[0].nextRunAt = "2026-06-24T00:00:00.000Z";

    const evaluations = service.evaluateSearchAlerts(new Date("2026-06-24T01:00:00.000Z"));

    expect(alert.enabled).toBe(true);
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].triggered).toBe(true);
    expect(service.getSearchAlerts()[0].lastRunAt).toBe("2026-06-24T01:00:00.000Z");
  });
});
