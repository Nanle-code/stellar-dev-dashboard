import React, { useState, useMemo, useEffect } from "react";
import { useStore } from "../../lib/store";
import { OPERATION_TYPES, simulateTransaction, buildTransaction } from "../../lib/transactionBuilder";
import { validateOperation } from "../../utils/transactionValidation";
import { TRANSACTION_TEMPLATES } from "../../lib/transactionTemplates.js";
import {
  getCachedUserTransactionTemplates,
  upsertUserTransactionTemplate,
} from "../../lib/transactionTemplateVault.ts";
import { Copy, Play, Download, AlertCircle, CheckCircle, ArrowDown, GripVertical, Trash2, Plus, Zap } from "lucide-react";

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

function getAllTransactionTemplates() {
  const user = getCachedUserTransactionTemplates();
  const byId = new Map();
  [...user, ...TRANSACTION_TEMPLATES].forEach((t) => {
    if (!t?.id) return;
    byId.set(t.id, t);
  });
  return Array.from(byId.values());
}

export default function TransactionBuilder() {
  const { connectedAddress, network, selectedTemplateId, setSelectedTemplateId } = useStore();
  const availableTemplates = useMemo(() => getAllTransactionTemplates(), [selectedTemplateId]);

  const [sourceAccount, setSourceAccount] = useState(connectedAddress || "");
  const [memo, setMemo] = useState("");
  const [memoType, setMemoType] = useState("text");
  const [baseFee, setBaseFee] = useState("100");
  const [timeout, setTimeout] = useState("180");
  const [operations, setOperations] = useState([
    {
      id: Date.now(),
      type: "payment",
      params: { destination: "", amount: "", assetType: "native" },
    },
  ]);
  
  const [simulation, setSimulation] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showXDR, setShowXDR] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  function addOperation() {
    setOperations([
      ...operations,
      {
        id: Date.now(),
        type: "payment",
        params: { destination: "", amount: "", assetType: "native" },
      },
    ]);
  }

  function removeOperation(id) {
    setOperations(operations.filter((op) => op.id !== id));
  }

  function updateOperation(id, field, value) {
    const updated = operations.map(op => {
      if (op.id !== id) return op;
      if (field === "type") {
        return { ...op, type: value, params: {} };
      }
      return { ...op, params: { ...op.params, [field]: value } };
    });
    setOperations(updated);
  }
  
  function duplicateOperation(id) {
    const opToDuplicate = operations.find(op => op.id === id);
    if (!opToDuplicate) return;
    const newOp = { ...opToDuplicate, id: Date.now(), params: { ...opToDuplicate.params } };
    const index = operations.findIndex(op => op.id === id);
    const updated = [...operations];
    updated.splice(index + 1, 0, newOp);
    setOperations(updated);
  }
  
  function loadTemplate(templateKey) {
    const template = availableTemplates.find((t) => t.id === templateKey);
    if (!template) return;
    setMemo(template.memo || "");
    setMemoType(template.memoType || "text");
    setOperations(
      (template.operations || []).map((op) => ({
        ...op,
        id: Date.now() + Math.random(),
      })),
    );
  }

  useEffect(() => {
    if (!selectedTemplateId) return;
    loadTemplate(selectedTemplateId);
    setSelectedTemplateId(null);
  }, [selectedTemplateId]);
  
  // Drag and drop handlers
  function handleDragStart(index) {
    setDraggedIndex(index);
  }
  
  function handleDragOver(e, index) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updated = [...operations];
    const draggedOp = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedOp);
    setOperations(updated);
    setDraggedIndex(index);
  }
  
  function handleDragEnd() {
    setDraggedIndex(null);
  }
  
  // Validation
  const validationErrors = useMemo(() => {
    const errors = {};
    operations.forEach((op) => {
      const opErrors = validateOperation(op.type, op.params || {});

      if (op.type === "feeBump" && operations.length > 1) {
        opErrors.push("Fee bump must be a standalone transaction.");
      }

      if (opErrors.length > 0) {
        errors[op.id] = opErrors;
      }
    });
    return errors;
  }, [operations]);

  const feeBumpOnly = operations.length === 1 && operations[0].type === "feeBump";
  const canSimulate = operations.length > 0 && Object.keys(validationErrors).length === 0 && (sourceAccount || feeBumpOnly);
  
  async function handleSimulate() {
    if (!canSimulate) return;
    
    setIsSimulating(true);
    setSimulation(null);
    
    try {
      const result = await simulateTransaction({
        sourceAccount,
        operations: operations.map(({ id, ...op }) => op),
        memo,
        memoType,
        baseFee: parseInt(baseFee),
        timeout: parseInt(timeout),
        network
      });
      setSimulation(result);
    } catch (error) {
      setSimulation({
        success: false,
        errors: [error.message],
        fee: 0,
        operationCount: operations.length
      });
    } finally {
      setIsSimulating(false);
    }
  }
  
  async function handleExportXDR() {
    try {
      const transaction = await buildTransaction({
        sourceAccount,
        operations: operations.map(({ id, ...op }) => op),
        memo,
        memoType,
        baseFee: parseInt(baseFee),
        timeout: parseInt(timeout),
        network
      });
      const xdr = transaction.toXDR();
      await navigator.clipboard.writeText(xdr);
      alert("Transaction XDR copied to clipboard!");
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  }

  async function handleSaveAsTemplate() {
    const label = window.prompt("Template name (will be shown in command palette):", "My Template");
    if (!label) return;

    const passphrase = window.prompt("Password to encrypt and store templates (not saved):");
    if (!passphrase) return;

    const template = {
      id: `user_tpl_${Date.now()}`,
      label,
      description: `Saved from Transaction Builder (${new Date().toLocaleString()})`,
      operations: operations.map((op) => ({ type: op.type, params: op.params })),
      memo,
      memoType,
    };

    try {
      await upsertUserTransactionTemplate(passphrase, template);
      window.alert("Template saved (encrypted). You can export it from Contract Templates → Transaction Templates.");
    } catch (error) {
      window.alert(`Save failed: ${error.message}`);
    }
  }

  function renderOperationFields(op) {
    const hasErrors = validationErrors[op.id];
    
    switch (op.type) {
      case "payment":
        return (
          <>
            <LabeledField label="Destination">
              <input
                value={op.params.destination || ""}
                onChange={(e) =>
                  updateOperation(op.id, "destination", e.target.value)
                }
                placeholder="G... destination address"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Amount">
              <input
                value={op.params.amount || ""}
                onChange={(e) =>
                  updateOperation(op.id, "amount", e.target.value)
                }
                placeholder="10.5"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
          </>
        );

      case "createAccount":
        return (
          <>
            <LabeledField label="Destination">
              <input
                value={op.params.destination || ""}
                onChange={(e) =>
                  updateOperation(op.id, "destination", e.target.value)
                }
                placeholder="G... new account address"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Starting Balance">
              <input
                value={op.params.startingBalance || ""}
                onChange={(e) =>
                  updateOperation(op.id, "startingBalance", e.target.value)
                }
                placeholder="1.5"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
          </>
        );

      case "changeTrust":
        return (
          <>
            <LabeledField label="Asset Code">
              <input
                value={op.params.assetCode || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetCode", e.target.value)
                }
                placeholder="USDC"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Asset Issuer">
              <input
                value={op.params.assetIssuer || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetIssuer", e.target.value)
                }
                placeholder="G... issuer address"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Limit (optional)">
              <input
                value={op.params.limit || ""}
                onChange={(e) =>
                  updateOperation(op.id, "limit", e.target.value)
                }
                placeholder="Max trustline limit"
                style={textInputStyle()}
              />
            </LabeledField>
          </>
        );

      case "accountMerge":
        return (
          <LabeledField label="Destination">
            <input
              value={op.params.destination || ""}
              onChange={(e) =>
                updateOperation(op.id, "destination", e.target.value)
              }
              placeholder="G... merge destination"
              style={textInputStyle(hasErrors)}
            />
          </LabeledField>
        );

      case "manageData":
        return (
          <>
            <LabeledField label="Data Name">
              <input
                value={op.params.name || ""}
                onChange={(e) => updateOperation(op.id, "name", e.target.value)}
                placeholder="key"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Data Value">
              <input
                value={op.params.value || ""}
                onChange={(e) =>
                  updateOperation(op.id, "value", e.target.value)
                }
                placeholder="value (leave empty to delete)"
                style={textInputStyle()}
              />
            </LabeledField>
          </>
        );
        
      case "manageSellOffer":
      case "manageBuyOffer":
        return (
          <>
            <LabeledField label="Selling Asset Type">
              <select
                value={op.params.sellingAssetType || "native"}
                onChange={(e) => updateOperation(op.id, "sellingAssetType", e.target.value)}
                style={textInputStyle()}
              >
                <option value="native">XLM (native)</option>
                <option value="credit">Credit Asset</option>
              </select>
            </LabeledField>
            {op.params.sellingAssetType === "credit" && (
              <>
                <LabeledField label="Selling Asset Code">
                  <input
                    value={op.params.sellingAssetCode || ""}
                    onChange={(e) => updateOperation(op.id, "sellingAssetCode", e.target.value)}
                    placeholder="USDC"
                    style={textInputStyle()}
                  />
                </LabeledField>
                <LabeledField label="Selling Asset Issuer">
                  <input
                    value={op.params.sellingAssetIssuer || ""}
                    onChange={(e) => updateOperation(op.id, "sellingAssetIssuer", e.target.value)}
                    placeholder="G..."
                    style={textInputStyle()}
                  />
                </LabeledField>
              </>
            )}
            <LabeledField label="Buying Asset Type">
              <select
                value={op.params.buyingAssetType || "native"}
                onChange={(e) => updateOperation(op.id, "buyingAssetType", e.target.value)}
                style={textInputStyle()}
              >
                <option value="native">XLM (native)</option>
                <option value="credit">Credit Asset</option>
              </select>
            </LabeledField>
            {op.params.buyingAssetType === "credit" && (
              <>
                <LabeledField label="Buying Asset Code">
                  <input
                    value={op.params.buyingAssetCode || ""}
                    onChange={(e) => updateOperation(op.id, "buyingAssetCode", e.target.value)}
                    placeholder="USDC"
                    style={textInputStyle()}
                  />
                </LabeledField>
                <LabeledField label="Buying Asset Issuer">
                  <input
                    value={op.params.buyingAssetIssuer || ""}
                    onChange={(e) => updateOperation(op.id, "buyingAssetIssuer", e.target.value)}
                    placeholder="G..."
                    style={textInputStyle()}
                  />
                </LabeledField>
              </>
            )}
            <LabeledField label={op.type === "manageSellOffer" ? "Amount" : "Buy Amount"}>
              <input
                value={op.type === "manageSellOffer" ? (op.params.amount || "") : (op.params.buyAmount || "")}
                onChange={(e) => updateOperation(op.id, op.type === "manageSellOffer" ? "amount" : "buyAmount", e.target.value)}
                placeholder="100"
                style={textInputStyle()}
              />
            </LabeledField>
            <LabeledField label="Price">
              <input
                value={op.params.price || ""}
                onChange={(e) => updateOperation(op.id, "price", e.target.value)}
                placeholder="1.5"
                style={textInputStyle()}
              />
            </LabeledField>
          </>
        );

      case "feeBump":
        return (
          <>
            <LabeledField label="Fee Source Account">
              <input
                value={op.params.feeSource || ""}
                onChange={(e) =>
                  updateOperation(op.id, "feeSource", e.target.value)
                }
                placeholder="G... account paying fee-bump fee"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Base Fee (stroops)">
              <input
                type="number"
                value={op.params.baseFee || ""}
                onChange={(e) =>
                  updateOperation(op.id, "baseFee", e.target.value)
                }
                placeholder="100"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Inner Transaction XDR">
              <textarea
                value={op.params.innerTransaction || ""}
                onChange={(e) =>
                  updateOperation(op.id, "innerTransaction", e.target.value)
                }
                placeholder="Paste the signed inner transaction XDR envelope here"
                style={{
                  ...textInputStyle(hasErrors),
                  minHeight: "100px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  resize: "vertical",
                }}
              />
            </LabeledField>
          </>
        );

      case "beginSponsoringFutureReserves":
        return (
          <LabeledField label="Sponsored Account ID">
            <input
              value={op.params.sponsoredId || ""}
              onChange={(e) =>
                updateOperation(op.id, "sponsoredId", e.target.value)
              }
              placeholder="G... account to be sponsored"
              style={textInputStyle(hasErrors)}
            />
          </LabeledField>
        );

      case "endSponsoringFutureReserves":
        return (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px", background: "var(--bg-base)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            This operation has no required parameters. The account calling this operation ends its own sponsorship.
          </div>
        );

      case "clawback":
        return (
          <>
            <LabeledField label="Asset Code">
              <input
                value={op.params.assetCode || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetCode", e.target.value)
                }
                placeholder="USDC"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Asset Issuer">
              <input
                value={op.params.assetIssuer || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetIssuer", e.target.value)
                }
                placeholder="G... issuer address"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="From Account">
              <input
                value={op.params.from || ""}
                onChange={(e) =>
                  updateOperation(op.id, "from", e.target.value)
                }
                placeholder="G... account to claw back from"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label="Amount">
              <input
                value={op.params.amount || ""}
                onChange={(e) =>
                  updateOperation(op.id, "amount", e.target.value)
                }
                placeholder="10.5"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
          </>
        );

      default:
        return (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Configure operation parameters
          </div>
        );
    }
  }

  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "22px", fontWeight: 700 }}>
            Advanced Transaction Builder
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            Build, simulate, and export Stellar transactions with visual flow
          </div>
        </div>
        <div style={{
          padding: "6px 12px",
          background: network === "testnet" ? "var(--amber-glow)" : "var(--green-glow)",
          border: `1px solid ${network === "testnet" ? "var(--amber)" : "var(--green)"}`,
          borderRadius: "var(--radius-sm)",
          fontSize: "11px",
          color: network === "testnet" ? "var(--amber)" : "var(--green)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "1px",
        }}>
          {network}
        </div>
      </div>

      {/* Quick Templates */}
      <Panel title="Quick Start Templates" subtitle="Load pre-configured operation sequences">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          {availableTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => loadTemplate(template.id)}
              style={{
                padding: "14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "var(--transition)",
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cyan-dim)"; e.currentTarget.style.background = "var(--bg-hover)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-elevated)" }}
            >
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                <Zap size={14} style={{ display: "inline", marginRight: "6px", color: "var(--cyan)" }} />
                {template.label || template.name || template.id}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                {template.description}
              </div>
            </button>
          ))}
        </div>
      </Panel>

      {/* Transaction Settings */}
      <Panel title="Transaction Settings" subtitle="Configure source account and transaction parameters">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          <LabeledField label="Source Account">
            <input
              value={sourceAccount}
              onChange={(e) => setSourceAccount(e.target.value)}
              placeholder={connectedAddress || "G... source account"}
              style={textInputStyle(!sourceAccount && !feeBumpOnly)}
            />
            {feeBumpOnly && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                Source account is optional for fee-bump transactions. The fee source account is defined in the fee bump operation.
              </div>
            )}
          </LabeledField>

          <LabeledField label="Base Fee (stroops)">
            <input
              type="number"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              placeholder="100"
              style={textInputStyle()}
            />
          </LabeledField>

          <LabeledField label="Timeout (seconds)">
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              placeholder="180"
              style={textInputStyle()}
            />
          </LabeledField>

          <LabeledField label="Memo Type">
            <select
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
              style={textInputStyle()}
            >
              <option value="text">Text</option>
              <option value="id">ID</option>
              <option value="hash">Hash</option>
              <option value="return">Return</option>
            </select>
          </LabeledField>

          <LabeledField label="Memo">
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional memo"
              style={textInputStyle()}
            />
          </LabeledField>
        </div>
      </Panel>

      {/* Visual Flow Diagram */}
      {operations.length > 0 && (
        <Panel title="Transaction Flow" subtitle="Visual representation of operation sequence">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
            <div style={{
              padding: "10px 16px",
              background: "var(--cyan-glow)",
              border: "1px solid var(--cyan-dim)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--cyan)",
              fontWeight: 600,
            }}>
              SOURCE: {sourceAccount ? `${sourceAccount.slice(0, 8)}...${sourceAccount.slice(-8)}` : "Not set"}
            </div>
            
            {operations.map((op, index) => (
              <React.Fragment key={op.id}>
                <ArrowDown size={20} style={{ color: "var(--text-muted)" }} />
                <div style={{
                  padding: "10px 16px",
                  background: validationErrors[op.id] ? "var(--red-glow)" : "var(--bg-elevated)",
                  border: `1px solid ${validationErrors[op.id] ? "var(--red)" : "var(--border-bright)"}`,
                  borderRadius: "var(--radius-md)",
                  fontSize: "12px",
                  minWidth: "200px",
                  textAlign: "center",
                }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                    {index + 1}. {OPERATION_TYPES.find(t => t.value === op.type)?.label || op.type}
                  </div>
                  {validationErrors[op.id] && (
                    <div style={{ fontSize: "10px", color: "var(--red)" }}>
                      {validationErrors[op.id].join(", ")}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}
            
            <ArrowDown size={20} style={{ color: "var(--text-muted)" }} />
            <div style={{
              padding: "10px 16px",
              background: "var(--green-glow)",
              border: "1px solid var(--green)",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--green)",
              fontWeight: 600,
            }}>
              SUBMIT TO NETWORK
            </div>
          </div>
        </Panel>
      )}

      {/* Operations */}
      <Panel title={`Operations (${operations.length})`} subtitle="Drag to reorder • Click to configure">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {operations.map((op, index) => (
            <div
              key={op.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                background: draggedIndex === index ? "var(--bg-hover)" : "var(--bg-elevated)",
                border: `1px solid ${validationErrors[op.id] ? "var(--red)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                padding: "16px",
                cursor: "grab",
                transition: "var(--transition)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <GripVertical size={16} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                    Operation {index + 1}
                  </span>
                  {validationErrors[op.id] && (
                    <AlertCircle size={14} style={{ color: "var(--red)" }} />
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => duplicateOperation(op.id)}
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                    title="Duplicate operation"
                  >
                    <Copy size={12} />
                    Duplicate
                  </button>
                  <button
                    onClick={() => removeOperation(op.id)}
                    disabled={operations.length === 1}
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: operations.length === 1 ? "var(--text-muted)" : "var(--red)",
                      fontSize: "11px",
                      cursor: operations.length === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      opacity: operations.length === 1 ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={12} />
                    Remove
                  </button>
                </div>
              </div>

              {validationErrors[op.id] && (
                <div style={{
                  padding: "8px 12px",
                  background: "var(--red-glow)",
                  border: "1px solid var(--red)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "11px",
                  color: "var(--red)",
                  marginBottom: "12px",
                }}>
                  {validationErrors[op.id].map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <LabeledField label="Operation Type">
                  <select
                    value={op.type}
                    onChange={(e) => updateOperation(op.id, "type", e.target.value)}
                    style={textInputStyle()}
                  >
                    {OPERATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>

                {renderOperationFields(op)}
              </div>
            </div>
          ))}

          <button
            onClick={addOperation}
            style={{
              padding: "12px",
              background: "transparent",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-md)",
              color: "var(--text-secondary)",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "var(--transition)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cyan)"; e.currentTarget.style.color = "var(--cyan)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text-secondary)" }}
          >
            <Plus size={16} />
            Add Operation
          </button>
        </div>
      </Panel>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          onClick={handleSimulate}
          disabled={!canSimulate || isSimulating}
          style={{
            padding: "12px 20px",
            background: canSimulate && !isSimulating ? "var(--cyan)" : "var(--bg-elevated)",
            color: canSimulate && !isSimulating ? "var(--bg-base)" : "var(--text-muted)",
            border: canSimulate && !isSimulating ? "none" : "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: canSimulate && !isSimulating ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "var(--transition)",
          }}
        >
          {isSimulating ? (
            <>
              <div className="spinner" />
              Simulating...
            </>
          ) : (
            <>
              <Play size={16} />
              Simulate Transaction
            </>
          )}
        </button>

        <button
          onClick={handleExportXDR}
          disabled={!canSimulate}
          style={{
            padding: "12px 20px",
            background: "var(--bg-elevated)",
            color: canSimulate ? "var(--text-primary)" : "var(--text-muted)",
            border: "1px solid var(--border-bright)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: canSimulate ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "var(--transition)",
          }}
        >
          <Download size={16} />
          Export XDR
        </button>

        <button
          onClick={handleSaveAsTemplate}
          disabled={!operations?.length}
          style={{
            padding: "12px 20px",
            background: "transparent",
            color: operations?.length ? "var(--text-secondary)" : "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: operations?.length ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "var(--transition)",
          }}
        >
          <Zap size={16} />
          Save as Template
        </button>
      </div>

      {/* Simulation Results */}
      {simulation && (
        <Panel
          title="Simulation Results"
          subtitle={simulation.success ? "Transaction is valid and ready to submit" : "Transaction validation failed"}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Status Banner */}
            <div style={{
              padding: "14px 18px",
              background: simulation.success ? "var(--green-glow)" : "var(--red-glow)",
              border: `1px solid ${simulation.success ? "var(--green)" : "var(--red)"}`,
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}>
              {simulation.success ? (
                <CheckCircle size={20} style={{ color: "var(--green)" }} />
              ) : (
                <AlertCircle size={20} style={{ color: "var(--red)" }} />
              )}
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: simulation.success ? "var(--green)" : "var(--red)" }}>
                  {simulation.success ? "Simulation Successful" : "Simulation Failed"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {simulation.success
                    ? "Transaction passed all validation checks"
                    : `${simulation.errors.length} error${simulation.errors.length !== 1 ? "s" : ""} found`}
                </div>
              </div>
            </div>

            {/* Fee Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <div style={{
                padding: "14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Estimated Fee
                </div>
                <div style={{ fontSize: "20px", fontFamily: "var(--font-mono)", color: "var(--cyan)", fontWeight: 700 }}>
                  {simulation.fee.toLocaleString()}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  stroops ({(simulation.fee / 10000000).toFixed(7)} XLM)
                </div>
              </div>

              <div style={{
                padding: "14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Operations
                </div>
                <div style={{ fontSize: "20px", fontFamily: "var(--font-mono)", color: "var(--amber)", fontWeight: 700 }}>
                  {simulation.operationCount}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {baseFee} stroops per op
                </div>
              </div>

              {simulation.hash && (
                <div style={{
                  padding: "14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                    Transaction Hash
                  </div>
                  <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-primary)", wordBreak: "break-all" }}>
                    {simulation.hash.slice(0, 16)}...
                  </div>
                </div>
              )}
            </div>

            {/* Errors */}
            {simulation.errors && simulation.errors.length > 0 && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--red)", marginBottom: "8px" }}>
                  Validation Errors:
                </div>
                {simulation.errors.map((error, index) => (
                  <div key={index} style={{
                    padding: "10px 14px",
                    background: "var(--red-glow)",
                    border: "1px solid var(--red)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    color: "var(--red)",
                    marginBottom: "6px",
                    fontFamily: "var(--font-mono)",
                  }}>
                    • {error}
                  </div>
                ))}
              </div>
            )}

            {/* XDR Preview */}
            {simulation.xdr && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Transaction XDR
                  </div>
                  <button
                    onClick={() => setShowXDR(!showXDR)}
                    style={{
                      padding: "4px 10px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {showXDR ? "Hide" : "Show"} XDR
                  </button>
                </div>
                {showXDR && (
                  <div style={{
                    padding: "14px",
                    background: "var(--bg-base)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-secondary)",
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}>
                    {simulation.xdr}
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
