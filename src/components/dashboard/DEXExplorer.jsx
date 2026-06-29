import React, { useState } from "react";
import OrderBookChart from "./OrderBookChart";

/**
 * DEXExplorer Component
 * 
 * Implements a tabbed dashboard for DEX analysis:
 * - Liquidity Pools
 * - Yield Opportunities
 * - Order Book (with visualization)
 */
export default function DEXExplorer() {
  const [activeTab, setActiveTab] = useState("orderbook");

  const tabs = [
    { id: "pools", label: "Liquidity Pools" },
    { id: "yield", label: "Yield Opportunities" },
    { id: "orderbook", label: "Order Book" },
  ];

  return (
    <div style={{ padding: "20px", background: "var(--bg-body)" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2 style={{ color: "var(--text-primary)" }}>DEX Explorer</h2>
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 16px",
                background: activeTab === tab.id ? "var(--cyan)" : "var(--bg-card)",
                color: activeTab === tab.id ? "white" : "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--bg-card)", padding: "20px", borderRadius: "var(--radius-lg)" }}>
        {activeTab === "orderbook" && (
          <div>
            <h3 style={{ color: "var(--text-primary)" }}>Order Book</h3>
            <OrderBookChart bids={[]} asks={[]} />
            {/* Future: Add order list and trade history here */}
          </div>
        )}
        {activeTab === "pools" && <p>Liquidity Pools view (Coming soon)</p>}
        {activeTab === "yield" && <p>Yield Opportunities view (Coming soon)</p>}
      </div>
    </div>
  );
}
