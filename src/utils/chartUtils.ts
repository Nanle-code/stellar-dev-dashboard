/**
 * Advanced chart utilities (#109)
 *
 * Complements src/lib/chartUtils.js (which holds the basic formatters and
 * theme constants). This module adds:
 *
 *  - PNG / SVG export of any DOM-rendered chart
 *  - JSON / CSV / PNG download helpers with safe filenames
 *  - Largest-Triangle-Three-Buckets (LTTB) downsampling for big series
 *  - Percentile / quantile helpers
 *  - Sparkline SVG path generator
 *  - Throttle / debounce for live-update streams
 *  - Color-scale generator for categorical series
 */

// ─── Filenames ───────────────────────────────────────────────────────────────

/**
 * Build a safe, timestamped filename.
 * @example safeFilename('balances', 'csv') -> "balances-2025-01-30T11-22-09.csv"
 */
export function safeFilename(prefix, ext) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePrefix = String(prefix || 'chart').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return `${safePrefix}-${stamp}.${ext}`;
}

// ─── Generic file download ───────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Download arbitrary string content as a text file.
 */
export function downloadText(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  return triggerDownload(blob, filename);
}

/**
 * Download an array as JSON.
 */
export function downloadJson(rows, prefix = 'chart') {
  const json = JSON.stringify(rows, null, 2);
  return downloadText(json, safeFilename(prefix, 'json'), 'application/json');
}

// ─── SVG / PNG export ────────────────────────────────────────────────────────

/**
 * Locate the first <svg> rendered inside a container (Recharts mounts an SVG
 * inside a wrapping div). Returns null if not found.
 */
function findSvg(container) {
  if (!container) return null;
  return container.querySelector('svg');
}

/**
 * Serialize an in-page <svg> to a standalone XML string.
 * Inlines the computed font-family so the export looks identical.
 */
export function svgToString(svgEl) {
  if (!svgEl) return '';
  const cloned = svgEl.cloneNode(true);
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Inline minimal styles so colours don't disappear when CSS variables
  // aren't resolvable in the standalone file.
  if (typeof window !== 'undefined') {
    const computed = window.getComputedStyle(svgEl);
    cloned.setAttribute('style', `font-family: ${computed.fontFamily};`);
  }

  return new XMLSerializer().serializeToString(cloned);
}

/**
 * Export an in-page SVG as a downloaded .svg file.
 */
export function exportSvg(container, prefix = 'chart') {
  const svg = findSvg(container);
  if (!svg) return false;
  const xml = svgToString(svg);
  return downloadText(`<?xml version="1.0" standalone="no"?>\n${xml}`, safeFilename(prefix, 'svg'), 'image/svg+xml');
}

/**
 * Export an in-page SVG to a PNG via canvas.
 * Returns a Promise resolving to true on success.
 *
 * @param {HTMLElement} container - element containing the <svg>
 * @param {string} prefix - filename prefix
 * @param {{ scale?: number, background?: string }} [opts]
 */
export async function exportPng(container, prefix = 'chart', opts = {}) {
  if (typeof document === 'undefined') return false;
  const svg = findSvg(container);
  if (!svg) return false;

  const { scale = 2, background = '#0f1820' } = opts;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const xml = svgToString(svg);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to rasterise SVG'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    return triggerDownload(blob, safeFilename(prefix, 'png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Downsampling (LTTB) ─────────────────────────────────────────────────────

/**
 * Largest-Triangle-Three-Buckets downsampling.
 * Reduces a series to `threshold` points while preserving visual peaks.
 *
 * @param {Array<{x:number, y:number}>} data
 * @param {number} threshold
 */
export function downsampleLTTB(data, threshold) {
  if (!Array.isArray(data) || threshold >= data.length || threshold <= 2) {
    return data;
  }

  const sampled = [];
  const bucketSize = (data.length - 2) / (threshold - 2);

  let a = 0;
  sampled.push(data[a]);

  for (let i = 0; i < threshold - 2; i++) {
    const start = Math.floor((i + 1) * bucketSize) + 1;
    const end = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

    let avgX = 0;
    let avgY = 0;
    const range = end - start;
    for (let j = start; j < end; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= range || 1;
    avgY /= range || 1;

    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    let maxArea = -1;
    let nextA = rangeStart;
    const pointAX = data[a].x;
    const pointAY = data[a].y;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].y - pointAY) -
        (pointAX - data[j].x) * (avgY - pointAY),
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled.push(data[nextA]);
    a = nextA;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

/**
 * Calculate a percentile from numeric values.
 * @param {number[]} values
 * @param {number} p  0..100
 */
export function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Convenience: quartiles + extents. */
export function fiveNumberSummary(values) {
  return {
    min: percentile(values, 0),
    q1: percentile(values, 25),
    median: percentile(values, 50),
    q3: percentile(values, 75),
    max: percentile(values, 100),
  };
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

/**
 * Build an SVG `d` attribute for a sparkline path.
 * Returns an object with `d`, `width`, `height`.
 */
export function sparklinePath(values, { width = 80, height = 20, padding = 1 } = {}) {
  if (!Array.isArray(values) || values.length < 2) {
    return { d: '', width, height };
  }
  const numeric = values.map((v) => Number(v)).filter(Number.isFinite);
  if (numeric.length < 2) return { d: '', width, height };

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (numeric.length - 1);
  const points = numeric.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + (height - padding * 2) * (1 - (v - min) / range);
    return [x, y];
  });

  const d = points.reduce(
    (acc, [x, y], idx) => acc + `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `,
    '',
  ).trim();

  return { d, width, height };
}

// ─── Throttle / debounce ────────────────────────────────────────────────────

/**
 * Throttle: call at most once per `ms` interval. Trailing call is honoured.
 */
export function throttle(fn, ms = 250) {
  let lastCall = 0;
  let trailingTimer = null;
  let trailingArgs = null;

  return function throttled(...args) {
    const now = Date.now();
    const elapsed = now - lastCall;

    if (elapsed >= ms) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      trailingArgs = args;
      if (!trailingTimer) {
        trailingTimer = setTimeout(() => {
          lastCall = Date.now();
          trailingTimer = null;
          fn.apply(this, trailingArgs);
        }, ms - elapsed);
      }
    }
  };
}

/**
 * Debounce: call once after `ms` of inactivity.
 */
export function debounce(fn, ms = 250) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── Color scale ─────────────────────────────────────────────────────────────

const DEFAULT_SCALE = [
  '#00e5ff', '#ffb300', '#00e676', '#ff1744',
  '#8884d8', '#82ca9d', '#ffc658', '#a4de6c',
  '#d0ed57', '#ff7300', '#387908', '#7c43bd',
];

/**
 * Get a colour from the categorical scale by index, looping if necessary.
 */
export function colorForIndex(index, scale = DEFAULT_SCALE) {
  if (!Array.isArray(scale) || scale.length === 0) return '#000000';
  const i = ((index % scale.length) + scale.length) % scale.length;
  return scale[i];
}

/**
 * Build a deterministic colour map for a list of category names.
 */
export function buildColorMap(categories, scale = DEFAULT_SCALE) {
  const map = {};
  if (!Array.isArray(categories)) return map;
  categories.forEach((name, idx) => {
    map[name] = colorForIndex(idx, scale);
  });
  return map;
}

// ─── Re-exports of CSV builder (for one-stop import) ─────────────────────────

export { buildCsv, exportChartDataAsCsv } from '../lib/chartUtils.js';
