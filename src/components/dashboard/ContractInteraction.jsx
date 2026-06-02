import React, { useState } from "react";
import { useStore } from "../../lib/store";
import { invokeContractFunction } from "../../lib/contractInvoker";
import { simulateContractCall, isValidContractId } from "../../lib/stellar";
import { addContractInteraction } from "../../lib/storage";
import { generateId } from "../../lib/notifications";
import ContractHistory from "./ContractHistory";

const ARGUMENT_TYPES = [
  { value: "string", label: "String" },
  { value: "int", label: "Int" },
  { value: "address", label: "Address" },
  { value: "bool", label: "Bool" },
];

function Panel({ title, subtitle, children }) {
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

function LabeledField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span
        style={{
          fontSize: "11px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function textInputStyle(hasError = false) {
  return {
    width: "100%",
    background: "var(--bg-elevated)",
    border: `1px solid ${hasError ? "var(--red)" : "var(--border-bright)"}`,
    borderRadius: "var(--radius-md)",
    padding: "10px 14px",
    color: "var(--text-primary)",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
    outline: "none",
    transition: "var(--transition)",
    boxSizing: "border-box",
  };
}

function ActionButton({ label, onClick, disabled, tone = "primary" }) {
  const palette =
    tone === "secondary"
      ? {
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-bright)",
        }
      : {
          background: "var(--cyan)",
          color: "var(--bg-base)",
          border: "none",
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        background: disabled ? "var(--bg-elevated)" : palette.background,
        color: disabled ? "var(--text-muted)" : palette.color,
        border: disabled ? "1px solid var(--border)" : palette.border,
        borderRadius: "var(--radius-md)",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "var(--transition)",
      }}
    >
      {label}
    </button>
  );
}

function ResultBlock({ label, data }) {
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
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default function ContractInteraction() {
  const { connectedAddress, network } = useStore();

  const [activeTab, setActiveTab] = useState("interact"); // "interact" | "history"

  const [form, setForm] = useState({
    contractId: "",
    functionName: "",
    sourceAccount: connectedAddress || "",
    secretKey: "",
    args: [{ type: "string", value: "" }],
  });

  const [simulateLoading, setSimulateLoading] = useState(false);
  const [invokeLoading, setInvokeLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [invokeResult, setInvokeResult] = useState(null);

  const isMainnet = network === "mainnet";
  const contractIdError =
    form.contractId.trim() !== "" && !isValidContractId(form.contractId.trim());

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateArgument(index, field, value) {
    setForm((current) => ({
      ...current,
      args: current.args.map((arg, i) =>
        i === index ? { ...arg, [field]: value } : arg,
      ),
    }));
  }

  function addArgument() {
    setForm((current) => ({
      ...current,
      args: [...current.args, { type: "string", value: "" }],
    }));
  }

  function removeArgument(index) {
    setForm((current) => ({
      ...current,
      args: current.args.filter((_, i) => i !== index),
    }));
  }

  async function recordInteraction(type, status, result, errorMsg) {
    await addContractInteraction({
      id: generateId(),
      timestamp: Date.now(),
      network,
      type,
      contractId: form.contractId,
      functionName: form.functionName,
      args: form.args.filter((arg) => arg.value.trim() !== ""),
      sourceAccount: form.sourceAccount || connectedAddress,
      status,
      result,
      error: errorMsg
    });
  }

  async function handleSimulate() {
    setError("");
    setInvokeResult(null);
    setSimulationResult(null);
    setSimulateLoading(true);

    try {
      const result = await simulateContractCall({
        contractId: form.contractId,
        functionName: form.functionName,
        args: form.args.filter((arg) => arg.value.trim() !== ""),
        sourceAccount: form.sourceAccount || connectedAddress,
        network,
      });
      setSimulationResult(result);
      await recordInteraction("simulate", "success", result, null);
    } catch (err) {
      setError(err.message || "Simulation failed");
      await recordInteraction("simulate", "error", null, err.message || "Simulation failed");
    } finally {
      setSimulateLoading(false);
    }
  }

  async function handleInvoke() {
    setError("");
    setInvokeResult(null);
    setInvokeLoading(true);

    try {
      const result = await invokeContractFunction({
        contractId: form.contractId,
        functionName: form.functionName,
        args: form.args.filter((arg) => arg.value.trim() !== ""),
        sourceAccount: form.sourceAccount || connectedAddress,
        secretKey: form.secretKey,
        network,
      });
      setInvokeResult(result);
      await recordInteraction("invoke", "success", result, null);
    } catch (err) {
      setError(err.message || "Invocation failed");
      await recordInteraction("invoke", "error", null, err.message || "Invocation failed");
    } finally {
      setInvokeLoading(false);
    }
  }

  function handleReplay(record) {
    setForm({
      contractId: record.contractId,
      functionName: record.functionName,
      sourceAccount: record.sourceAccount,
      secretKey: "", 
      args: record.args && record.args.length > 0 ? record.args : [{ type: "string", value: "" }]
    });
    setSimulationResult(null);
    setInvokeResult(null);
    setError("");
    setActiveTab("interact");
  }

  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "16px"
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            fontWeight: 700,
          }}
        >
          Contract Interaction
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <ActionButton
            label="Interact"
            onClick={() => setActiveTab("interact")}
            tone={activeTab === "interact" ? "primary" : "secondary"}
          />
          <ActionButton
            label="History"
            onClick={() => setActiveTab("history")}
            tone={activeTab === "history" ? "primary" : "secondary"}
          />
        </div>
      </div>

      {activeTab === "history" ? (
        <ContractHistory onReplay={handleReplay} />
      ) : (
        <>
          <Panel
            title="Contract Call Configuration"
            subtitle="Configure and execute Soroban contract functions"
          >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <LabeledField label="Contract ID">
            <input
              value={form.contractId}
              onChange={(e) => updateField("contractId", e.target.value)}
              placeholder="C... contract address"
              style={textInputStyle(contractIdError)}
            />
          </LabeledField>

          <LabeledField label="Function Name">
            <input
              value={form.functionName}
              onChange={(e) => updateField("functionName", e.target.value)}
              placeholder="increment"
              style={textInputStyle()}
            />
          </LabeledField>

          <LabeledField label="Source Account">
            <input
              value={form.sourceAccount}
              onChange={(e) => updateField("sourceAccount", e.target.value)}
              placeholder={connectedAddress || "G... source account"}
              style={textInputStyle()}
            />
          </LabeledField>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Function Arguments
          </div>
          <ActionButton
            label="Add Argument"
            onClick={addArgument}
            tone="secondary"
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {form.args.map((arg, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr auto",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <select
                value={arg.type}
                onChange={(e) => updateArgument(index, "type", e.target.value)}
                style={textInputStyle()}
              >
                {ARGUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <input
                value={arg.value}
                onChange={(e) => updateArgument(index, "value", e.target.value)}
                placeholder={
                  arg.type === "bool" ? "true or false" : "Argument value"
                }
                style={textInputStyle()}
              />

              <ActionButton
                label="Remove"
                onClick={() => removeArgument(index)}
                disabled={form.args.length === 1}
                tone="secondary"
              />
            </div>
          ))}
        </div>

        <div
          style={{
            marginBottom: "18px",
            padding: "14px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${isMainnet ? "var(--amber)" : "var(--border)"}`,
            background: isMainnet
              ? "rgba(255, 184, 0, 0.08)"
              : "var(--bg-elevated)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: isMainnet ? "var(--amber)" : "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {isMainnet
              ? "Mainnet mode: Simulation available, but transaction submission is disabled for safety."
              : "Testnet mode: Full simulation and submission available."}
          </div>

          <LabeledField label="Secret Key (for submission)">
            <input
              type="password"
              value={form.secretKey}
              onChange={(e) => updateField("secretKey", e.target.value)}
              placeholder="S... testnet secret key"
              style={textInputStyle()}
            />
          </LabeledField>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <ActionButton
            label={simulateLoading ? "Simulating..." : "Simulate"}
            onClick={handleSimulate}
            disabled={simulateLoading || invokeLoading}
          />
          <ActionButton
            label={invokeLoading ? "Invoking..." : "Invoke"}
            onClick={handleInvoke}
            disabled={isMainnet || invokeLoading || simulateLoading}
            tone="secondary"
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: "14px",
              fontSize: "12px",
              color: "var(--red)",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </Panel>

      {simulationResult && (
        <div style={{ display: "grid", gap: "16px" }}>
          <ResultBlock
            label="Simulation Result"
            data={simulationResult.result}
          />
          <ResultBlock label="Events" data={simulationResult.events} />
        </div>
      )}

      {invokeResult && (
        <ResultBlock label="Invocation Result" data={invokeResult} />
      )}
        </>
      )}
    </div>
  );
}
