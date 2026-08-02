/**
 * refactoring/reportGenerator.ts
 *
 * Renders RefactorReport into three practical formats:
 *  • JSON — for downstream tooling (CI annotations, pipelines)
 *  • Markdown — for PR descriptions and code review
 *  • HTML — for sharing with stakeholders (no React needed)
 */

import type { PrioritizedSuggestion, RefactorReport } from './types.js';

export function toJSON(report: RefactorReport): string {
  return JSON.stringify(report, null, 2);
}

export function toMarkdown(report: RefactorReport): string {
  const lines: string[] = [];
  lines.push(`# 🔧 AI Refactoring Report`);
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push('');
  lines.push(`## 📊 Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Files analysed | ${report.totalFilesAnalysed} |`);
  lines.push(`| Functions analysed | ${report.totalFunctionsAnalysed} |`);
  lines.push(`| Suggestions surfaced | ${report.totalSuggestions} |`);
  lines.push(`| Estimated acceptance | ${report.averageAcceptanceProbability}% |`);
  lines.push(`| Code quality score | ${report.codeQualityScore}/100 |`);
  lines.push(`| Lines saved (est.) | ${report.impact.totalLinesSaved} |`);
  lines.push(`| Complexity reduction | ${report.impact.totalComplexityReduction} |`);
  lines.push(`| Maintainability gain | ${report.impact.totalMaintainabilityGain} |`);
  lines.push('');

  if (report.hotspots.length) {
    lines.push(`## 🔥 Hotspot Files`);
    lines.push('');
    lines.push('| File | Anomaly | Factor |');
    lines.push('|---|---|---|');
    for (const h of report.hotspots.slice(0, 5)) {
      lines.push(`| \`${h.file}\` | ${h.anomalyScore} | ${h.contributingFactors.slice(0, 1).join(', ')} |`);
    }
    lines.push('');
  }

  lines.push(`## 🧰 Issue Breakdown`);
  lines.push('');
  lines.push('| Kind | Count |');
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(report.issueBreakdown)) {
    if (v === 0) continue;
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push(`## ✅ Prioritized Suggestions`);
  lines.push('');
  const grouped = bucketize(report.suggestions);
  for (const [bucket, list] of Object.entries(grouped)) {
    lines.push(`### ${bucketLabel(bucket)}`);
    lines.push('');
    for (const s of list.slice(0, 20)) {
      lines.push(
        `- **#${s.rank} · ${s.title}** — \`${s.file}:${s.startLine}\` · priority ${s.priority} · safety ${s.safety} · effort ${s.effortMinutes}m`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function toHTML(report: RefactorReport): string {
  const json = JSON.stringify(report, null, 2)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8"/>',
    `<title>Refactor Report — ${report.generatedAt}</title>`,
    '<style>',
    'body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d12;color:#e7eaef;padding:32px;}',
    'h1{margin:0 0 8px}h2{margin-top:28px;border-bottom:1px solid #2b313c;padding-bottom:6px}',
    'table{border-collapse:collapse;margin:8px 0 24px}td,th{padding:6px 12px;border:1px solid #2b313c;}',
    '.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#1f2937;color:#a7f3d0;font-size:12px;margin-left:6px}',
    'pre{background:#0f1320;padding:16px;border-radius:8px;overflow:auto}',
    '.safe{color:#34d399}.warn{color:#facc15}.crit{color:#f87171}',
    '</style></head><body>',
    `<h1>🔧 AI Refactoring Report <span class="pill">${report.codeQualityScore}/100</span></h1>`,
    `<p><strong>Generated:</strong> ${report.generatedAt} · <strong>Files:</strong> ${report.totalFilesAnalysed} · <strong>Functions:</strong> ${report.totalFunctionsAnalysed}</p>`,
    '<h2>Summary</h2>',
    `<p>${report.totalSuggestions} suggestions · est. acceptance ${report.averageAcceptanceProbability}% · lines saved ${report.impact.totalLinesSaved} · complexity ↓ ${report.impact.totalComplexityReduction} · maintainability ↑ ${report.impact.totalMaintainabilityGain}</p>`,
    '<h2>Hotspots</h2>',
    report.hotspots.length
      ? '<ul>' +
        report.hotspots
          .slice(0, 5)
          .map((h) => `<li><code>${h.file}</code> — anomaly ${h.anomalyScore} — ${h.contributingFactors.join(', ')}</li>`)
          .join('') +
        '</ul>'
      : '<p>No outlier files detected.</p>',
    '<h2>Suggestions</h2>',
    '<ol>',
    report.suggestions
      .slice(0, 30)
      .map(
        (s) =>
          `<li class="${severityClass(s.severity)}"><strong>${escapeHtml(s.title)}</strong> <code>${s.file}:${s.startLine}</code><br/><small>priority ${s.priority} · safety ${s.safety} · effort ${s.effortMinutes}m</small><br/>${escapeHtml(s.description)}</li>`
      )
      .join(''),
    '</ol>',
    '<h2>Raw JSON</h2>',
    `<pre>${json}</pre>`,
    '</body></html>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bucketize(
  list: PrioritizedSuggestion[]
): Record<PrioritizedSuggestion['bucket'], PrioritizedSuggestion[]> {
  return {
    'safe-now': list.filter((s) => s.bucket === 'safe-now'),
    'review-needed': list.filter((s) => s.bucket === 'review-needed'),
    'high-effort': list.filter((s) => s.bucket === 'high-effort'),
  };
}

function bucketLabel(b: string): string {
  switch (b) {
    case 'safe-now':
      return '⚡ Safe-Now (apply with confidence)';
    case 'review-needed':
      return '🔎 Review-Needed (likely beneficial)';
    default:
      return '⏳ High-Effort / Strategic';
  }
}

function severityClass(s: string): string {
  return s === 'critical' ? 'crit' : s === 'warning' ? 'warn' : '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
