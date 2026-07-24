import React, { useState, useEffect } from "react";
import { useStore } from "../../lib/store";
import { invokeContractFunction, parseContractWasm } from "../../lib/contractInvoker";
import { simulateContractCall, isValidContractId } from "../../lib/stellar";
import { addContractInteraction } from "../../lib/storage";
import { generateId } from "../../lib/notifications";
import ContractHistory from "./ContractHistory";
import { useContractRecommendations } from "../../hooks/useContractRecommendations";
import { Sparkles, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

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
    args: [{ type: "string", value: "", name: "" }],
  });

  const [contractFunctions, setContractFunctions] = useState([]);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [invokeLoading, setInvokeLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  const [invokeResult, setInvokeResult] = useState(null);

  const isMainnet = network === "mainnet";
  const contractIdError =
    form.contractId.trim() !== "" && !isValidContractId(form.contractId.trim());

  useEffect(() => {
    if (!form.contractId || !isValidContractId(form.contractId.trim())) {
      setContractFunctions([]);
      return;
    }
    let isCurrent = true;
    parseContractWasm(form.contractId.trim(), network)
      .then(res => {
        if (isCurrent && res && res.functions) {
          setContractFunctions(res.functions);
        }
      })
      .catch(err => {
        if (isCurrent) {
          console.warn("Failed to load contract specification:", err);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [form.contractId, network]);

  const {
    recommendations,
    track,
    getParamSuggestions,
    getAnomalies,
  } = useContractRecommendations({
    contractFunctions,
    contractId: form.contractId,
    currentFunction: form.functionName,
  });

  const currentFuncMeta = contractFunctions.find(f => f.name === form.functionName);
  const parameterDefinitions = currentFuncMeta?.parameters || [];

  const mappedArgsForAnomaly = form.args.map((arg, idx) => ({
    name: parameterDefinitions[idx]?.name || arg.name || `arg${idx}`,
    type: arg.type,
    value: arg.value
  }));

  const anomalies = getAnomalies(form.functionName, mappedArgsForAnomaly, parameterDefinitions);
  const suggestions = getParamSuggestions(form.functionName, parameterDefinitions);

  function applyAllSuggestions() {
    if (!suggestions) return;
    setForm(current => {
      const nextArgs = current.args.map((arg, idx) => {
        const paramName = parameterDefinitions[idx]?.name;
        if (paramName && suggestions[paramName]) {
          return { ...arg, value: suggestions[paramName].value };
        }
        return arg;
      });
      return { ...current, args: nextArgs };
    });
  }

  function applySingleSuggestion(index, value) {
    updateArgument(index, "value", value);
  }

  // Auto-setup arguments when function changes
  useEffect(() => {
    if (parameterDefinitions.length > 0) {
      setForm(current => {
        const nextArgs = parameterDefinitions.map(param => {
          const lowerType = String(param.type).toLowerCase();
          let type = "string";
          if (lowerType.includes("bool")) type = "bool";
          else if (['int', 'u32', 'i32', 'u64', 'i64', 'u128', 'i128', 'u256', 'i256'].some(t => lowerType.includes(t))) type = "int";
          else if (lowerType.includes("address")) type = "address";

          // Pre-fill suggestion if exists and has high confidence
          const sug = suggestions && suggestions[param.name];
          const sugVal = sug && sug.confidence > 0 ? sug.value : "";

          return {
            name: param.name,
            type,
            value: sugVal
          };
        });
        return { ...current, args: nextArgs };
      });
    }
  }, [form.functionName, contractFunctions]);

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
      args: [...current.args, { type: "string", value: "", name: "" }],
    }));
  }

  function removeArgument(index) {
    setForm((current) => ({
      ...current,
      args: current.args.filter((_, i) => i !== index),
    }));
  }

  async function recordInteraction(type, status, result, errorMsg) {
    const interactionArgs = form.args.map((a, i) => ({
      name: parameterDefinitions[i]?.name || a.name || `arg${i}`,
      type: a.type,
      value: a.value
    }));

    track({
      contractId: form.contractId,
      functionName: form.functionName,
      args: interactionArgs,
      sourceAccount: form.sourceAccount || connectedAddress,
      network,
      status: status === "success" ? "success" : "error",
    });

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
      args: record.args && record.args.length > 0 ? record.args : [{ type: "string", value: "", name: "" }]
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
        {anomalies.filter(a => a.type === 'sequence_anomaly').map((anomaly, ai) => (
          <div
            key={ai}
            style={{
              marginBottom: "14px",
              padding: "10px 14px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid var(--amber-dim)",
              borderRadius: "var(--radius-md)",
              color: "var(--amber)",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={15} />
            <span>{anomaly.message}</span>
          </div>
        ))}

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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <input
                value={form.functionName}
                onChange={(e) => updateField("functionName", e.target.value)}
                placeholder="increment"
                style={textInputStyle()}
              />
              {recommendations.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", alignSelf: "center" }}>AI Suggested:</span>
                  {recommendations.slice(0, 3).map((rec) => (
                    <button
                      key={rec.functionName}
                      onClick={() => updateField("functionName", rec.functionName)}
                      style={{
                        padding: "2px 6px",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        color: "var(--cyan)",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                      title={rec.explanation}
                    >
                      <Sparkles size={8} /> {rec.functionName}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Function Arguments</span>
            {Object.keys(suggestions).length > 0 && (
              <button
                onClick={applyAllSuggestions}
                style={{
                  background: "var(--cyan-glow)",
                  border: "1px solid var(--cyan-dim)",
                  borderRadius: "4px",
                  color: "var(--cyan)",
                  fontSize: "9px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 600
                }}
              >
                <Sparkles size={9} /> Autofill AI Suggestions
              </button>
            )}
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
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          {form.args.map((arg, index) => {
            const paramName = parameterDefinitions[index]?.name;
            const paramType = parameterDefinitions[index]?.type;
            const hasSpecName = !!paramName;
            
            const fieldAnomalies = anomalies.filter(a => a.parameterName === (paramName || `arg${index}`));
            const fieldSuggestion = suggestions[paramName];

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "10px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-md)",
                  border: fieldAnomalies.some(a => a.severity === 'error') ? "1px solid var(--red-dim)" : "1px solid var(--border)",
                }}
              >
                {hasSpecName && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>
                      {paramName} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({paramType})</span>
                    </span>
                    {fieldSuggestion && fieldSuggestion.confidence > 0 && arg.value !== fieldSuggestion.value && (
                      <button
                        onClick={() => applySingleSuggestion(index, fieldSuggestion.value)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--cyan)",
                          fontSize: "10px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title={fieldSuggestion.explanation}
                      >
                        <Sparkles size={10} /> Fill: "{fieldSuggestion.value}"
                      </button>
                    )}
                  </div>
                )}
                
                <div
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
                    disabled={hasSpecName}
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
                      arg.type === "bool" ? "true or false" : hasSpecName ? `Enter ${paramName}` : "Argument value"
                    }
                    style={textInputStyle(fieldAnomalies.some(a => a.severity === 'error'))}
                  />

                  <ActionButton
                    label="Remove"
                    onClick={() => removeArgument(index)}
                    disabled={form.args.length === 1 || hasSpecName}
                    tone="secondary"
                  />
                </div>

                {fieldSuggestion && fieldSuggestion.confidence > 0 && (
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" }}>
                    <Sparkles size={10} style={{ color: "var(--cyan)" }} />
                    <span>AI Suggested: <strong>{fieldSuggestion.value}</strong> — {fieldSuggestion.explanation}</span>
                  </div>
                )}

                {fieldAnomalies.map((anomaly, ai) => (
                  <div
                    key={ai}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "11px",
                      color: anomaly.severity === "error" ? "var(--red)" : "var(--amber)",
                      marginLeft: "4px",
                      marginTop: "2px"
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>{anomaly.message}</span>
                  </div>
                ))}
              </div>
            );
          })}
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
            disabled={simulateLoading || invokeLoading || anomalies.some(a => a.severity === 'error')}
          />
          <ActionButton
            label={invokeLoading ? "Invoking..." : "Invoke"}
            onClick={handleInvoke}
            disabled={isMainnet || invokeLoading || simulateLoading || anomalies.some(a => a.severity === 'error')}
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
