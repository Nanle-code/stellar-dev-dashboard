import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearMetrics,
  getAllMetrics,
  getMetricsSummary,
  recordCustomMetric,
} from "../../src/lib/performanceMonitoring";

describe("performanceMonitoring", () => {
  beforeEach(() => {
    clearMetrics();
  });

  it("redacts sensitive metadata from custom metrics", () => {
    recordCustomMetric("TRANSACTION_SIGNING_DURATION", 42, {
      secretKey: "SBHVYYV2MF2WY46WKRDT4QFZWQMHIXYFJ3PLF5PSTVX6DUMMYSEED",
      txXdr: "A".repeat(240),
      network: "testnet",
    });

    const metric = getAllMetrics().customMetrics[0];

    expect(metric.secretKey).toBe("[redacted]");
    expect(metric.txXdr).toBe("[redacted]");
    expect(metric.network).toBe("testnet");
  });

  it("records budget violations for regressions", () => {
    const listener = vi.fn();
    window.addEventListener("performance-regression", listener);

    recordCustomMetric("API_RESPONSE_TIME", 1500, {
      endpoint: "/accounts",
      status: 200,
    });

    const summary = getMetricsSummary();

    expect(summary.budgetViolations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "API_RESPONSE_TIME",
          value: 1500,
          budget: 1000,
        }),
      ]),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener("performance-regression", listener);
  });
});
