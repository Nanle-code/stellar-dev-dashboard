import React from "react";
import {
  getAccountUrl,
  getTransactionUrl,
  getContractUrl,
  EXPLORERS,
} from "../lib/externalExplorers";

export function ExternalAccountLinks({ publicKey, network }) {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {Object.keys(EXPLORERS).map((explorerKey) => {
        const url = getAccountUrl(explorerKey, network, publicKey);
        const explorer = EXPLORERS[explorerKey];

        return (
          <a
            key={explorerKey}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--cyan)",
              fontSize: "12px",
              textDecoration: "none",
              transition: "var(--transition)",
            }}
          >
            <span>{explorer.logo}</span>
            <span>{explorer.name}</span>
            <span>↗</span>
          </a>
        );
      })}
    </div>
  );
}

export function ExternalTransactionLinks({ txHash, network }) {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {Object.keys(EXPLORERS).map((explorerKey) => {
        const url = getTransactionUrl(explorerKey, network, txHash);
        const explorer = EXPLORERS[explorerKey];

        return (
          <a
            key={explorerKey}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--cyan)",
              fontSize: "11px",
              textDecoration: "none",
              transition: "var(--transition)",
            }}
          >
            <span>{explorer.logo}</span>
            <span>{explorer.name}</span>
          </a>
        );
      })}
    </div>
  );
}

export function ExternalContractLinks({ contractId, network }) {
  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {Object.keys(EXPLORERS).map((explorerKey) => {
        const url = getContractUrl(explorerKey, network, contractId);
        const explorer = EXPLORERS[explorerKey];

        return (
          <a
            key={explorerKey}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--cyan)",
              fontSize: "12px",
              textDecoration: "none",
              transition: "var(--transition)",
            }}
          >
            <span>{explorer.logo}</span>
            <span>{explorer.name}</span>
            <span>↗</span>
          </a>
        );
      })}
    </div>
  );
}
