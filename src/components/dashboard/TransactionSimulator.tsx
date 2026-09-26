import React, { useState, type ReactNode } from "react";
import { simulateTransaction } from "../../lib/stellar";
import type { SimulateResult } from "../../lib/stellar";
import { useStore } from "../../lib/store";
import { getErrorMessage } from "../../lib/errorHandling/ErrorMessages";

interface PanelProps {
  title: string
  subtitle?: string
  children: ReactNode
}

interface ResultBlockProps {
  label: string
  data: unknown
}

interface TransactionParams {
  sourceAccount?: string
  operations?: Array<Record<string, unknown>>
  baseFee?: number
  timeBounds?: Record<string, unknown>
  network?: string
}

function Panel({ title, subtitle, children }: PanelProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "13px",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              marginTop: "4px",
              fontSize: "11px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div style={{ padding: "18px" }}>{children}</div>
    </div>
  );
}

function ResultBlock({ label, data }: ResultBlockProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "14px",
          fontSize: "11px",
          color: "var(--text-secondary)",
          overflowX: "auto",
          lineHeight: 1.6,
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function TransactionSimulator({
  transactionParams: propParams,
  onSimulate,
}: {
  transactionParams?: TransactionParams
  onSimulate?: (result: SimulateResult) => void
}) {
  const { connectedAddress, network } = useStore();
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);

  const transactionParams = propParams || {
    sourceAccount: connectedAddress || "",
    operations: [],
    baseFee: 100,
    timeBounds: {},
    network
  };

  async function handleSimulate() {
    if (!transactionParams.sourceAccount) {
      const err = getErrorMessage('validation');
      setResult({ success: false, errors: [err.message], fee: 0, operationCount: 0 });
      return;
    }

    setLoading(true);
    try {
      const simResult = await simulateTransaction(transactionParams);
      setResult(simResult);
      if (onSimulate) onSimulate(simResult);
    } catch (error: unknown) {
      const err = getErrorMessage('stellar');
      setResult({ success: false, errors: [error instanceof Error ? error.message : err.message], fee: 0, operationCount: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="Simulation Results"
      subtitle="Preview transaction execution before submission"
    >
      {!result ? (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "var(--text-muted)",
          }}
        >
          Click "Simulate Transaction" to preview results
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              background: result.success
                ? "var(--green-glow)"
                : "rgba(255, 0, 0, 0.1)",
              border: `1px solid ${result.success ? "var(--green)" : "var(--red)"}`,
              color: result.success ? "var(--green)" : "var(--red)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {result.success ? "✓ Simulation Successful" : "✗ Simulation Failed"}
          </div>

          {result.errors && result.errors.length > 0 && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                Errors
              </div>
              {result.errors.map((error: string, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    background: "rgba(255, 0, 0, 0.1)",
                    border: "1px solid var(--red)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--red)",
                    fontSize: "12px",
                  }}
                >
                  {error}
                </div>
              ))}
            </div>
          )}

          {result.success && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    Estimated Fee
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--cyan)",
                    }}
                  >
                    {result.fee} stroops
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    Operations
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {result.operationCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    Hash
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {result.hash?.slice(0, 16)}...
                  </div>
                </div>
              </div>

              {result.sorobanMetrics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Soroban Resources
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                    <div style={{ padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Resource Fee</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--green)' }}>{result.sorobanMetrics.resourceFee} stroops</div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Footprint (RO/RW)</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {result.sorobanMetrics.footprint.readOnly.length} / {result.sorobanMetrics.footprint.readWrite.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result.xdr && (
                <ResultBlock label="Transaction XDR" data={result.xdr} />
              )}
            </>
          )}

          <button
            onClick={handleSimulate}
            disabled={loading}
            style={{
              marginTop: '8px',
              padding: '12px',
              background: 'var(--cyan-glow)',
              border: '1px solid var(--cyan)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--cyan)',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'var(--transition)',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Simulating...' : 'Simulate Transaction'}
          </button>
        </div>
      )}
    </Panel>
  );
}
