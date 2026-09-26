import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { OrderBookEntry, OrderBookChartPoint } from "./types";

interface OrderBookChartProps {
  bids?: OrderBookEntry[]
  asks?: OrderBookEntry[]
}

export default function OrderBookChart({ bids = [], asks = [] }: OrderBookChartProps) {
  const bidData: OrderBookChartPoint[] = bids.slice(0, 20).map((bid, i) => ({
    price: parseFloat(bid.price),
    amount: parseFloat(bid.amount),
    cumulative: bids
      .slice(0, i + 1)
      .reduce((sum, b) => sum + parseFloat(b.amount), 0),
    type: "bid",
  }));

  const askData: OrderBookChartPoint[] = asks.slice(0, 20).map((ask, i) => ({
    price: parseFloat(ask.price),
    amount: parseFloat(ask.amount),
    cumulative: asks
      .slice(0, i + 1)
      .reduce((sum, a) => sum + parseFloat(a.amount), 0),
    type: "ask",
  }));

  const chartData = [...bidData.reverse(), ...askData];

  if (chartData.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "var(--text-muted)",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        No order book data available
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "13px",
          marginBottom: "16px",
        }}
      >
        Order Book Depth Chart
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="price"
            stroke="var(--text-muted)"
            style={{ fontSize: "11px" }}
            tickFormatter={(value: number) => value.toFixed(4)}
          />
          <YAxis
            stroke="var(--text-muted)"
            style={{ fontSize: "11px" }}
            tickFormatter={(value: number) => value.toFixed(2)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [value.toFixed(4), name]}
          />
          <Area
            type="stepAfter"
            dataKey="cumulative"
            stroke="var(--cyan)"
            fill="var(--cyan)"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
