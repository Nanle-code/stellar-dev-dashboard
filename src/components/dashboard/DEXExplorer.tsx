import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useStore } from "../../lib/store";
import { fetchOrderBook, fetchTrades, parseAssetString } from "../../lib/dex";
import type { OrderBookEntry, SpreadInfo } from "./types";
import LiquidityPools from "./LiquidityPools";

interface OrderBookData {
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
}

interface TradeRecord {
  id: string
  price?: { n: number; d: number }
  base_amount?: string
  ledger_close_time: string
}

function toAsset(assetInput: string): StellarSdk.Asset {
  if (!assetInput || assetInput === "native" || assetInput === "XLM") {
    return StellarSdk.Asset.native();
  }
  const parsed = parseAssetString(assetInput);
  if (parsed.type === "native") return StellarSdk.Asset.native();
  return new StellarSdk.Asset(parsed.code, parsed.issuer);
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? "var(--cyan-dim)" : "var(--border)"}`,
        background: active ? "var(--cyan-glow)" : "transparent",
        color: active ? "var(--cyan)" : "var(--text-secondary)",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        padding: "7px 10px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "10px",
      }}
    >
      <div style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "12px", color: "var(--text-primary)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
    </div>
  );
}

function BookSide({ title, rows, accent }: { title: string; rows: OrderBookEntry[]; accent: string }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", color: accent, fontFamily: "var(--font-display)", fontSize: "13px" }}>
        {title}
      </div>
      {rows.length === 0 && (
        <div style={{ padding: "14px", fontSize: "12px", color: "var(--text-muted)" }}>
          No levels loaded.
        </div>
      )}
      {rows.map((row, index) => (
        <div
          key={`${title}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            borderBottom: "1px solid var(--border)",
            padding: "8px 14px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
          }}
        >
          <span>{row.price}</span>
          <span>{row.amount}</span>
        </div>
      ))}
    </div>
  );
}

export default function DEXExplorer() {
  const { network } = useStore();
  const [activeView, setActiveView] = useState("orderbook");
  const [selling, setSelling] = useState("native");
  const [buying, setBuying] = useState(
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  );
  const [book, setBook] = useState<OrderBookData | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("dex:poolPair")) {
      setActiveView("pools");
    }
  }, []);

  const spread: SpreadInfo | null = useMemo(() => {
    const bestBid = Number(book?.bids?.[0]?.price || 0);
    const bestAsk = Number(book?.asks?.[0]?.price || 0);
    if (!bestBid || !bestAsk) return null;
    return {
      absolute: bestAsk - bestBid,
      percent: ((bestAsk - bestBid) / bestAsk) * 100,
      bestBid,
      bestAsk,
    };
  }, [book]);

  async function handleLoad() {
    setLoading(true);
    setError("");
    try {
      const sellingAsset = toAsset(selling.trim());
      const buyingAsset = toAsset(buying.trim());

      const [orderBook, tradeList] = await Promise.all([
        fetchOrderBook(sellingAsset, buyingAsset, network, 10),
        fetchTrades(sellingAsset, buyingAsset, network, 10),
      ]);

      setBook(orderBook);
      setTrades(tradeList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load DEX data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700 }}>
            DEX Explorer
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
            Order books, trades, and AMM liquidity pools
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <ViewButton active={activeView === "orderbook"} onClick={() => setActiveView("orderbook")}>
            Order Books
          </ViewButton>
          <ViewButton active={activeView === "pools"} onClick={() => setActiveView("pools")}>
            Liquidity Pools
          </ViewButton>
        </div>
      </div>

      {activeView === "pools" ? (
        <LiquidityPools />
      ) : (
        <>
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
        <input
          value={selling}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSelling(event.target.value)}
          placeholder='Selling asset (e.g. "native" or "USDC:G...")'
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
        <input
          value={buying}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setBuying(event.target.value)}
          placeholder='Buying asset (e.g. "native" or "USDC:G...")'
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
        <button
          onClick={handleLoad}
          disabled={loading}
          style={{
            border: "1px solid var(--cyan-dim)",
            background: "var(--cyan-glow)",
            color: "var(--cyan)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
            padding: "9px 12px",
          }}
        >
          {loading ? "Loading..." : "Fetch"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: "12px", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {spread && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <Stat label="Best Bid" value={spread.bestBid.toFixed(7)} />
          <Stat label="Best Ask" value={spread.bestAsk.toFixed(7)} />
          <Stat label="Spread" value={spread.absolute.toFixed(7)} />
          <Stat label="Spread %" value={`${spread.percent.toFixed(3)}%`} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <BookSide title="Bids" rows={book?.bids || []} accent="var(--green)" />
        <BookSide title="Asks" rows={book?.asks || []} accent="var(--red)" />
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontFamily: "var(--font-display)", fontSize: "13px" }}>
          Recent Trades
        </div>
        {trades.length === 0 && (
          <div style={{ padding: "14px", color: "var(--text-muted)", fontSize: "12px" }}>
            No trades loaded yet.
          </div>
        )}
        {trades.map((trade: TradeRecord) => (
          <div
            key={trade.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom: "1px solid var(--border)",
              padding: "9px 14px",
              fontSize: "11px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>{trade.price?.n || "—"}</span>
            <span>{trade.base_amount || "—"}</span>
            <span>{new Date(trade.ledger_close_time).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}
