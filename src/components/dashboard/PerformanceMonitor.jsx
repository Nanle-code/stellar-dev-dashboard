import React, { useState, useEffect } from "react";
import {
  getMetricsSummary,
  getPerformanceScore,
  getBundleAnalysis,
  formatBytes,
  formatMs,
  PERFORMANCE_BUDGETS,
} from "../../lib/performanceMonitoring";
import {
  Activity,
  Zap,
  Package,
  AlertTriangle,
  CheckCircle,
  Bell,
  MousePointerClick,
} from "lucide-react";

/**
 * Performance Monitor Dashboard Component
 */
export default function PerformanceMonitor() {
  const [summary, setSummary] = useState(null);
  const [score, setScore] = useState(100);
  const [bundleAnalysis, setBundleAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("vitals");
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    updateMetrics();

    // Listen for new metrics
    const handleMetric = () => {
      updateMetrics();
    };

    window.addEventListener("performance-metric", handleMetric);
    const handleRegression = (event) => {
      setAlerts((current) => [event.detail, ...current].slice(0, 8));
      updateMetrics();
    };
    window.addEventListener("performance-regression", handleRegression);

    // Update every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    return () => {
      window.removeEventListener("performance-metric", handleMetric);
      window.removeEventListener("performance-regression", handleRegression);
      clearInterval(interval);
    };
  }, []);

  function updateMetrics() {
    setSummary(getMetricsSummary());
    setScore(getPerformanceScore());
    setBundleAnalysis(getBundleAnalysis());
  }

  if (!summary) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--text-muted)",
        }}
      >
        Loading performance data...
      </div>
    );
  }

  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
          >
            Performance Monitor
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginTop: "4px",
            }}
          >
            Real-time performance metrics and Core Web Vitals
          </div>
        </div>

        {/* Performance Score */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "16px 24px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                marginBottom: "4px",
              }}
            >
              Performance Score
            </div>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color:
                  score >= 90
                    ? "var(--green)"
                    : score >= 70
                      ? "var(--yellow)"
                      : "var(--red)",
              }}
            >
              {score}
            </div>
          </div>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              border: `4px solid ${score >= 90 ? "var(--green)" : score >= 70 ? "var(--yellow)" : "var(--red)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {score >= 90 ? (
              <CheckCircle size={24} style={{ color: "var(--green)" }} />
            ) : (
              <AlertTriangle
                size={24}
                style={{ color: score >= 70 ? "var(--yellow)" : "var(--red)" }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[
          { id: "vitals", label: "Web Vitals", icon: Activity },
          { id: "bundle", label: "Bundle Analysis", icon: Package },
          { id: "custom", label: "Custom Metrics", icon: Zap },
          { id: "alerts", label: "Alerts", icon: Bell },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 20px",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--cyan)"
                  : "2px solid transparent",
              color: activeTab === tab.id ? "var(--cyan)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "var(--transition)",
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Web Vitals Tab */}
      {activeTab === "vitals" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {Object.entries(summary.webVitals).map(([name, data]) => (
            <MetricCard
              key={name}
              name={name}
              value={data.value}
              budget={data.budget}
              withinBudget={data.withinBudget}
            />
          ))}
        </div>
      )}

      {/* Bundle Analysis Tab */}
      {activeTab === "bundle" && bundleAnalysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <BundleCard
            title="JavaScript"
            data={bundleAnalysis.javascript}
            color="var(--yellow)"
          />
          <BundleCard
            title="CSS"
            data={bundleAnalysis.css}
            color="var(--cyan)"
          />
          <BundleCard
            title="Images"
            data={bundleAnalysis.images}
            color="var(--purple)"
          />
        </div>
      )}

      {/* Custom Metrics Tab */}
      {activeTab === "custom" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <MetricGroup
            title="Stellar Operations"
            metrics={filterMetrics(summary.customMetrics, [
              "API_RESPONSE_TIME",
              "TRANSACTION_SIGNING_DURATION",
              "TRANSACTION_SUBMIT_DURATION",
              "CONTRACT_SIMULATION_DURATION",
              "CONTRACT_INVOCATION_DURATION",
            ])}
          />
          <MetricGroup
            title="Other Custom Metrics"
            metrics={excludeMetrics(summary.customMetrics, [
              "API_RESPONSE_TIME",
              "TRANSACTION_SIGNING_DURATION",
              "TRANSACTION_SUBMIT_DURATION",
              "CONTRACT_SIMULATION_DURATION",
              "CONTRACT_INVOCATION_DURATION",
              "USER_INTERACTION",
            ])}
          />

          {Object.keys(summary.customMetrics).length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "48px",
                textAlign: "center",
                color: "var(--text-muted)",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
              }}
            >
              No custom metrics recorded yet
            </div>
          )}

          <InteractionPanel interactions={summary.interactions} />
        </div>
      )}

      {activeTab === "alerts" && (
        <AlertPanel
          alerts={alerts.length ? alerts : summary.budgetViolations}
        />
      )}

      {/* Budget Violations */}
      {summary.budgetViolations.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <AlertTriangle size={20} style={{ color: "var(--red)" }} />
            <div style={{ fontSize: "16px", fontWeight: 700 }}>
              Performance Budget Violations ({summary.budgetViolations.length})
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {summary.budgetViolations.map((violation, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>
                    {violation.metric}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Budget: {formatValue(violation.budget, violation.metric)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--red)",
                    }}
                  >
                    {formatValue(violation.value, violation.metric)}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    +{formatValue(violation.overage, violation.metric)} over
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function filterMetrics(metrics, names) {
  return Object.fromEntries(
    Object.entries(metrics).filter(([name]) => names.includes(name)),
  );
}

function excludeMetrics(metrics, names) {
  return Object.fromEntries(
    Object.entries(metrics).filter(([name]) => !names.includes(name)),
  );
}

function MetricGroup({ title, metrics }) {
  const entries = Object.entries(metrics);

  return (
    <div>
      <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {entries.map(([name, data]) => (
          <CustomMetricCard key={name} name={name} data={data} />
        ))}
        {entries.length === 0 && (
          <div
            style={{
              padding: "20px",
              color: "var(--text-muted)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              fontSize: "13px",
            }}
          >
            No metrics recorded yet
          </div>
        )}
      </div>
    </div>
  );
}

function InteractionPanel({ interactions }) {
  const recent = interactions?.recent || [];

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <MousePointerClick size={18} style={{ color: "var(--cyan)" }} />
        <div style={{ fontSize: "14px", fontWeight: 700 }}>
          User Interactions ({interactions?.total || 0})
        </div>
      </div>
      <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {recent.map((interaction, index) => (
          <div
            key={`${interaction.timestamp}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "12px",
              color: "var(--text-secondary)",
            }}
          >
            <span>{interaction.action}</span>
            <span style={{ color: "var(--text-muted)" }}>
              {new Date(interaction.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {recent.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
            No recent interactions
          </div>
        )}
      </div>
    </div>
  );
}

function AlertPanel({ alerts }) {
  if (!alerts.length) {
    return (
      <div
        style={{
          padding: "32px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        No performance regressions detected
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {alerts.map((alert, index) => (
        <div
          key={`${alert.metric}-${alert.timestamp || index}`}
          style={{
            background: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700 }}>
              {alert.metric}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              Budget {formatValue(alert.budget, alert.metric)}
            </div>
          </div>
          <div style={{ textAlign: "right", color: "var(--red)", fontWeight: 700 }}>
            {formatValue(alert.value, alert.metric)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({ name, value, budget, withinBudget }) {
  const percentage = budget ? Math.min((value / budget) * 100, 100) : 0;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${withinBudget ? "var(--border)" : "var(--red)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          marginBottom: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--text-muted)",
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>
            {formatValue(value, name)}
          </div>
        </div>
        {withinBudget ? (
          <CheckCircle size={20} style={{ color: "var(--green)" }} />
        ) : (
          <AlertTriangle size={20} style={{ color: "var(--red)" }} />
        )}
      </div>

      {budget && (
        <>
          <div
            style={{
              height: "6px",
              background: "var(--bg-elevated)",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${percentage}%`,
                background: withinBudget ? "var(--green)" : "var(--red)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Budget: {formatValue(budget, name)}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Bundle Card Component
 */
function BundleCard({ title, data, color }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${data.withinBudget ? "var(--border)" : "var(--red)"}`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: color,
            }}
          />
          <div style={{ fontSize: "15px", fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ fontSize: "14px", fontWeight: 700 }}>
          {formatBytes(data.totalSize)}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Files: {data.count}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Budget: {formatBytes(data.budget)}
          </span>
        </div>

        <div
          style={{
            height: "6px",
            background: "var(--bg-elevated)",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min((data.totalSize / data.budget) * 100, 100)}%`,
              background: data.withinBudget ? color : "var(--red)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Custom Metric Card Component
 */
function CustomMetricCard({ name, data }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${data.withinBudget ? "var(--border)" : "var(--orange)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "20px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--text-muted)",
          marginBottom: "8px",
        }}
      >
        {name}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Average
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
            {formatMs(data.average)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Min
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
            {formatMs(data.min)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Max
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "4px" }}>
            {formatMs(data.max)}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          marginTop: "12px",
        }}
      >
        {data.count} measurement{data.count !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

/**
 * Format value based on metric type
 */
function formatValue(value, metricName) {
  if (metricName === "CLS") {
    return value.toFixed(3);
  }

  if (metricName.includes("SIZE") || metricName.includes("size")) {
    return formatBytes(value);
  }

  return formatMs(value);
}
