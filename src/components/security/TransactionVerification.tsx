import React, { useState, useEffect } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import { fetchAccount, fetchTransactions, NETWORKS } from "./stellar";
import { isWhitelistedAddress } from "../../lib/riskWhitelist.js";
import { logApprovedHighRiskTransaction } from "../../lib/highRiskLogger.js";
import {
  verifyTransaction,
  RISK_LEVELS,
} from "../../lib/transactionVerification";
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";

/**
 * Risk Level Badge Component
 */
function RiskBadge({ level }) {
  const config = {
    [RISK_LEVELS.LOW]: {
      color: "var(--green)",
      bg: "rgba(34, 197, 94, 0.1)",
      icon: CheckCircle,
      label: "Low Risk",
    },
    [RISK_LEVELS.MEDIUM]: {
      color: "var(--yellow)",
      bg: "rgba(234, 179, 8, 0.1)",
      icon: Info,
      label: "Medium Risk",
    },
    [RISK_LEVELS.HIGH]: {
      color: "var(--orange)",
      bg: "rgba(249, 115, 22, 0.1)",
      icon: AlertTriangle,
      label: "High Risk",
    },
    [RISK_LEVELS.CRITICAL]: {
      color: "var(--red)",
      bg: "rgba(239, 68, 68, 0.1)",
      icon: XCircle,
      label: "Critical Risk",
    },
  };

  const {
    color,
    bg,
    icon: Icon,
    label,
  } = config[level] || config[RISK_LEVELS.LOW];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 16px",
        background: bg,
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-md)",
        color,
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <Icon size={16} />
      {label}
    </div>
  );
}

/**
 * Transaction Verification Display Component
 */
export default function TransactionVerification({
  transaction,
  network = "testnet",
  sourceAccount = null,
  onOverride = () => {},
}) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (transaction) {
      verifyTransactionAsync();
    }
  }, [transaction, network, sourceAccount]);

  async function verifyTransactionAsync() {
    setLoading(true);
    try {
      const result = await verifyTransaction(
        transaction,
        network,
        sourceAccount,
      );
      setVerification(result);
    } catch (error) {
      setVerification({
        success: false,
        error: error.message,
        riskLevel: RISK_LEVELS.CRITICAL,
        warnings: ["Verification failed"],
        errors: [error.message],
        info: [],
        recommendations: ["Do not proceed with this transaction"],
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <Shield
          size={32}
          style={{ color: "var(--cyan)", marginBottom: "12px" }}
        />
        <div style={{ fontSize: "14px", color: "var(--text-muted)" }}>
          Verifying transaction...
        </div>
      </div>
    );
  }

  if (!verification) {
    return null;
  }

  const hasWarnings = verification.warnings?.length > 0;
  const hasErrors = verification.errors?.length > 0;
  const hasInfo = verification.info?.length > 0;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Shield size={24} style={{ color: "var(--cyan)" }} />
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>
              Transaction Verification
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "2px",
              }}
            >
              Risk analysis completed in {verification.verificationTime}ms
            </div>
          </div>
        </div>
        <RiskBadge level={verification.riskLevel} />
      </div>

      {/* Risk Score */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Risk Score
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              flex: 1,
              height: "8px",
              background: "var(--bg-elevated)",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(verification.riskScore, 100)}%`,
                background:
                  verification.riskLevel === RISK_LEVELS.CRITICAL
                    ? "var(--red)"
                    : verification.riskLevel === RISK_LEVELS.HIGH
                      ? "var(--orange)"
                      : verification.riskLevel === RISK_LEVELS.MEDIUM
                        ? "var(--yellow)"
                        : "var(--green)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "18px", fontWeight: 700, minWidth: "50px" }}>
            {verification.riskScore}/100
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {verification.recommendations?.length > 0 && (
        <div style={{ padding: "20px 24px", background: "var(--bg-elevated)" }}>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Recommendations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {verification.recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                }}
              >
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div
          style={{ padding: "20px 24px", borderTop: "1px solid var(--border)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <AlertTriangle size={16} style={{ color: "var(--orange)" }} />
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--orange)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Warnings ({verification.warnings.length})
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {verification.warnings.map((warning, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  padding: "8px 12px",
                  background: "rgba(249, 115, 22, 0.05)",
                  border: "1px solid rgba(249, 115, 22, 0.2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {hasErrors && (
        <div
          style={{ padding: "20px 24px", borderTop: "1px solid var(--border)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <XCircle size={16} style={{ color: "var(--red)" }} />
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--red)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              Errors ({verification.errors.length})
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {verification.errors.map((error, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: "13px",
                  color: "var(--text-primary)",
                  padding: "8px 12px",
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info (collapsible) */}
      {hasInfo && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%",
              padding: "16px 24px",
              background: "none",
              border: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              color: "var(--text-primary)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Info size={16} style={{ color: "var(--cyan)" }} />
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Details ({verification.info.length})
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {expanded ? "▲" : "▼"}
            </div>
          </button>

          {expanded && (
            <div style={{ padding: "0 24px 20px" }}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {verification.info.map((info, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    • {info}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
