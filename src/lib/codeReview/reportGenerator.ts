/**
 * codeReview/reportGenerator.ts
 *
 * Generates code review reports in JSON, Markdown, and HTML formats.
 * The reports include all detected issues, checklist results, best
 * practice recommendations, and actionable summaries.
 */

import type { CodeReviewResult, CodeReviewIssue, ReviewChecklistItem } from './types';

// ─── JSON ────────────────────────────────────────────────────────────────────

export function toJSON(result: CodeReviewResult): string {
  return JSON.stringify(result, null, 2);
}

// ─── Markdown ────────────────────────────────────────────────────────────────

export function toMarkdown(result: CodeReviewResult): string {
  const lines: string[] = [];

  lines.push(`# 🔍 AI-Powered Code Review Report`);
  lines.push('');
  lines.push(`**Generated:** ${result.analyzedAt}`);
  lines.push(`**Files analyzed:** ${result.analyzedFiles.length}`);
  lines.push(`**Code Health Score:** ${result.codeHealthScore}/100`);
  lines.push(`**Pass Rate:** ${result.passRate}%`);
  lines.push(`**Review Gate:** ${result.passesGate ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');

  // Summary
  lines.push(`## 📋 Summary`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  // Top Recommendations
  if (result.topRecommendations.length > 0) {
    lines.push(`## 🎯 Top Recommendations`);
    lines.push('');
    for (const rec of result.topRecommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Breakdown
  lines.push(`## 📊 Issue Breakdown`);
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|---|---|');
  for (const [sev, count] of Object.entries(result.severityBreakdown)) {
    if (count > 0) {
      lines.push(`| ${sev} | ${count} |`);
    }
  }
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|---|---|');
  for (const [cat, count] of Object.entries(result.categoryBreakdown)) {
    if (count > 0) {
      lines.push(`| ${cat} | ${count} |`);
    }
  }
  lines.push('');

  // Issues by severity
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'] as const;
  for (const severity of severityOrder) {
    const issues = result.issues.filter((i) => i.severity === severity);
    if (issues.length === 0) continue;

    lines.push(`## ${severityIcon(severity)} ${capitalize(severity)} Issues (${issues.length})`);
    lines.push('');

    for (const issue of issues) {
      lines.push(`### ${issue.title}`);
      lines.push('');
      lines.push(`- **File:** \`${issue.file}\` (line ${issue.startLine})`);
      lines.push(`- **Category:** ${issue.category}`);
      lines.push(`- **Confidence:** ${Math.round(issue.confidence * 100)}%`);
      lines.push(`- **Effort:** ${issue.effortMinutes} min`);
      lines.push('');
      lines.push(`${issue.description}`);
      lines.push('');
      if (issue.snippet) {
        lines.push('```');
        lines.push(issue.snippet);
        lines.push('```');
        lines.push('');
      }
      lines.push(`**💡 Suggestion:** ${issue.suggestion}`);
      lines.push('');
      lines.push(`**📖 Rationale:** ${issue.rationale}`);
      lines.push('');
      if (issue.references?.length) {
        lines.push(`**🔗 References:** ${issue.references.join(', ')}`);
        lines.push('');
      }
      if (issue.stellarTags?.length) {
        lines.push(`**🏷️ Tags:** ${issue.stellarTags.join(', ')}`);
        lines.push('');
      }
    }
  }

  // Checklist
  lines.push(`## ✅ Review Checklist`);
  lines.push('');
  lines.push('| Status | Category | Check | Details |');
  lines.push('|---|---|---|---|');
  for (const item of result.checklist) {
    const statusIcon = item.autoStatus === 'pass' ? '✅' :
      item.autoStatus === 'fail' ? '❌' :
      item.autoStatus === 'warning' ? '⚠️' : '❓';
    lines.push(`| ${statusIcon} | ${item.category} | ${item.prompt} | ${item.evidence || item.details} |`);
  }
  lines.push('');

  // Best Practices
  if (result.bestPractices.length > 0) {
    lines.push(`## 📚 Stellar Best Practices`);
    lines.push('');
    for (const bp of result.bestPractices) {
      const priorityIcon = bp.priority === 'essential' ? '🔴' :
        bp.priority === 'recommended' ? '🟡' : '🟢';
      lines.push(`### ${priorityIcon} ${bp.title}`);
      lines.push('');
      lines.push(`${bp.description}`);
      lines.push('');
      if (bp.goodExample) {
        lines.push('**✅ Good:**');
        lines.push('```');
        lines.push(bp.goodExample);
        lines.push('```');
        lines.push('');
      }
      if (bp.badExample) {
        lines.push('**❌ Bad:**');
        lines.push('```');
        lines.push(bp.badExample);
        lines.push('```');
        lines.push('');
      }
      if (bp.docReference) {
        lines.push(`📖 [Documentation](${bp.docReference})`);
        lines.push('');
      }
    }
  }

  // Files analyzed
  lines.push(`## 📁 Files Analyzed`);
  lines.push('');
  for (const file of result.analyzedFiles) {
    lines.push(`- \`${file}\``);
  }
  lines.push('');
  lines.push(`---
*Report generated by AI-Powered Code Review Assistant*`);

  return lines.join('\n');
}

// ─── HTML ────────────────────────────────────────────────────────────────────

export function toHTML(result: CodeReviewResult): string {
  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const issuesHtml = result.issues
    .map(
      (issue) => `
    <div class="issue severity-${issue.severity}">
      <div class="issue-header">
        <span class="severity-badge badge-${issue.severity}">${issue.severity.toUpperCase()}</span>
        <span class="issue-category">${issue.category}</span>
        <span class="issue-confidence">${Math.round(issue.confidence * 100)}% confidence</span>
      </div>
      <h4>${esc(issue.title)}</h4>
      <p class="issue-meta">${esc(issue.file)}:${issue.startLine} · ${issue.effortMinutes} min effort</p>
      <p>${esc(issue.description)}</p>
      ${issue.snippet ? `<pre>${esc(issue.snippet)}</pre>` : ''}
      <div class="suggestion">
        <strong>💡 Suggestion:</strong> ${esc(issue.suggestion)}
      </div>
      <div class="rationale">
        <strong>📖 Rationale:</strong> ${esc(issue.rationale)}
      </div>
    </div>`
    )
    .join('\n');

  const checklistHtml = result.checklist
    .map(
      (item) => `
    <tr>
      <td>${item.autoStatus === 'pass' ? '✅' : item.autoStatus === 'fail' ? '❌' : item.autoStatus === 'warning' ? '⚠️' : '❓'}</td>
      <td>${item.category}</td>
      <td>${esc(item.prompt)}</td>
      <td>${esc(item.evidence || item.details)}</td>
    </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report — ${result.analyzedAt}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0b0d12; color: #e7eaef; padding: 32px; line-height: 1.6;
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 8px; color: #06b6d4; }
    h2 { font-size: 20px; margin: 28px 0 12px; border-bottom: 1px solid #2b313c; padding-bottom: 8px; }
    h3 { font-size: 16px; margin: 20px 0 8px; }
    .meta { color: #9ca3af; font-size: 14px; margin-bottom: 24px; }
    .score { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 700; font-size: 14px; }
    .score-good { background: #065f46; color: #6ee7b7; }
    .score-medium { background: #78350f; color: #fcd34d; }
    .score-bad { background: #7f1d1d; color: #fca5a5; }
    .gate-passed { color: #6ee7b7; font-weight: 700; }
    .gate-failed { color: #fca5a5; font-weight: 700; }
    .summary { background: #1a1d24; border: 1px solid #2b313c; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .breakdown { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
    .stat-card { background: #1a1d24; border: 1px solid #2b313c; border-radius: 8px; padding: 14px; }
    .stat-card .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .issue { background: #1a1d24; border: 1px solid #2b313c; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .issue-header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    .severity-badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-critical { background: #7f1d1d; color: #fca5a5; }
    .badge-high { background: #78350f; color: #fcd34d; }
    .badge-medium { background: #1e3a5f; color: #93c5fd; }
    .badge-low { background: #1f2937; color: #9ca3af; }
    .badge-info { background: #1f2937; color: #6ee7b7; }
    .issue-category { font-size: 11px; color: #9ca3af; }
    .issue-confidence { margin-left: auto; font-size: 11px; color: #6b7280; }
    .issue-meta { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    pre { background: #0f1320; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 8px 0; }
    .suggestion, .rationale { margin-top: 8px; font-size: 13px; padding: 8px; border-radius: 6px; }
    .suggestion { background: rgba(6,182,212,0.1); border-left: 3px solid #06b6d4; }
    .rationale { background: rgba(139,92,246,0.1); border-left: 3px solid #8b5cf6; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #2b313c; }
    th { color: #9ca3af; font-weight: 600; }
    .footer { margin-top: 40px; color: #6b7280; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 AI-Powered Code Review Report</h1>
    <p class="meta">
      Generated: ${result.analyzedAt} · ${result.analyzedFiles.length} file${result.analyzedFiles.length > 1 ? 's' : ''} analyzed
    </p>

    <div style="display:flex; gap: 12px; align-items: center; margin-bottom: 16px;">
      <span class="score ${result.codeHealthScore >= 70 ? 'score-good' : result.codeHealthScore >= 45 ? 'score-medium' : 'score-bad'}">
        Score: ${result.codeHealthScore}/100
      </span>
      <span class="${result.passesGate ? 'gate-passed' : 'gate-failed'}">
        ${result.passesGate ? '✅ Review Gate: PASSED' : '❌ Review Gate: FAILED'}
      </span>
    </div>

    <div class="summary">
      <strong>Summary:</strong> ${result.summary}
    </div>

    ${result.topRecommendations.length ? `
    <h2>🎯 Top Recommendations</h2>
    <ul>
      ${result.topRecommendations.map((r) => `<li>${r}</li>`).join('')}
    </ul>
    ` : ''}

    <h2>📊 Issue Breakdown</h2>
    <div class="breakdown">
      ${Object.entries(result.severityBreakdown).filter(([,c]) => c > 0).map(([sev, count]) => `
      <div class="stat-card">
        <div class="label">${sev}</div>
        <div class="value" style="color: ${sevColor(sev)}">${count}</div>
      </div>`).join('')}
    </div>

    <h2>📋 All Issues</h2>
    ${issuesHtml}

    <h2>✅ Review Checklist</h2>
    <table>
      <thead><tr><th>Status</th><th>Category</th><th>Check</th><th>Evidence</th></tr></thead>
      <tbody>${checklistHtml}</tbody>
    </table>

    <h2>📚 Stellar Best Practices</h2>
    ${result.bestPractices.length ? result.bestPractices.map(bp => `
    <div class="issue">
      <h4>${bp.priority === 'essential' ? '🔴' : bp.priority === 'recommended' ? '🟡' : '🟢'} ${bp.title}</h4>
      <p>${bp.description}</p>
      ${bp.docReference ? `<p>📖 <a href="${bp.docReference}" style="color: #06b6d4;">Documentation</a></p>` : ''}
    </div>`).join('') : '<p>No best practice violations detected.</p>'}

    <h2>📁 Files Analyzed</h2>
    <ul>
      ${result.analyzedFiles.map(f => `<li><code>${f}</code></li>`).join('')}
    </ul>

    <div class="footer">
      Report generated by AI-Powered Code Review Assistant
    </div>
  </div>
</body>
</html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '🔶';
    case 'low': return '💡';
    case 'info': return 'ℹ️';
    default: return '•';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sevColor(sev: string): string {
  switch (sev) {
    case 'critical': return '#fca5a5';
    case 'high': return '#fcd34d';
    case 'medium': return '#93c5fd';
    case 'low': return '#9ca3af';
    case 'info': return '#6ee7b7';
    default: return '#e7eaef';
  }
}
