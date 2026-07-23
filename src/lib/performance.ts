// Lightweight client-side performance monitoring and profiling
// Tracks page load metrics, Core Web Vitals (LCP, CLS, FID) and enforces simple performance budgets.

type PerfConfig = {
  rumEndpoint?: string; // optional endpoint to send RUM events
  budget?: {
    lcpMs?: number;
    fcpMs?: number;
    cls?: number;
  };
};

const defaultConfig: PerfConfig = {
  rumEndpoint: undefined,
  budget: {
    lcpMs: 2500,
    fcpMs: 1800,
    cls: 0.1,
  },
};

function sendEvent(endpoint: string | undefined, payload: any) {
  if (!endpoint) {
    // Fallback: console.debug for local dev
    // eslint-disable-next-line no-console
    console.debug('[RUM]', payload);
    return;
  }

  try {
    navigator.sendBeacon
      ? navigator.sendBeacon(endpoint, JSON.stringify(payload))
      : void fetch(endpoint, { method: 'POST', body: JSON.stringify(payload), keepalive: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('RUM send failed', e);
  }
}

export function initPerformanceMonitoring(userConfig: PerfConfig = {}) {
  const cfg = { ...defaultConfig, ...userConfig };

  // Page load metrics (Navigation Timing / Paint)
  if ('performance' in window) {
    try {
      const navEntries = performance.getEntriesByType(
        'navigation'
      ) as PerformanceNavigationTiming[];
      const nav = navEntries && navEntries[0];

      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as
        | PerformanceEntry
        | undefined;

      const metrics = {
        loadTime: nav ? Math.round(nav.loadEventEnd - nav.startTime) : undefined,
        domInteractive: nav ? Math.round(nav.domInteractive - nav.startTime) : undefined,
        firstContentfulPaint: fcpEntry ? Math.round(fcpEntry.startTime) : undefined,
        timestamp: Date.now(),
      };

      sendEvent(cfg.rumEndpoint, { type: 'page_load', metrics });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('perf: failed to capture basic navigation metrics', e);
    }
  }

  // Core Web Vitals: LCP, CLS, FID
  try {
    // LCP via PerformanceObserver
    if (typeof PerformanceObserver !== 'undefined') {
      const po = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1] as PerformanceEntry | undefined;
        if (!last) return;

        const lcp = Math.round(last.startTime);
        const payload = { type: 'lcp', value: lcp, timestamp: Date.now() };
        sendEvent(cfg.rumEndpoint, payload);

        // Budget enforcement
        if (cfg.budget?.lcpMs && lcp > cfg.budget.lcpMs) {
          // eslint-disable-next-line no-console
          console.warn(`Performance budget: LCP ${lcp}ms exceeds ${cfg.budget.lcpMs}ms`);
          sendEvent(cfg.rumEndpoint, { type: 'budget_violation', metric: 'lcp', value: lcp });
        }
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('perf: LCP observer failed', e);
  }

  // CLS via PerformanceObserver (layout-shift)
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const poCLS = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          // @ts-ignore
          clsValue += (entry as any).value || 0;
        }
        const cls = Number(clsValue.toFixed(3));
        sendEvent(cfg.rumEndpoint, { type: 'cls', value: cls, timestamp: Date.now() });
        if (cfg.budget?.cls !== undefined && cls > cfg.budget.cls) {
          // eslint-disable-next-line no-console
          console.warn(`Performance budget: CLS ${cls} exceeds ${cfg.budget.cls}`);
          sendEvent(cfg.rumEndpoint, { type: 'budget_violation', metric: 'cls', value: cls });
        }
      });
      poCLS.observe({ type: 'layout-shift', buffered: true });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('perf: CLS observer failed', e);
  }

  // FID is event-based; attempt to approximate using first-input
  try {
    if (typeof PerformanceObserver !== 'undefined') {
      const poFID = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          // @ts-ignore
          const fid = Math.round((entry as any).processingStart - (entry as any).startTime);
          sendEvent(cfg.rumEndpoint, { type: 'fid', value: fid, timestamp: Date.now() });
          if (cfg.budget?.fcpMs && fid > cfg.budget.fcpMs) {
            // eslint-disable-next-line no-console
            console.warn(`Performance budget: FID ${fid}ms exceeds ${cfg.budget.fcpMs}ms`);
            sendEvent(cfg.rumEndpoint, { type: 'budget_violation', metric: 'fid', value: fid });
          }
        }
      });
      poFID.observe({ type: 'first-input', buffered: true });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('perf: FID observer failed', e);
  }

  // Expose a simple API for manual profiling markers
  (window as any).__perf = {
    mark: (name: string) => performance.mark && performance.mark(name),
    measure: (name: string, start?: string, end?: string) => {
      try {
        if (start && end && performance.measure) {
          performance.measure(name, start, end);
          const measures = performance.getEntriesByName(name);
          sendEvent(cfg.rumEndpoint, { type: 'measure', name, measures });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('perf: measure failed', e);
      }
    },
    traceFPS: (durationMs: number = 2000) => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames++;
          const now = performance.now();
          if (now - start < durationMs) {
            requestAnimationFrame(tick);
          } else {
            const fps = Math.round((frames * 1000) / (now - start));
            sendEvent(cfg.rumEndpoint, { type: 'fps_trace', value: fps });
            resolve(fps);
          }
        }
        requestAnimationFrame(tick);
      });
    }
  };
}

export default {
  initPerformanceMonitoring,
};
