import { evaluateAlertRules, alertCenter } from './alerts.js'

/**
 * Privacy-preserving performance monitoring.
 * Tracks Core Web Vitals, app metrics, Stellar operation timings, regressions,
 * and optional production delivery to a configured monitoring endpoint.
 */

const metrics = {
  webVitals: [],
  customMetrics: [],
  resourceTimings: [],
  navigationTiming: null,
  regressions: [],
  interactions: [],
};

const PERFORMANCE_METRIC_EVENT = "performance-metric";
const PERFORMANCE_REGRESSION_EVENT = "performance-regression";

const MONITORING_CONFIG = {
  endpoint: import.meta.env?.VITE_PERFORMANCE_MONITORING_ENDPOINT || "",
  enabled:
    import.meta.env?.PROD === true &&
    Boolean(import.meta.env?.VITE_PERFORMANCE_MONITORING_ENDPOINT),
  sampleRate: Number(
    import.meta.env?.VITE_PERFORMANCE_MONITORING_SAMPLE_RATE ?? 1,
  ),
};

export const PERFORMANCE_BUDGETS = {
  LCP: 2500,
  FID: 100,
  CLS: 0.1,
  FCP: 1800,
  TTFB: 800,
  LongTask: 200,
  API_RESPONSE_TIME: 1000,
  TRANSACTION_SIGNING_DURATION: 3000,
  TRANSACTION_SUBMIT_DURATION: 4000,
  CONTRACT_SIMULATION_DURATION: 3000,
  CONTRACT_INVOCATION_DURATION: 6000,
  USER_INTERACTION: 1,
  RENDER_TIME: 100,
  JS_BUNDLE_SIZE: 500 * 1024,
  CSS_BUNDLE_SIZE: 100 * 1024,
  IMAGE_SIZE: 200 * 1024,
  TOTAL_PAGE_SIZE: 2 * 1024 * 1024,
};

let initialized = false;

export function initPerformanceMonitoring() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  observeWebVitals();
  observeResourceTimings();
  captureNavigationTiming();
  observeLongTasks();
  observeInteractions();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reportMetrics();
  });

  window.addEventListener("beforeunload", reportMetrics);
}

function observeWebVitals() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      recordMetric("LCP", lastEntry.renderTime || lastEntry.loadTime, {
        element: lastEntry.element?.tagName,
        url: lastEntry.url,
      });
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    console.warn("LCP observation not supported");
  }

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        recordMetric("FID", entry.processingStart - entry.startTime, {
          eventType: entry.name,
        });
      });
    });
    observer.observe({ type: "first-input", buffered: true });
  } catch {
    console.warn("FID observation not supported");
  }

  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          recordMetric("CLS", clsValue);
        }
      });
    });
    observer.observe({ type: "layout-shift", buffered: true });
  } catch {
    console.warn("CLS observation not supported");
  }

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === "first-contentful-paint") {
          recordMetric("FCP", entry.startTime);
        }
      });
    });
    observer.observe({ type: "paint", buffered: true });
  } catch {
    console.warn("FCP observation not supported");
  }

  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  if (navigation) {
    recordMetric("TTFB", navigation.responseStart);
  } else if (performance.timing) {
    const ttfb = performance.timing.responseStart - performance.timing.requestStart;
    if (ttfb > 0) recordMetric("TTFB", ttfb);
  }
}

function observeResourceTimings() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType !== "resource") return;
        metrics.resourceTimings.push({
          name: sanitizeString(entry.name),
          type: entry.initiatorType,
          duration: entry.duration,
          size: entry.transferSize || 0,
          startTime: entry.startTime,
          timestamp: Date.now(),
        });
      });
    });
    observer.observe({ type: "resource", buffered: true });
  } catch {
    console.warn("Resource timing observation not supported");
  }
}

function captureNavigationTiming() {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  if (navigation) {
    metrics.navigationTiming = {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      dom: navigation.domComplete - navigation.domInteractive,
      load: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd,
      timestamp: Date.now(),
    };
    return;
  }

  if (!performance.timing) return;
  const timing = performance.timing;
  metrics.navigationTiming = {
    dns: timing.domainLookupEnd - timing.domainLookupStart,
    tcp: timing.connectEnd - timing.connectStart,
    request: timing.responseStart - timing.requestStart,
    response: timing.responseEnd - timing.responseStart,
    dom: timing.domComplete - timing.domLoading,
    load: timing.loadEventEnd - timing.loadEventStart,
    total: timing.loadEventEnd - timing.navigationStart,
    timestamp: Date.now(),
  };
}

function observeLongTasks() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        recordMetric("LongTask", entry.duration, {
          startTime: entry.startTime,
          attribution: entry.attribution?.[0]?.name,
        });
      });
    });
    observer.observe({ type: "longtask", buffered: true });
  } catch {
    console.warn("Long task observation not supported");
  }
}

function observeInteractions() {
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target?.closest?.("button,a,[role='button']");
      if (!target) return;
      recordUserInteraction("click", {
        element: target.tagName,
        label: target.getAttribute("aria-label") || target.title || target.textContent?.trim().slice(0, 48),
      });
    },
    { capture: true, passive: true },
  );
}

function sanitizeString(value) {
  if (typeof value !== "string") return value;

  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    // Fall through to generic checks.
  }

  if (
    /^[GMS][A-Z2-7]{20,}$/.test(value) ||
    /^S[A-Z2-7]{20,}$/.test(value) ||
    value.length > 160
  ) {
    return "[redacted]";
  }

  return value;
}

function sanitizeMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return Object.entries(metadata).reduce((safe, [key, value]) => {
    const normalizedKey = String(key).toLowerCase();
    if (
      normalizedKey.includes("secret") ||
      normalizedKey.includes("xdr") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("address") ||
      normalizedKey.includes("publickey") ||
      normalizedKey.includes("signature")
    ) {
      safe[key] = "[redacted]";
      return safe;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      safe[key] = value;
      return safe;
    }

    if (typeof value === "string") {
      safe[key] = sanitizeString(value);
    }

    return safe;
  }, {});
}

function dispatchMetricEvent(metric) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PERFORMANCE_METRIC_EVENT, { detail: metric }),
  );
}

function recordBudgetViolation(metric) {
  const budget = PERFORMANCE_BUDGETS[metric.name];
  if (!budget || metric.value <= budget) return;

  const violation = {
    metric: metric.name,
    value: metric.value,
    budget,
    overage: metric.value - budget,
    timestamp: metric.timestamp,
    source: metric.source || "performance",
  };

  metrics.regressions.push(violation);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PERFORMANCE_REGRESSION_EVENT, { detail: violation }),
    );
  }

  console.warn(
    `Performance budget exceeded: ${metric.name} = ${metric.value.toFixed(2)} (budget: ${budget})`,
  );
}

function recordMetric(name, value, metadata = {}) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    source: "web-vital",
    ...sanitizeMetadata(metadata),
  };

  metrics.webVitals.push(metric);
  recordBudgetViolation(metric);
  dispatchMetricEvent(metric);
}

export function recordCustomMetric(name, value, metadata = {}) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    source: "custom",
    ...sanitizeMetadata(metadata),
  };

  metrics.customMetrics.push(metric);
  recordBudgetViolation(metric);
  dispatchMetricEvent(metric);
}

export function recordUserInteraction(action, metadata = {}) {
  const interaction = {
    action: sanitizeString(action),
    timestamp: Date.now(),
    ...sanitizeMetadata(metadata),
  };

  metrics.interactions.push(interaction);
  recordCustomMetric("USER_INTERACTION", 1, {
    action: interaction.action,
    ...metadata,
  });
}

export function measurePerformance(name, fn, metadata = {}) {
  const start = performance.now();

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => {
        recordCustomMetric(name, performance.now() - start, metadata);
      });
    }
    recordCustomMetric(name, performance.now() - start, metadata);
    return result;
  } catch (error) {
    recordCustomMetric(name, performance.now() - start, {
      ...metadata,
      error: error.message,
    });
    throw error;
  }
}

export async function measureAsync(name, asyncFn, metadata = {}) {
  const start = performance.now();

  try {
    const result = await asyncFn();
    recordCustomMetric(name, performance.now() - start, metadata);
    return result;
  } catch (error) {
    recordCustomMetric(name, performance.now() - start, {
      ...metadata,
      error: error.message,
    });
    throw error;
  }
}

export function mark(name) {
  if (performance.mark) performance.mark(name);
}

export function measure(name, startMark, endMark) {
  if (!performance.measure) return;

  try {
    performance.measure(name, startMark, endMark);
    const measured = performance.getEntriesByName(name, "measure")[0];
    if (measured) recordCustomMetric(name, measured.duration);
  } catch (error) {
    console.warn("Performance measure failed:", error);
  }
}

export function getAllMetrics() {
  return {
    webVitals: [...metrics.webVitals],
    customMetrics: [...metrics.customMetrics],
    resourceTimings: [...metrics.resourceTimings],
    navigationTiming: metrics.navigationTiming,
    regressions: [...metrics.regressions],
    interactions: [...metrics.interactions],
  };
}

export function getMetricsSummary() {
  const summary = {
    webVitals: {},
    customMetrics: {},
    resources: {
      total: metrics.resourceTimings.length,
      totalSize: 0,
      byType: {},
    },
    interactions: {
      total: metrics.interactions.length,
      recent: metrics.interactions.slice(-10),
    },
    budgetViolations: [],
  };

  metrics.webVitals.forEach((metric) => {
    addMetricSummary(summary.webVitals, metric, "value");
    collectBudgetViolation(summary, metric);
  });

  const groups = {};
  metrics.customMetrics.forEach((metric) => {
    if (!groups[metric.name]) groups[metric.name] = [];
    groups[metric.name].push(metric.value);
    collectBudgetViolation(summary, metric);
  });

  Object.entries(groups).forEach(([name, values]) => {
    const average = values.reduce((total, value) => total + value, 0) / values.length;
    summary.customMetrics[name] = {
      average,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      budget: PERFORMANCE_BUDGETS[name],
      withinBudget: !PERFORMANCE_BUDGETS[name] || average <= PERFORMANCE_BUDGETS[name],
    };
  });

  metrics.resourceTimings.forEach((resource) => {
    summary.resources.totalSize += resource.size;
    if (!summary.resources.byType[resource.type]) {
      summary.resources.byType[resource.type] = {
        count: 0,
        totalSize: 0,
        totalDuration: 0,
      };
    }
    summary.resources.byType[resource.type].count += 1;
    summary.resources.byType[resource.type].totalSize += resource.size;
    summary.resources.byType[resource.type].totalDuration += resource.duration;
  });

  if (summary.resources.totalSize > PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE) {
    summary.budgetViolations.push({
      metric: "TOTAL_PAGE_SIZE",
      value: summary.resources.totalSize,
      budget: PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE,
      overage: summary.resources.totalSize - PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE,
    });
  }

  return summary;
}

function addMetricSummary(target, metric) {
  target[metric.name] = {
    value: metric.value,
    budget: PERFORMANCE_BUDGETS[metric.name],
    withinBudget:
      !PERFORMANCE_BUDGETS[metric.name] ||
      metric.value <= PERFORMANCE_BUDGETS[metric.name],
  };
}

function collectBudgetViolation(summary, metric) {
  const budget = PERFORMANCE_BUDGETS[metric.name];
  if (!budget || metric.value <= budget) return;

  summary.budgetViolations.push({
    metric: metric.name,
    value: metric.value,
    budget,
    overage: metric.value - budget,
  });
}

function reportMetrics() {
  const summary = getMetricsSummary();

  console.group("Performance Report");
  console.log("Web Vitals:", summary.webVitals);
  console.log("Custom Metrics:", summary.customMetrics);
  console.log("Resources:", summary.resources);

  if (summary.budgetViolations.length > 0) {
    console.warn("Budget Violations:", summary.budgetViolations);
  } else {
    console.log("All performance budgets met");
  }

  console.groupEnd();
  sendToMonitoringService(summary);
}

function shouldSendToMonitoring() {
  return (
    MONITORING_CONFIG.enabled &&
    MONITORING_CONFIG.endpoint &&
    Math.random() <= Math.min(Math.max(MONITORING_CONFIG.sampleRate, 0), 1)
  );
}

function sendToMonitoringService(summary) {
  if (!shouldSendToMonitoring()) return;

  const body = JSON.stringify({
    timestamp: Date.now(),
    summary,
    navigationTiming: metrics.navigationTiming,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      MONITORING_CONFIG.endpoint,
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  fetch(MONITORING_CONFIG.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function clearMetrics() {
  metrics.webVitals = [];
  metrics.customMetrics = [];
  metrics.resourceTimings = [];
  metrics.navigationTiming = null;
  metrics.regressions = [];
  metrics.interactions = [];
}

export function getPerformanceScore() {
  const summary = getMetricsSummary();
  let score = 100;

  summary.budgetViolations.forEach((violation) => {
    const overagePercent = (violation.overage / violation.budget) * 100;
    score -= Math.min(overagePercent / 2, 20);
  });

  return Math.max(0, Math.round(score));
}

export function usePerformanceMonitor(componentName) {
  if (typeof window === "undefined") return;

  const mountTime = performance.now();
  recordCustomMetric(`${componentName}_mount`, 0);

  return {
    recordRender: () => {
      recordCustomMetric(`${componentName}_render`, performance.now() - mountTime);
    },
    recordAction: (actionName, duration) => {
      recordCustomMetric(`${componentName}_${actionName}`, duration);
    },
  };
}

export function getBundleAnalysis() {
  const jsResources = metrics.resourceTimings.filter((resource) => resource.type === "script");
  const cssResources = metrics.resourceTimings.filter(
    (resource) => resource.type === "link" && resource.name.includes(".css"),
  );
  const imageResources = metrics.resourceTimings.filter((resource) => resource.type === "img");

  const totalJsSize = jsResources.reduce((sum, resource) => sum + resource.size, 0);
  const totalCssSize = cssResources.reduce((sum, resource) => sum + resource.size, 0);
  const totalImageSize = imageResources.reduce((sum, resource) => sum + resource.size, 0);

  return {
    javascript: {
      count: jsResources.length,
      totalSize: totalJsSize,
      budget: PERFORMANCE_BUDGETS.JS_BUNDLE_SIZE,
      withinBudget: totalJsSize <= PERFORMANCE_BUDGETS.JS_BUNDLE_SIZE,
      files: jsResources.map(resourceFileSummary),
    },
    css: {
      count: cssResources.length,
      totalSize: totalCssSize,
      budget: PERFORMANCE_BUDGETS.CSS_BUNDLE_SIZE,
      withinBudget: totalCssSize <= PERFORMANCE_BUDGETS.CSS_BUNDLE_SIZE,
      files: cssResources.map(resourceFileSummary),
    },
    images: {
      count: imageResources.length,
      totalSize: totalImageSize,
      largestImage: Math.max(...imageResources.map((resource) => resource.size), 0),
      files: imageResources
        .map(resourceFileSummary)
        .sort((a, b) => b.size - a.size)
        .slice(0, 10),
    },
  };
}

function resourceFileSummary(resource) {
  return {
    name: resource.name.split("/").pop(),
    size: resource.size,
    duration: resource.duration,
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatMs(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default {
  initPerformanceMonitoring,
  recordCustomMetric,
  recordUserInteraction,
  measurePerformance,
  measureAsync,
  mark,
  measure,
  getAllMetrics,
  getMetricsSummary,
  getPerformanceScore,
  getBundleAnalysis,
  clearMetrics,
  formatBytes,
  formatMs,
  PERFORMANCE_BUDGETS,
};
