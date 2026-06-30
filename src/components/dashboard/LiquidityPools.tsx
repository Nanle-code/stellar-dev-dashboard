import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Droplets, RefreshCw, Search, TrendingUp, Settings2, Calculator, AlertTriangle } from "lucide-react";
import { useStore } from "../../lib/store";
import {
  fetchAccountLiquidityPoolHistory,
  fetchAccountLiquidityPoolPositions,
  fetchLiquidityPoolsByAssetPair,
  fetchPoolTrades,
} from "../../lib/dex";
import {
  estimateAPYFromPool,
  scorePoolRisk,
  calculateImpermanentLoss,
  buildILCurve,
} from "../../lib/defiAnalytics";
import type { LiquidityPool, LiquidityPosition } from "./types";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from "recharts";

const DEFAULT_ASSET_A = "native";
const DEFAULT_ASSET_B = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

type ActiveTab = "discover" | "performance" | "manage" | "calculator";

interface PoolTrade {
  id: string;
  base_amount?: string;
  counter_amount?: string;
  price?: { n: number; d: number };
  ledger_close_time: string;
  type?: string;
}

interface DepositForm {
  maxAmountA: string;
  maxAmountB: string;
  minPriceN: string;
  minPriceD: string;
  maxPriceN: string;
  maxPriceD: string;
}

interface WithdrawForm {
  shares: string;
  minAmountA: string;
  minAmountB: string;
}

function formatNumber(value: string | number, maximumFractionDigits = 7): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("en-US", { maximumFractionDigits });
}

function assetCode(asset: string): string {
  if (!asset || asset === "native") return "XLM";
  return asset.split(":")[0] || asset;
}

function shortId(value: string): string {
  if (!value) return "—";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function operationAmount(op: Record<string, unknown>): string {
  if (op.type === "liquidity_pool_deposit") {
    const max = [op.max_amount_a, op.max_amount_b].filter(Boolean).join(" / ");
    return max || "Deposit";
  }
  if (op.type === "liquidity_pool_withdraw") {
    const min = [op.min_amount_a, op.min_amount_b].filter(Boolean).join(" / ");
    return (min as string) || (op.shares as string) || "Withdraw";
  }
  return "—";
}

function riskColor(label: string): string {
  if (label === "Low") return "var(--green)";
  if (label === "High") return "var(--red)";
  return "var(--amber)";
}

function AssetField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</span>
      <input
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder='native or CODE:G...'
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          padding: "9px 10px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}
      />
    </label>
  );
}

function PanelHeader({ icon, title, detail, compact = false }: { icon?: ReactNode; title: string; detail?: string; compact?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        marginBottom: compact ? "8px" : "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-display)", fontSize: "13px" }}>
        {icon}
        {title}
      </div>
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>{detail}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px" }}>
      <div style={{ color: "var(--text-muted)", fontSize: "10px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: accent || "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "12px", marginTop: "4px", wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--text-muted)", fontSize: "9px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "3px" }}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: "14px 0", color: "var(--text-muted)", fontSize: "12px" }}>{text}</div>;
}

function NumberInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "0"}
        style={{
          border: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-primary)",
          padding: "8px 10px",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}
      />
    </label>
  );
}

const panelStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "14px",
  minWidth: 0,
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    alignSelf: "end",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    border: "1px solid var(--cyan-dim)",
    background: disabled ? "transparent" : "var(--cyan-glow)",
    color: disabled ? "var(--text-muted)" : "var(--cyan)",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    padding: "9px 12px",
    cursor: disabled ? "not-allowed" : "pointer",
    minWidth: "94px",
  };
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "7px 12px",
        border: `1px solid ${active ? "var(--cyan-dim)" : "var(--border)"}`,
        background: active ? "var(--cyan-glow)" : "transparent",
        color: active ? "var(--cyan)" : "var(--text-secondary)",
        borderRadius: "var(--radius-sm)",
        fontSize: "12px",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Deposit Tab ──────────────────────────────────────────────────────────────

function DepositWithdrawPanel({ pool, connectedAddress }: { pool: LiquidityPool | null; connectedAddress: string }) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [deposit, setDeposit] = useState<DepositForm>({
    maxAmountA: "",
    maxAmountB: "",
    minPriceN: "1",
    minPriceD: "100",
    maxPriceN: "100",
    maxPriceD: "1",
  });
  const [withdraw, setWithdraw] = useState<WithdrawForm>({
    shares: "",
    minAmountA: "0",
    minAmountB: "0",
  });
  const [copied, setCopied] = useState(false);

  function buildDepositXDR(): string {
    if (!pool) return "";
    return [
      `Operation: LiquidityPoolDeposit`,
      `Pool ID: ${pool.id}`,
      `Max Amount A (${pool.assetCodeA}): ${deposit.maxAmountA}`,
      `Max Amount B (${pool.assetCodeB}): ${deposit.maxAmountB}`,
      `Min Price: ${deposit.minPriceN}/${deposit.minPriceD}`,
      `Max Price: ${deposit.maxPriceN}/${deposit.maxPriceD}`,
    ].join("\n");
  }

  function buildWithdrawXDR(): string {
    if (!pool) return "";
    return [
      `Operation: LiquidityPoolWithdraw`,
      `Pool ID: ${pool.id}`,
      `Shares: ${withdraw.shares}`,
      `Min Amount A (${pool.assetCodeA}): ${withdraw.minAmountA}`,
      `Min Amount B (${pool.assetCodeB}): ${withdraw.minAmountB}`,
    ].join("\n");
  }

  function handleCopy() {
    const text = mode === "deposit" ? buildDepositXDR() : buildWithdrawXDR();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!pool) {
    return <EmptyState text="Select a pool from the Discover tab to manage deposits and withdrawals." />;
  }

  if (!connectedAddress) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--amber)", fontSize: "13px", padding: "14px 0" }}>
        <AlertTriangle size={16} />
        Connect a wallet to manage liquidity positions.
      </div>
    );
  }

  const feePct = pool.feeBps / 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Pool summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <Stat label={`${pool.assetCodeA} Reserve`} value={formatNumber(pool.reserveA)} />
        <Stat label={`${pool.assetCodeB} Reserve`} value={formatNumber(pool.reserveB)} />
        <Stat label="Fee Tier" value={`${feePct.toFixed(2)}% (${pool.feeBps} bps)`} />
      </div>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: "8px" }}>
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "7px 16px",
              border: `1px solid ${mode === m ? "var(--cyan-dim)" : "var(--border)"}`,
              background: mode === m ? "var(--cyan-glow)" : "transparent",
              color: mode === m ? "var(--cyan)" : "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "deposit" ? (
        <div style={panelStyle}>
          <PanelHeader title="Deposit Liquidity" detail={`Pool: ${shortId(pool.id)}`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <NumberInput
              label={`Max ${pool.assetCodeA} amount`}
              value={deposit.maxAmountA}
              onChange={(v) => setDeposit((d) => ({ ...d, maxAmountA: v }))}
              placeholder="e.g. 100"
            />
            <NumberInput
              label={`Max ${pool.assetCodeB} amount`}
              value={deposit.maxAmountB}
              onChange={(v) => setDeposit((d) => ({ ...d, maxAmountB: v }))}
              placeholder="e.g. 100"
            />
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>Price bounds (numerator / denominator)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
            <NumberInput label="Min Price N" value={deposit.minPriceN} onChange={(v) => setDeposit((d) => ({ ...d, minPriceN: v }))} />
            <NumberInput label="Min Price D" value={deposit.minPriceD} onChange={(v) => setDeposit((d) => ({ ...d, minPriceD: v }))} />
            <NumberInput label="Max Price N" value={deposit.maxPriceN} onChange={(v) => setDeposit((d) => ({ ...d, maxPriceN: v }))} />
            <NumberInput label="Max Price D" value={deposit.maxPriceD} onChange={(v) => setDeposit((d) => ({ ...d, maxPriceD: v }))} />
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "12px", whiteSpace: "pre-wrap" }}>
            {buildDepositXDR()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
            Copy the parameters above and use the Transaction Builder to submit your deposit.
          </div>
          <button onClick={handleCopy} style={buttonStyle(false)}>
            {copied ? "Copied!" : "Copy Params"}
          </button>
        </div>
      ) : (
        <div style={panelStyle}>
          <PanelHeader title="Withdraw Liquidity" detail={`Pool: ${shortId(pool.id)}`} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <NumberInput
              label="LP Shares to Withdraw"
              value={withdraw.shares}
              onChange={(v) => setWithdraw((w) => ({ ...w, shares: v }))}
              placeholder="e.g. 50"
            />
            <NumberInput
              label={`Min ${pool.assetCodeA} out`}
              value={withdraw.minAmountA}
              onChange={(v) => setWithdraw((w) => ({ ...w, minAmountA: v }))}
              placeholder="0"
            />
            <NumberInput
              label={`Min ${pool.assetCodeB} out`}
              value={withdraw.minAmountB}
              onChange={(v) => setWithdraw((w) => ({ ...w, minAmountB: v }))}
              placeholder="0"
            />
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "12px", whiteSpace: "pre-wrap" }}>
            {buildWithdrawXDR()}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
            Copy the parameters above and use the Transaction Builder to submit your withdrawal.
          </div>
          <button onClick={handleCopy} style={buttonStyle(false)}>
            {copied ? "Copied!" : "Copy Params"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformancePanel({ pools, selectedPool, poolTrades, tradesLoading }: {
  pools: LiquidityPool[];
  selectedPool: LiquidityPool | null;
  poolTrades: PoolTrade[];
  tradesLoading: boolean;
}) {
  const poolMetrics = useMemo(() => {
    return pools.map((pool) => {
      const apy = estimateAPYFromPool(pool as unknown as Record<string, unknown>);
      const risk = scorePoolRisk(pool as unknown as Record<string, unknown>);
      const feePct = pool.feeBps / 100;
      return { pool, apy, risk, feePct };
    });
  }, [pools]);

  const selected = useMemo(() => {
    if (!selectedPool) return null;
    return poolMetrics.find((m) => m.pool.id === selectedPool.id) || null;
  }, [selectedPool, poolMetrics]);

  if (pools.length === 0) {
    return <EmptyState text="Search for pools in the Discover tab to view performance metrics." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Selected pool metrics */}
      {selected && (
        <div style={panelStyle}>
          <PanelHeader title={`${selected.pool.assetCodeA}/${selected.pool.assetCodeB} Metrics`} detail={`Fee: ${selected.feePct.toFixed(2)}%`} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "14px" }}>
            <Stat label="Est. APY" value={`${selected.apy.toFixed(2)}%`} accent="var(--green)" />
            <Stat label="Risk Score" value={`${selected.risk.score}/100`} accent={riskColor(selected.risk.label)} />
            <Stat label="Risk Level" value={selected.risk.label} accent={riskColor(selected.risk.label)} />
            <Stat label="Fee Tier" value={`${selected.feePct.toFixed(2)}%`} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Stat label={`${selected.pool.assetCodeA} Reserve`} value={formatNumber(selected.pool.reserveA)} />
            <Stat label={`${selected.pool.assetCodeB} Reserve`} value={formatNumber(selected.pool.reserveB)} />
            <Stat label="Total Shares" value={formatNumber(selected.pool.totalShares, 4)} />
            <Stat label={`${selected.pool.assetCodeA}/${selected.pool.assetCodeB} Price`} value={formatNumber(selected.pool.priceBperA)} />
          </div>
        </div>
      )}

      {/* Pool trades */}
      <div style={panelStyle}>
        <PanelHeader title="Recent Pool Trades" detail={tradesLoading ? "Loading…" : `${poolTrades.length} trades`} />
        {poolTrades.length === 0 && <EmptyState text={tradesLoading ? "Loading trades…" : "No recent trades for this pool."} />}
        {poolTrades.slice(0, 10).map((trade) => (
          <div
            key={trade.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderTop: "1px solid var(--border)",
              padding: "8px 0",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}
          >
            <span>{trade.base_amount ? formatNumber(trade.base_amount, 4) : "—"}</span>
            <span>{trade.counter_amount ? formatNumber(trade.counter_amount, 4) : "—"}</span>
            <span>{trade.ledger_close_time ? new Date(trade.ledger_close_time).toLocaleTimeString() : "—"}</span>
          </div>
        ))}
      </div>

      {/* All pools comparison */}
      <div style={panelStyle}>
        <PanelHeader title="All Pools Comparison" detail={`${pools.length} pools`} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "8px", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>
          <span>Pair</span>
          <span>Fee</span>
          <span>Est. APY</span>
          <span>Risk</span>
          <span>Shares</span>
        </div>
        {poolMetrics.map(({ pool, apy, risk, feePct }) => (
          <div
            key={pool.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
              gap: "8px",
              borderTop: "1px solid var(--border)",
              padding: "9px 0",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ color: "var(--text-primary)" }}>{pool.assetCodeA}/{pool.assetCodeB}</span>
            <span>{feePct.toFixed(2)}%</span>
            <span style={{ color: "var(--green)" }}>{apy.toFixed(2)}%</span>
            <span style={{ color: riskColor(risk.label) }}>{risk.label}</span>
            <span>{formatNumber(pool.totalShares, 2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── IL Calculator Tab ────────────────────────────────────────────────────────

function ILCalculatorPanel({ pool }: { pool: LiquidityPool | null }) {
  const [depositA, setDepositA] = useState("1000");
  const [depositB, setDepositB] = useState("1000");
  const [currentA, setCurrentA] = useState("");
  const [currentB, setCurrentB] = useState("");

  const result = useMemo(() => {
    const dA = parseFloat(depositA) || 0;
    const dB = parseFloat(depositB) || 0;
    const cA = parseFloat(currentA) || dA;
    const cB = parseFloat(currentB) || dB;
    if (!dA || !dB || !cA || !cB) return null;
    const initialRatio = dA / dB;
    const currentRatio = cA / cB;
    const { ilPercent, poolValue } = calculateImpermanentLoss(initialRatio, currentRatio);
    const totalDeposit = dA + dB;
    const ilDollar = totalDeposit * (1 - poolValue);
    return { ilPercent, ilDollar, poolValue, holdValue: totalDeposit, poolTotal: totalDeposit * poolValue };
  }, [depositA, depositB, currentA, currentB]);

  const curve = useMemo(() => buildILCurve(40), []);

  const ilRiskColor = (pct: number) => pct < -5 ? "var(--red)" : pct < -2 ? "var(--amber)" : "var(--green)";

  const labelA = pool ? pool.assetCodeA : "Asset A";
  const labelB = pool ? pool.assetCodeB : "Asset B";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
        <div style={panelStyle}>
          <PanelHeader title="Deposit Prices (USD)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <NumberInput label={`${labelA} price`} value={depositA} onChange={setDepositA} placeholder="e.g. 1000" />
            <NumberInput label={`${labelB} price`} value={depositB} onChange={setDepositB} placeholder="e.g. 1000" />
          </div>
          <PanelHeader title="Current Prices (USD)" compact />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <NumberInput label={`${labelA} price`} value={currentA} onChange={setCurrentA} placeholder="Leave blank = same" />
            <NumberInput label={`${labelB} price`} value={currentB} onChange={setCurrentB} placeholder="Leave blank = same" />
          </div>
        </div>

        <div style={panelStyle}>
          <PanelHeader title="Result" />
          {result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>Impermanent Loss</div>
                <div style={{ fontSize: "32px", fontWeight: 700, fontFamily: "var(--font-mono)", color: ilRiskColor(result.ilPercent) }}>
                  {result.ilPercent.toLocaleString("en-US", { maximumFractionDigits: 3 })}%
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {([
                  ["Hold Value", `$${formatNumber(result.holdValue)}`],
                  ["Pool Value", `$${formatNumber(result.poolTotal)}`],
                  ["Loss (USD)", `-$${formatNumber(Math.abs(result.ilDollar))}`],
                  ["Pool Factor", formatNumber(result.poolValue, 4)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--text-primary)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Enter prices above to calculate.</div>
          )}
        </div>
      </div>

      <div style={panelStyle}>
        <PanelHeader title="IL vs Price Ratio Change" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={curve} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="priceMultiplier" tickFormatter={(v) => `${v}x`} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <YAxis tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <Tooltip
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(3)}%`, "IL"]}
              labelFormatter={(l) => `Price: ${l}x`}
            />
            <ReferenceLine x={1} stroke="var(--text-muted)" strokeDasharray="4 4" label={{ value: "Entry", fill: "var(--text-muted)", fontSize: 11 }} />
            <Line type="monotone" dataKey="ilPercent" stroke="#ef4444" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiquidityPools() {
  const { network, connectedAddress } = useStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("discover");
  const [assetA, setAssetA] = useState(DEFAULT_ASSET_A);
  const [assetB, setAssetB] = useState(DEFAULT_ASSET_B);
  const [pools, setPools] = useState<LiquidityPool[]>([]);
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [poolTrades, setPoolTrades] = useState<PoolTrade[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedPool = useMemo<LiquidityPool | null>(
    () => pools.find((pool) => pool.id === selectedPoolId) || pools[0] || null,
    [pools, selectedPoolId]
  );

  async function loadPools(nextA = assetA, nextB = assetB) {
    setLoading(true);
    setError("");
    try {
      const records: LiquidityPool[] = await fetchLiquidityPoolsByAssetPair(nextA.trim(), nextB.trim(), network, 20);
      setPools(records);
      setSelectedPoolId(records[0]?.id || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load liquidity pools.");
      setPools([]);
      setSelectedPoolId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountPools(poolId?: string | null) {
    if (!connectedAddress) {
      setPositions([]);
      setHistory([]);
      return;
    }
    setAccountLoading(true);
    try {
      const [nextPositions, nextHistory] = await Promise.all([
        fetchAccountLiquidityPoolPositions(connectedAddress, network),
        fetchAccountLiquidityPoolHistory(connectedAddress, network, 80, poolId),
      ]);
      setPositions(nextPositions);
      setHistory(nextHistory);
    } catch {
      setPositions([]);
      setHistory([]);
    } finally {
      setAccountLoading(false);
    }
  }

  async function loadPoolTrades(poolId: string) {
    setTradesLoading(true);
    try {
      const trades = await fetchPoolTrades(poolId, network, 20);
      setPoolTrades(trades as PoolTrade[]);
    } catch {
      setPoolTrades([]);
    } finally {
      setTradesLoading(false);
    }
  }

  useEffect(() => {
    const rawPair = sessionStorage.getItem("dex:poolPair");
    if (!rawPair) {
      loadPools();
      return;
    }
    try {
      const pair = JSON.parse(rawPair) as { assetA: string; assetB: string };
      sessionStorage.removeItem("dex:poolPair");
      if (pair.assetA && pair.assetB) {
        setAssetA(pair.assetA);
        setAssetB(pair.assetB);
        loadPools(pair.assetA, pair.assetB);
        return;
      }
    } catch {
      sessionStorage.removeItem("dex:poolPair");
    }
    loadPools();
  }, [network]);

  useEffect(() => {
    loadAccountPools(selectedPoolId);
  }, [connectedAddress, network, selectedPoolId]);

  useEffect(() => {
    if (selectedPoolId) {
      loadPoolTrades(selectedPoolId);
    }
  }, [selectedPoolId, network]);

  const tabs: { id: ActiveTab; icon: ReactNode; label: string }[] = [
    { id: "discover", icon: <Search size={13} />, label: "Discover" },
    { id: "performance", icon: <TrendingUp size={13} />, label: "Performance" },
    { id: "manage", icon: <Settings2 size={13} />, label: "Manage" },
    { id: "calculator", icon: <Calculator size={13} />, label: "IL Calculator" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Search bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "14px",
        }}
      >
        <AssetField label="Asset A" value={assetA} onChange={setAssetA} />
        <AssetField label="Asset B" value={assetB} onChange={setAssetB} />
        <button
          onClick={() => loadPools()}
          disabled={loading}
          title="Search pools"
          style={buttonStyle(loading)}
        >
          {loading ? <RefreshCw size={15} /> : <Search size={15} />}
          {loading ? "Loading" : "Search"}
        </button>
      </div>

      {error && <div style={{ fontSize: "12px", color: "var(--red)" }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            icon={tab.icon}
            label={tab.label}
          />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "discover" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.9fr)", gap: "12px" }}>
          <div style={panelStyle}>
            <PanelHeader icon={<Droplets size={15} />} title="Pools" detail={`${pools.length} found`} />
            {pools.length === 0 && (
              <EmptyState text={loading ? "Loading pools…" : "No pools found for this pair."} />
            )}
            {pools.map((pool: LiquidityPool) => (
              <button
                key={pool.id}
                onClick={() => setSelectedPoolId(pool.id)}
                style={{
                  width: "100%",
                  border: `1px solid ${selectedPool?.id === pool.id ? "var(--cyan-dim)" : "var(--border)"}`,
                  background: selectedPool?.id === pool.id ? "var(--cyan-glow)" : "transparent",
                  color: "var(--text-primary)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px",
                  marginBottom: "8px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "13px" }}>
                    {pool.assetCodeA}/{pool.assetCodeB}
                  </strong>
                  <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                    {pool.feeBps} bp
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "10px" }}>
                  <MiniMetric label={assetCode(pool.assetA)} value={formatNumber(pool.reserveA)} />
                  <MiniMetric label={assetCode(pool.assetB)} value={formatNumber(pool.reserveB)} />
                  <MiniMetric label="Shares" value={formatNumber(pool.totalShares, 2)} />
                </div>
                <div style={{ marginTop: "8px", color: "var(--text-muted)", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                  {shortId(pool.id)}
                </div>
              </button>
            ))}
          </div>

          <div style={panelStyle}>
            <PanelHeader title="Selected Pool" detail={selectedPool ? shortId(selectedPool.id) : "None"} />
            {!selectedPool ? (
              <EmptyState text="Choose a pool to inspect reserves and your LP share." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <Stat label={`${selectedPool.assetCodeA} Reserve`} value={formatNumber(selectedPool.reserveA)} />
                  <Stat label={`${selectedPool.assetCodeB} Reserve`} value={formatNumber(selectedPool.reserveB)} />
                  <Stat label={`${selectedPool.assetCodeA}/${selectedPool.assetCodeB}`} value={formatNumber(selectedPool.priceBperA)} />
                  <Stat label={`${selectedPool.assetCodeB}/${selectedPool.assetCodeA}`} value={formatNumber(selectedPool.priceAperB)} />
                  <Stat label="Fee" value={`${(selectedPool.feeBps / 100).toFixed(2)}% (${selectedPool.feeBps} bps)`} />
                  <Stat label="Total Shares" value={formatNumber(selectedPool.totalShares, 4)} />
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                  <PanelHeader title="Your Position" detail={accountLoading ? "Refreshing" : connectedAddress ? "Connected" : "No wallet"} compact />
                  {!connectedAddress && <EmptyState text="Connect an account to show LP shares and history." />}
                  {connectedAddress && positions.filter((p: LiquidityPosition) => p.poolId === selectedPool.id).length === 0 && (
                    <EmptyState text="No LP shares for this pool on the connected account." />
                  )}
                  {positions
                    .filter((p: LiquidityPosition) => p.poolId === selectedPool.id)
                    .map((p: LiquidityPosition) => (
                      <div key={p.poolId} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <Stat label="LP Shares" value={formatNumber(p.shares || p.balance || "0", 7)} />
                        <Stat label="Pool Ownership" value={`${formatNumber(p.sharePercent, 5)}%`} />
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "discover" && (
        <div style={panelStyle}>
          <PanelHeader title="Deposit / Withdraw History" detail={connectedAddress ? `${history.length} operations` : "No wallet"} />
          {!connectedAddress && <EmptyState text="Connect an account to show pool deposit and withdrawal history." />}
          {connectedAddress && history.length === 0 && <EmptyState text="No recent deposit or withdrawal operations for this pool." />}
          {history.map((op: Record<string, unknown>) => (
            <div
              key={op.id as string}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                borderTop: "1px solid var(--border)",
                padding: "10px 0",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
              }}
            >
              <span style={{ color: op.type === "liquidity_pool_deposit" ? "var(--green)" : "var(--amber)" }}>
                {op.type === "liquidity_pool_deposit" ? "Deposit" : "Withdraw"}
              </span>
              <span>{operationAmount(op)}</span>
              <span>{op.created_at ? new Date(op.created_at as string).toLocaleString() : "—"}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "performance" && (
        <PerformancePanel
          pools={pools}
          selectedPool={selectedPool}
          poolTrades={poolTrades}
          tradesLoading={tradesLoading}
        />
      )}

      {activeTab === "manage" && (
        <DepositWithdrawPanel pool={selectedPool} connectedAddress={connectedAddress || ""} />
      )}

      {activeTab === "calculator" && (
        <ILCalculatorPanel pool={selectedPool} />
      )}
    </div>
  );
}
