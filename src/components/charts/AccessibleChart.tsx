// src/components/charts/AccessibleChart.tsx
//
// Wraps a Recharts visualization with a screen-reader summary and a
// keyboard-toggleable data table, so the same information the chart conveys
// visually is also available to assistive technology and non-pointer users.
// See CHART_ACCESSIBILITY_GUIDE.md for the adoption pattern.
import React, { useId, useState } from "react";
import {
  buildChartTable,
  describeChart,
  isRenderableChartData,
  type ChartSeriesConfig,
} from "../../utils/chartAccessibility";

export interface AccessibleChartProps {
  /** Title announced to screen readers and shown above the chart */
  title: string;
  /** The dataset driving the chart (same array passed to Recharts) */
  data: unknown;
  /** Series rendered in the chart, used to build the summary + table */
  series: ChartSeriesConfig[];
  /** Column driving the X axis / row label, e.g. "date" or "timestamp" */
  categoryKey: string;
  /** Label for the category column in the accessible table */
  categoryLabel?: string;
  /** The actual Recharts tree (ResponsiveContainer + chart) */
  children: React.ReactNode;
  /** Message shown when data is missing/empty/invalid, instead of the chart */
  emptyMessage?: string;
  height?: number | string;
}

/**
 * Recharts renders to SVG with no semantic fallback, so screen readers and
 * environments without canvas/SVG support (older browsers, some test runners)
 * get nothing. This wrapper always renders a text summary and an accessible
 * table alongside — or instead of — the visual chart.
 */
export default function AccessibleChart({
  title,
  data,
  series,
  categoryKey,
  categoryLabel = "Label",
  children,
  emptyMessage = "No data is currently available for this chart.",
  height = 250,
}: AccessibleChartProps) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const hasData = isRenderableChartData(data);

  const summary = hasData ? describeChart({ title, data, series }) : `${title}: ${emptyMessage}`;
  const table = hasData
    ? buildChartTable(data, [{ key: categoryKey, label: categoryLabel }, ...series])
    : { headers: [], rows: [] };

  return (
    <div>
      <p id={summaryId} className="sr-only">
        {summary}
      </p>

      {hasData ? (
        <div role="img" aria-label={title} aria-describedby={summaryId} style={{ height }}>
          {children}
        </div>
      ) : (
        <div
          role="status"
          style={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          {emptyMessage}
        </div>
      )}

      {hasData && (
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          style={{
            marginTop: "8px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-secondary)",
            fontSize: "11px",
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          {showTable ? "Hide data table" : "Show data table"}
        </button>
      )}

      {hasData && showTable && (
        <table style={{ width: "100%", marginTop: "8px", borderCollapse: "collapse", fontSize: "12px" }}>
          <caption className="sr-only">{title} — tabular data</caption>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h} scope="col" style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  j === 0
                    ? <th key={j} scope="row" style={{ textAlign: "left", padding: "4px 8px", fontWeight: 500 }}>{cell}</th>
                    : <td key={j} style={{ padding: "4px 8px" }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
