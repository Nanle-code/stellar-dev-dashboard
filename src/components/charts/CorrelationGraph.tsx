import React, { useRef, useState, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useCorrelation } from "../../hooks/useCorrelation";

export default function CorrelationGraph() {
  const { data, loading, error } = useCorrelation();
  const graphRef = useRef<any>();
  const [selectedLink, setSelectedLink] = useState<any>(null);

  // Resize graph on mount
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: 400
      });
    }
  }, []);

  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Analyzing AI correlations...</div>;
  }

  if (error) {
    return <div style={{ padding: "20px", color: "red" }}>Error loading correlations: {error.message}</div>;
  }

  if (!data || data.nodes.length === 0) {
    return <div style={{ padding: "20px" }}>No correlation data available yet.</div>;
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        background: "var(--bg-card)", 
        border: "1px solid var(--border)", 
        borderRadius: "var(--radius-lg)", 
        overflow: "hidden",
        position: "relative"
      }}
    >
      <div style={{ padding: "14px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "16px" }}>
          AI Metrics Correlation Discovery
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
          Nodes represent data streams. Links indicate strong correlations. Click a link for an AI explanation.
        </p>
      </div>
      
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div style={{ flex: 1, borderRight: selectedLink ? "1px solid var(--border)" : "none" }}>
          <ForceGraph2D
            ref={graphRef}
            width={selectedLink ? dimensions.width * 0.6 : dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel="label"
            nodeColor={() => "var(--cyan)"}
            nodeRelSize={6}
            linkColor={(link) => (link.value > 0 ? "rgba(0, 255, 128, 0.6)" : "rgba(255, 64, 64, 0.6)")}
            linkWidth={(link) => Math.abs(link.value) * 5}
            onLinkClick={(link) => setSelectedLink(link)}
            enableNodeDrag={true}
            enableZoomPanInteraction={true}
          />
        </div>

        {selectedLink && (
          <div style={{ width: "40%", padding: "20px", background: "var(--bg-elevated)", overflowY: "auto" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "var(--text-primary)" }}>
              Relationship Explanation
            </h4>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "15px" }}>
              <strong>Metrics:</strong> {selectedLink.source.label || selectedLink.source.id} ↔ {selectedLink.target.label || selectedLink.target.id}
              <br />
              <strong>Correlation (r):</strong> {selectedLink.value.toFixed(3)}
            </div>
            <div style={{ 
              padding: "12px", 
              background: "rgba(0, 200, 255, 0.1)", 
              borderLeft: "4px solid var(--cyan)",
              borderRadius: "4px",
              fontSize: "14px",
              lineHeight: 1.5,
              color: "var(--text-primary)"
            }}>
              ✨ {selectedLink.explanation}
            </div>
            <button 
              onClick={() => setSelectedLink(null)}
              style={{
                marginTop: "20px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
