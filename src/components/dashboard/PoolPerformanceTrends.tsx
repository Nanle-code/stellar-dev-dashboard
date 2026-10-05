import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  computePoolTradeStats,
  buildVolumeTrend,
  estimatePoolFeeApr,
  explainInvalidPool,
  type PoolTradeInput,
  type PoolFeeAprEstimate,
  type VolumeTrend,
} from "../../lib/poolMetrics";

const WARNING_TONES: Record<string, string> = {
  "low-sample": "var(--amber)",
  "stale-trades": "var(--amber)",
  "skipped-records": "var(--text-muted)",
  "extrapolated-volume": "var(--amber)",
};

class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function trendDirection(trend: VolumeTrend): "rising" | "falling" | "steady" | null {
  const { buckets } = trend;
  if (buckets.length < 2) return null;
  const half = Math.floor(buckets.length / 2);
  const earlier = buckets.slice(0, half).reduce((sum, b) => sum + b.volume, 0);
  const later = buckets.slice(half).reduce((sum, b) => sum + b.volume, 0);
  if (earlier <= 0) return later > 0 ? "rising" : null;
  const change = (later - earlier) / earlier;
  if (change > 0.2) return "rising";
  if (change < -0.2) return "falling";
  return "steady";
}

/**
 * Fee APR and volume trends for the selected liquidity pool (#862).
 *
 * Failure paths:
 * - Missing or invalid pool data renders an explanatory `role="alert"`.
 * - Pools with no recent trades show why the APR is unavailable instead of 0%.
 * - Chart render errors fall back to a plain bucket list.
 */
export default function PoolPerformanceTrends({
  pool,
  trades,
  loading,
}: {
  pool: { id: string; assetCodeA: string; assetCodeB: string; feeBps: number; reserveA: string; reserveB: string } | null;
  trades: PoolTradeInput[];
  loading: boolean;
}) {
  const { estimate, trend, poolError } = useMemo(() => {
    if (!pool) return { estimate: null, trend: null, poolError: null as string | null };
    const poolError = explainInvalidPool(pool);
    if (poolError) return { estimate: null, trend: null, poolError };

    const stats = computePoolTradeStats(trades);
    const estimate: PoolFeeAprEstimate = estimatePoolFeeApr(pool, stats);
    const trend: VolumeTrend = buildVolumeTrend(trades, { buckets: 6 });
    return { estimate, trend, poolError: null };
  }, [pool, trades]);

  if (!pool) return null;

  const pair = `${pool.assetCodeA}/${pool.assetCodeB}`;
  const direction = trend ? trendDirection(trend) : null;
  const chartData = trend
    ? trend.buckets.map((bucket) => ({
        label: bucket.label,
        volume: Number(bucket.volume.toFixed(6)),
        trades: bucket.tradeCount,
      }))
    : [];

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-display)", fontSize: "13px" }}>
          {direction === "rising" && <TrendingUp size={14} color="var(--green)" aria-hidden />}
          {direction === "falling" && <TrendingDown size={14} color="var(--red)" aria-hidden />}
          {(!direction || direction === "steady") && <Minus size={14} color="var(--text-muted)" aria-hidden />}
          Fee APR &amp; Volume Trends
        </div>
        <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
          {loading ? "Loading trades…" : pair}
        </div>
      </div>

      {poolError && (
        <div role="alert" style={{ fontSize: "12px", color: "var(--amber)" }}>
          {poolError}
        </div>
      )}

      {!poolError && estimate && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>Fee APR (est.)</div>
              <div
                style={{
                  color: estimate.feeApr === null ? "var(--text-muted)" : "var(--green)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  marginTop: "4px",
                }}
                aria-label={estimate.feeApr === null ? "Fee APR unavailable" : `Estimated fee APR ${estimate.feeApr.toFixed(2)} percent`}
              >
                {estimate.feeApr === null ? "—" : `${estimate.feeApr.toFixed(2)}%`}
              </div>
              {estimate.extrapolated && estimate.feeApr !== null && (
                <div style={{ color: "var(--amber)", fontSize: "10px", marginTop: "2px" }}>extrapolated from &lt;24h</div>
              )}
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>Est. Daily Fees</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", marginTop: "4px" }}>
                {estimate.dailyFees === null ? "—" : formatNumber(estimate.dailyFees, 4)}
              </div>
            </div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>Est. Daily Volume</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", marginTop: "4px" }}>
                {estimate.volumePerDay === null ? "—" : formatNumber(estimate.volumePerDay, 2)}
              </div>
            </div>
          </div>

          {estimate.feeApr === null && estimate.reason && (
            <div role="status" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {estimate.reason}
            </div>
          )}

          {chartData.length > 0 && (
            <ChartErrorBoundary
              fallback={
                <ul
                  data-testid="volume-trend-fallback"
                  style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}
                >
                  {trend?.buckets.map((bucket) => (
                    <li key={bucket.label}>
                      {bucket.label}: {formatNumber(bucket.volume, 4)} ({bucket.tradeCount} trade{bucket.tradeCount === 1 ? "" : "s"})
                    </li>
                  ))}
                </ul>
              }
            >
              <div style={{ height: "120px" }} data-testid="volume-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-muted)" }} stroke="var(--border)" />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} stroke="var(--border)" width={44} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "11px",
                      }}
                      formatter={(value: number | string) => [formatNumber(Number(value), 4), "Volume"]}
                    />
                    <Bar dataKey="volume" fill="var(--cyan)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          )}

          {estimate.warnings.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
              {estimate.warnings.map((warning, index) => (
                <li
                  key={`${warning.code}-${index}`}
                  style={{
                    borderLeft: `3px solid ${WARNING_TONES[warning.code] ?? "var(--text-muted)"}`,
                    paddingLeft: "8px",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {warning.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
