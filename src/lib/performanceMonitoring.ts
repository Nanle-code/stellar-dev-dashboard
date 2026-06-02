/**
 * Performance Monitoring System
 * Tracks Core Web Vitals, bundle size, and performance budgets
 */

/**
 * Performance metrics storage
 */
const metrics = {
  webVitals: [],
  customMetrics: [],
  resourceTimings: [],
  navigationTiming: null,
};

/**
 * Performance budgets (in milliseconds or bytes)
 */
export const PERFORMANCE_BUDGETS = {
  // Core Web Vitals
  LCP: 2500, // Largest Contentful Paint (good: < 2.5s)
  FID: 100, // First Input Delay (good: < 100ms)
  CLS: 0.1, // Cumulative Layout Shift (good: < 0.1)
  FCP: 1800, // First Contentful Paint (good: < 1.8s)
  TTFB: 800, // Time to First Byte (good: < 800ms)

  // Resource budgets
  JS_BUNDLE_SIZE: 500 * 1024, // 500 KB
  CSS_BUNDLE_SIZE: 100 * 1024, // 100 KB
  IMAGE_SIZE: 200 * 1024, // 200 KB per image
  TOTAL_PAGE_SIZE: 2 * 1024 * 1024, // 2 MB

  // Custom metrics
  API_RESPONSE_TIME: 1000, // 1 second
  RENDER_TIME: 100, // 100ms
};

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === "undefined") return;

  // Monitor Core Web Vitals
  observeWebVitals();

  // Monitor resource loading
  observeResourceTimings();

  // Monitor navigation timing
  captureNavigationTiming();

  // Monitor long tasks
  observeLongTasks();

  // Report on page visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportMetrics();
    }
  });

  // Report before unload
  window.addEventListener("beforeunload", () => {
    reportMetrics();
  });
}

/**
 * Observe Core Web Vitals using PerformanceObserver
 */
function observeWebVitals() {
  if (!("PerformanceObserver" in window)) return;

  // Largest Contentful Paint (LCP)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      recordMetric("LCP", lastEntry.renderTime || lastEntry.loadTime, {
        element: lastEntry.element?.tagName,
        url: lastEntry.url,
      });
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {
    console.warn("LCP observation not supported");
  }

  // First Input Delay (FID)
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        recordMetric("FID", entry.processingStart - entry.startTime, {
          eventType: entry.name,
        });
      });
    });
    fidObserver.observe({ type: "first-input", buffered: true });
  } catch (e) {
    console.warn("FID observation not supported");
  }

  // Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          recordMetric("CLS", clsValue);
        }
      });
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    console.warn("CLS observation not supported");
  }

  // First Contentful Paint (FCP)
  try {
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name === "first-contentful-paint") {
          recordMetric("FCP", entry.startTime);
        }
      });
    });
    fcpObserver.observe({ type: "paint", buffered: true });
  } catch (e) {
    console.warn("FCP observation not supported");
  }

  // Time to First Byte (TTFB)
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const ttfb = timing.responseStart - timing.requestStart;
    if (ttfb > 0) {
      recordMetric("TTFB", ttfb);
    }
  }
}

/**
 * Observe resource loading performance
 */
function observeResourceTimings() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const resourceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === "resource") {
          metrics.resourceTimings.push({
            name: entry.name,
            type: entry.initiatorType,
            duration: entry.duration,
            size: entry.transferSize || 0,
            startTime: entry.startTime,
            timestamp: Date.now(),
          });
        }
      });
    });
    resourceObserver.observe({ type: "resource", buffered: true });
  } catch (e) {
    console.warn("Resource timing observation not supported");
  }
}

/**
 * Capture navigation timing
 */
function captureNavigationTiming() {
  if (!window.performance || !window.performance.timing) return;

  const timing = window.performance.timing;

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

/**
 * Observe long tasks (> 50ms)
 */
function observeLongTasks() {
  if (!("PerformanceObserver" in window)) return;

  try {
    const longTaskObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        recordMetric("LongTask", entry.duration, {
          startTime: entry.startTime,
          attribution: entry.attribution?.[0]?.name,
        });
      });
    });
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch (e) {
    console.warn("Long task observation not supported");
  }
}

/**
 * Record a performance metric
 */
function recordMetric(name, value, metadata = {}) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    ...metadata,
  };

  metrics.webVitals.push(metric);

  // Check against budget
  const budget = PERFORMANCE_BUDGETS[name];
  if (budget && value > budget) {
    console.warn(
      `⚠️ Performance budget exceeded: ${name} = ${value.toFixed(2)} (budget: ${budget})`,
    );
  }

  // Trigger custom event for real-time monitoring
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("performance-metric", {
        detail: metric,
      }),
    );
  }
}

/**
 * Record custom metric
 */
export function recordCustomMetric(name, value, metadata = {}) {
  const metric = {
    name,
    value,
    timestamp: Date.now(),
    ...metadata,
  };

  metrics.customMetrics.push(metric);

  // Check against budget if exists
  const budget = PERFORMANCE_BUDGETS[name];
  if (budget && value > budget) {
    console.warn(
      `⚠️ Performance budget exceeded: ${name} = ${value.toFixed(2)} (budget: ${budget})`,
    );
  }
}

/**
 * Measure function execution time
 */
export function measurePerformance(name, fn) {
  const start = performance.now();

  try {
    const result = fn();

    // Handle async functions
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        recordCustomMetric(name, duration);
      });
    }

    const duration = performance.now() - start;
    recordCustomMetric(name, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordCustomMetric(name, duration, { error: error.message });
    throw error;
  }
}

/**
 * Measure async function execution time
 */
export async function measureAsync(name, asyncFn) {
  const start = performance.now();

  try {
    const result = await asyncFn();
    const duration = performance.now() - start;
    recordCustomMetric(name, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    recordCustomMetric(name, duration, { error: error.message });
    throw error;
  }
}

/**
 * Mark a performance point
 */
export function mark(name) {
  if (window.performance && window.performance.mark) {
    window.performance.mark(name);
  }
}

/**
 * Measure between two marks
 */
export function measure(name, startMark, endMark) {
  if (window.performance && window.performance.measure) {
    try {
      window.performance.measure(name, startMark, endMark);
      const measure = window.performance.getEntriesByName(name, "measure")[0];
      if (measure) {
        recordCustomMetric(name, measure.duration);
      }
    } catch (e) {
      console.warn("Performance measure failed:", e);
    }
  }
}

/**
 * Get all metrics
 */
export function getAllMetrics() {
  return {
    webVitals: [...metrics.webVitals],
    customMetrics: [...metrics.customMetrics],
    resourceTimings: [...metrics.resourceTimings],
    navigationTiming: metrics.navigationTiming,
  };
}

/**
 * Get metrics summary
 */
export function getMetricsSummary() {
  const summary = {
    webVitals: {},
    customMetrics: {},
    resources: {
      total: metrics.resourceTimings.length,
      totalSize: 0,
      byType: {},
    },
    budgetViolations: [],
  };

  // Summarize web vitals (get latest value for each)
  metrics.webVitals.forEach((metric) => {
    summary.webVitals[metric.name] = {
      value: metric.value,
      budget: PERFORMANCE_BUDGETS[metric.name],
      withinBudget:
        !PERFORMANCE_BUDGETS[metric.name] ||
        metric.value <= PERFORMANCE_BUDGETS[metric.name],
    };

    if (
      PERFORMANCE_BUDGETS[metric.name] &&
      metric.value > PERFORMANCE_BUDGETS[metric.name]
    ) {
      summary.budgetViolations.push({
        metric: metric.name,
        value: metric.value,
        budget: PERFORMANCE_BUDGETS[metric.name],
        overage: metric.value - PERFORMANCE_BUDGETS[metric.name],
      });
    }
  });

  // Summarize custom metrics (average)
  const customMetricGroups = {};
  metrics.customMetrics.forEach((metric) => {
    if (!customMetricGroups[metric.name]) {
      customMetricGroups[metric.name] = [];
    }
    customMetricGroups[metric.name].push(metric.value);
  });

  Object.entries(customMetricGroups).forEach(([name, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    summary.customMetrics[name] = {
      average: avg,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
      budget: PERFORMANCE_BUDGETS[name],
      withinBudget:
        !PERFORMANCE_BUDGETS[name] || avg <= PERFORMANCE_BUDGETS[name],
    };
  });

  // Summarize resources
  metrics.resourceTimings.forEach((resource) => {
    summary.resources.totalSize += resource.size;

    if (!summary.resources.byType[resource.type]) {
      summary.resources.byType[resource.type] = {
        count: 0,
        totalSize: 0,
        totalDuration: 0,
      };
    }

    summary.resources.byType[resource.type].count++;
    summary.resources.byType[resource.type].totalSize += resource.size;
    summary.resources.byType[resource.type].totalDuration += resource.duration;
  });

  // Check total page size budget
  if (summary.resources.totalSize > PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE) {
    summary.budgetViolations.push({
      metric: "TOTAL_PAGE_SIZE",
      value: summary.resources.totalSize,
      budget: PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE,
      overage:
        summary.resources.totalSize - PERFORMANCE_BUDGETS.TOTAL_PAGE_SIZE,
    });
  }

  return summary;
}

/**
 * Report metrics (to console or analytics service)
 */
function reportMetrics() {
  const summary = getMetricsSummary();

  console.group("📊 Performance Report");
  console.log("Web Vitals:", summary.webVitals);
  console.log("Custom Metrics:", summary.customMetrics);
  console.log("Resources:", summary.resources);

  if (summary.budgetViolations.length > 0) {
    console.warn("Budget Violations:", summary.budgetViolations);
  } else {
    console.log("✅ All performance budgets met");
  }

  console.groupEnd();

  // In production, send to analytics service
  // sendToAnalytics(summary);
}

/**
 * Clear all metrics
 */
export function clearMetrics() {
  metrics.webVitals = [];
  metrics.customMetrics = [];
  metrics.resourceTimings = [];
  metrics.navigationTiming = null;
}

/**
 * Get performance score (0-100)
 */
export function getPerformanceScore() {
  const summary = getMetricsSummary();
  let score = 100;

  // Deduct points for budget violations
  summary.budgetViolations.forEach((violation) => {
    const overagePercent = (violation.overage / violation.budget) * 100;
    score -= Math.min(overagePercent / 2, 20); // Max 20 points per violation
  });

  return Math.max(0, Math.round(score));
}

/**
 * Monitor component render performance
 */
export function usePerformanceMonitor(componentName) {
  if (typeof window === "undefined") return;

  const mountTime = performance.now();

  // Record mount time
  recordCustomMetric(`${componentName}_mount`, 0);

  return {
    recordRender: () => {
      const renderTime = performance.now() - mountTime;
      recordCustomMetric(`${componentName}_render`, renderTime);
    },
    recordAction: (actionName, duration) => {
      recordCustomMetric(`${componentName}_${actionName}`, duration);
    },
  };
}

/**
 * Get bundle size analysis (requires build-time data)
 */
export function getBundleAnalysis() {
  const resources = metrics.resourceTimings;

  const jsResources = resources.filter((r) => r.type === "script");
  const cssResources = resources.filter(
    (r) => r.type === "link" && r.name.includes(".css"),
  );
  const imageResources = resources.filter((r) => r.type === "img");

  const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0);
  const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0);
  const totalImageSize = imageResources.reduce((sum, r) => sum + r.size, 0);

  return {
    javascript: {
      count: jsResources.length,
      totalSize: totalJsSize,
      budget: PERFORMANCE_BUDGETS.JS_BUNDLE_SIZE,
      withinBudget: totalJsSize <= PERFORMANCE_BUDGETS.JS_BUNDLE_SIZE,
      files: jsResources.map((r) => ({
        name: r.name.split("/").pop(),
        size: r.size,
        duration: r.duration,
      })),
    },
    css: {
      count: cssResources.length,
      totalSize: totalCssSize,
      budget: PERFORMANCE_BUDGETS.CSS_BUNDLE_SIZE,
      withinBudget: totalCssSize <= PERFORMANCE_BUDGETS.CSS_BUNDLE_SIZE,
      files: cssResources.map((r) => ({
        name: r.name.split("/").pop(),
        size: r.size,
        duration: r.duration,
      })),
    },
    images: {
      count: imageResources.length,
      totalSize: totalImageSize,
      largestImage: Math.max(...imageResources.map((r) => r.size), 0),
      files: imageResources
        .map((r) => ({
          name: r.name.split("/").pop(),
          size: r.size,
          duration: r.duration,
        }))
        .sort((a, b) => b.size - a.size)
        .slice(0, 10), // Top 10 largest
    },
  };
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format milliseconds to human readable
 */
export function formatMs(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default {
  initPerformanceMonitoring,
  recordCustomMetric,
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
