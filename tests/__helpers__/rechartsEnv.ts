/**
 * Recharts jsdom environment helper.
 *
 * Recharts only renders a chart once its `ResponsiveContainer` wrapper reports a
 * non-zero size. In jsdom every element measures 0x0 and `ResizeObserver` does
 * not exist, so charts silently render as an empty `<div>`. Installing this
 * helper gives the container a measurable size so the generated SVG (pie
 * sectors, cartesian axes, legends) is actually produced and can be asserted on.
 *
 * Importing this module installs the stubs as a side effect; tests that need a
 * different size can call `setChartSize()` afterwards.
 */

export const DEFAULT_CHART_WIDTH = 800;
export const DEFAULT_CHART_HEIGHT = 400;

let chartWidth = DEFAULT_CHART_WIDTH;
let chartHeight = DEFAULT_CHART_HEIGHT;

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function makeRect(width: number, height: number): DOMRect {
  return {
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({ width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0 }),
  } as DOMRect;
}

export function setChartSize(width = DEFAULT_CHART_WIDTH, height = DEFAULT_CHART_HEIGHT) {
  chartWidth = width;
  chartHeight = height;
}

/** Names of the pie sectors currently painted by Recharts, in DOM order. */
export function getPieSectorNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('path.recharts-sector')).map(
    (node) => node.getAttribute('name') ?? ''
  );
}

/** Text labels painted on a Recharts cartesian axis tick. */
export function getAxisTickLabels(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('.recharts-cartesian-axis-tick-value text')
  ).map((node) => node.textContent ?? '');
}

/** Legend entry labels painted by Recharts. */
export function getLegendLabels(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.recharts-legend-item-text')).map(
    (node) => node.textContent ?? ''
  );
}

/** Number of rendered Recharts surface (`<svg>`) elements. */
export function countChartSurfaces(container: HTMLElement): number {
  return container.querySelectorAll('svg.recharts-surface').length;
}

const globalRef = globalThis as unknown as { ResizeObserver?: unknown };

if (typeof globalRef.ResizeObserver === 'undefined') {
  globalRef.ResizeObserver = StubResizeObserver;
}

if (typeof Element !== 'undefined' && typeof HTMLElement !== 'undefined') {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
    return makeRect(chartWidth, chartHeight);
  };
}

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle as unknown as NodeJS.Timeout)) as typeof cancelAnimationFrame;
}
