import React from "react";

// Minimal working component.
// Fixes broken export/import contract from src/App.jsx
export default function DEXExplorer() {
  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18 }}>
        DEX Explorer
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        This section is a placeholder until the full DEX Explorer implementation is completed.
      </div>
    </div>
  );
}

// Named export for compatibility with App.jsx: `import { DEXExplorer } from ...`
export { DEXExplorer };

