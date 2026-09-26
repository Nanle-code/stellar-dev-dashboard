import React, { useState, useMemo, useEffect, useRef } from "react";
import { useStore } from "../../lib/store";
import { OPERATION_TYPES, simulateTransaction, buildTransaction } from "../../lib/transactionBuilder";
import { validateOperation } from "../../utils/transactionValidation";
import { TRANSACTION_TEMPLATES } from "../../lib/transactionTemplates.js";
import {
  getCachedUserTransactionTemplates,
  upsertUserTransactionTemplate,
} from "../../lib/transactionTemplateVault.ts";
import { fetchContractData, checkDestinationMemoRequirement } from "../../lib/stellar";
import { validateMemo } from "../../lib/validation";
import { fetchContractData, resolveFederatedAddress } from "../../lib/stellar";
import { useTransactionHistory } from "../../lib/txHistory";
import { Copy, Play, Download, AlertCircle, CheckCircle, ArrowDown, GripVertical, Trash2, Plus, Zap } from "lucide-react";
import { useExpertise } from "../../context/ExpertiseContext";
import { useTranslation } from "react-i18next";

function FederatedAddressInput({ value, onChange, placeholder, style, network, hasError }) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const [resolvedData, setResolvedData] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (value !== inputValue && !confirmed) {
      setInputValue(value || "");
      setConfirmed(false);
      setResolvedData(null);
      setError(null);
    }
  }, [value]);

  async function handleResolve(e) {
    e.preventDefault();
    if (!inputValue.includes('*')) return;
    setIsResolving(true);
    setError(null);
    try {
      const result = await resolveFederatedAddress(inputValue, network);
      if (result && (result.account_id || result.accountId)) {
        setResolvedData(result);
      } else {
        setError(t("builder.federatedResolution.couldNotResolve"));
      }
    } catch (e) {
      setError(e.message || t("builder.federatedResolution.resolutionFailed"));
    } finally {
      setIsResolving(false);
    }
  }

  function handleConfirm(e) {
    e.preventDefault();
    if (resolvedData) {
      setConfirmed(true);
      const address = resolvedData.account_id || resolvedData.accountId;
      onChange(address);
      setInputValue(address);
      setResolvedData(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input 
          value={inputValue}
          onChange={(e) => {
             setInputValue(e.target.value);
             setConfirmed(false);
             setResolvedData(null);
             setError(null);
             onChange(e.target.value);
          }}
          placeholder={placeholder}
          style={{ ...style, flex: 1, ...(hasError ? { borderColor: 'var(--red)' } : {}) }}
        />
        {inputValue.includes('*') && !confirmed && !resolvedData && (
          <button onClick={handleResolve} disabled={isResolving} style={{ padding: '0 12px', borderRadius: '4px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '12px', cursor: 'pointer' }}>
            {isResolving ? '...' : t("builder.federatedResolution.resolve")}
          </button>
        )}
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: '11px' }}>{error}</div>}
      {resolvedData && !confirmed && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--cyan)', padding: '8px', borderRadius: '4px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>{t("builder.federatedResolution.resolved")} </span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{resolvedData.account_id || resolvedData.accountId}</span>
          </div>
          <button onClick={handleConfirm} style={{ background: 'var(--cyan)', color: 'var(--bg-base)', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {t("builder.federatedResolution.confirm")}
          </button>
        </div>
      )}
    </div>
  );
}

function TimeboundsPreset({ timeout, setTimeout }) {
  const absoluteTime = useMemo(() => {
    const s = parseInt(timeout);
    if (isNaN(s)) return null;
    return new Date(Date.now() + s * 1000);
  }, [timeout]);

  const isExpired = absoluteTime ? absoluteTime.getTime() <= Date.now() : false;
  const isTooShort = absoluteTime ? absoluteTime.getTime() <= Date.now() + 60000 : false; // < 1 min warning

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {[
          { label: '5m', val: '300' },
          { label: '15m', val: '900' },
          { label: '1h', val: '3600' },
          { label: '1d', val: '86400' },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => setTimeout(preset.val)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '4px',
              border: timeout === preset.val ? '1px solid var(--cyan)' : '1px solid var(--border)',
              background: timeout === preset.val ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
              color: timeout === preset.val ? 'var(--cyan)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {absoluteTime && (
        <div style={{ 
          fontSize: '11px', 
          color: isExpired || isTooShort ? 'var(--red)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isExpired || isTooShort ? <AlertCircle size={12} /> : null}
          Expires at {absoluteTime.toLocaleTimeString()} {isExpired ? '(Expired)' : isTooShort ? '(Too short!)' : ''}
        </div>
      )}
    </div>
  );
}


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
  const { t } = useTranslation();
  const { connectedAddress, network, selectedTemplateId, setSelectedTemplateId } = useStore();
  const { isNovice, isExpert, updateSignals } = useExpertise();
  const availableTemplates = useMemo(() => getAllTransactionTemplates(), [selectedTemplateId]);

  const [sourceAccount, setSourceAccount] = useState(connectedAddress || "");
  const [memo, setMemo] = useState("");
  const [memoType, setMemoType] = useState("text");
  const [baseFee, setBaseFee] = useState("100");
  const [timeout, setTimeout] = useState("300");
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
  const [inspectContractId, setInspectContractId] = useState("");
  const [inspectContractKey, setInspectContractKey] = useState("");
  const [inspectContractData, setInspectContractData] = useState(null);
  const [inspectContractLoading, setInspectContractLoading] = useState(false);
  const [inspectContractError, setInspectContractError] = useState("");
  const [showDraftsPanel, setShowDraftsPanel] = useState(false);
  const [draftsList, setDraftsList] = useState([]);
  const [memoRequirement, setMemoRequirement] = useState({ checking: false, required: false, error: null, destination: null });

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

  useEffect(() => {
    if (simulation?.success) {
      updateSignals((current) => ({ successfulActions: current.successfulActions + 1 }));
    }
  }, [simulation, updateSignals]);

  async function handleFetchContractData() {
    if (!inspectContractId.trim()) return;

    updateSignals((current) => ({ advancedFeatureUses: current.advancedFeatureUses + 1 }));
    setInspectContractError("");
    setInspectContractData(null);
    setInspectContractLoading(true);

    try {
      const data = await fetchContractData(
        inspectContractId,
        inspectContractKey,
        network
      );
      setInspectContractData(data);
    } catch (error) {
      setInspectContractError(error.message || "Failed to fetch contract data");
    } finally {
      setInspectContractLoading(false);
    }
  }
  
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

  const memoValidation = useMemo(() => validateMemo(memo, memoType), [memo, memoType]);

  // First payment-style destination in the operation list, used for the
  // SEP-29 "memo required" destination check below.
  const primaryDestination = useMemo(() => {
    const op = operations.find(
      (o) => ["payment", "pathPaymentStrictSend", "pathPaymentStrictReceive", "accountMerge"].includes(o.type) && o.params?.destination,
    );
    return op?.params?.destination || "";
  }, [operations]);

  useEffect(() => {
    let cancelled = false;
    if (!primaryDestination || !primaryDestination.trim()) {
      setMemoRequirement({ checking: false, required: false, error: null, destination: null });
      return;
    }

    setMemoRequirement((current) => ({ ...current, checking: true }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await checkDestinationMemoRequirement(primaryDestination.trim(), network);
        if (cancelled) return;
        setMemoRequirement({
          checking: false,
          required: Boolean(result.checked && result.required),
          error: result.checked ? null : result.error || "Unable to verify this destination's memo requirement.",
          destination: primaryDestination.trim(),
        });
      } catch (error) {
        if (cancelled) return;
        setMemoRequirement({
          checking: false,
          required: false,
          error: error?.message || "Unable to verify this destination's memo requirement.",
          destination: primaryDestination.trim(),
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [primaryDestination, network]);

  const memoRequiredWarning = memoRequirement.required && !memo;

  const feeBumpOnly = operations.length === 1 && operations[0].type === "feeBump";
  const canSimulate = operations.length > 0 && Object.keys(validationErrors).length === 0 && memoValidation.valid && (sourceAccount || feeBumpOnly);
  
  // Transaction history (undo/redo) + drafts
  const getSnapshot = () => ({
    sourceAccount,
    memo,
    memoType,
    baseFee,
    timeout,
    operations,
  });

  function applySnapshot(snap) {
    setSourceAccount(snap.sourceAccount || "");
    setMemo(snap.memo || "");
    setMemoType(snap.memoType || "text");
    setBaseFee(snap.baseFee || "100");
    setTimeout(snap.timeout || "300");
    setOperations((snap.operations || []).map((op) => ({ ...op, id: op.id || Date.now() + Math.random() })));
  }

  const historyRef = useRef<any>(null);
  if (!historyRef.current) {
    historyRef.current = useTransactionHistory({ initialSnapshot: getSnapshot(), onRestore: applySnapshot });
  }
  const txHistory = historyRef.current;

  useEffect(() => {
    try {
      txHistory.record(getSnapshot());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAccount, memo, memoType, baseFee, timeout, operations]);
  
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
      alert(t("builder.xdrCopied"));
    } catch (error) {
      alert(t("builder.exportFailed", { message: error.message }));
    }
  }

  async function handleSaveAsTemplate() {
    const label = window.prompt(t("builder.templateNamePrompt"), "My Template");
    if (!label) return;

    const passphrase = window.prompt(t("builder.templatePassphrasePrompt"));
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
      window.alert(t("builder.templateSaved"));
    } catch (error) {
      window.alert(t("builder.templateSaveFailed", { message: error.message }));
    }
  }

  function renderOperationFields(op) {
    const hasErrors = validationErrors[op.id];
    
    switch (op.type) {
      case "payment":
        return (
          <>
            <LabeledField label={t("builder.operationFields.destination")}>
              <FederatedAddressInput
                value={op.params.destination || ""}
                onChange={(val) =>
                  updateOperation(op.id, "destination", val)
                }
                placeholder={t("builder.operationFields.destinationPaymentPlaceholder")}
                style={textInputStyle(hasErrors)}
                network={network}
                hasError={hasErrors}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.amount")}>
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
            <LabeledField label={t("builder.operationFields.destination")}>
              <FederatedAddressInput
                value={op.params.destination || ""}
                onChange={(val) =>
                  updateOperation(op.id, "destination", val)
                }
                placeholder={t("builder.operationFields.destinationPaymentPlaceholder")}
                style={textInputStyle(hasErrors)}
                network={network}
                hasError={hasErrors}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.startingBalance")}>
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
            <LabeledField label={t("builder.operationFields.assetCode")}>
              <input
                value={op.params.assetCode || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetCode", e.target.value)
                }
                placeholder="USDC"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.assetIssuer")}>
              <FederatedAddressInput
                value={op.params.assetIssuer || ""}
                onChange={(val) =>
                  updateOperation(op.id, "assetIssuer", val)
                }
                placeholder={t("builder.operationFields.assetIssuerPlaceholder")}
                style={textInputStyle(hasErrors)}
                network={network}
                hasError={hasErrors}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.limit")}>
              <input
                value={op.params.limit || ""}
                onChange={(e) =>
                  updateOperation(op.id, "limit", e.target.value)
                }
                placeholder={t("builder.operationFields.limitPlaceholder")}
                style={textInputStyle()}
              />
            </LabeledField>
          </>
        );

      case "accountMerge":
        return (
          <LabeledField label={t("builder.operationFields.destination")}>
            <FederatedAddressInput
              value={op.params.destination || ""}
              onChange={(val) =>
                updateOperation(op.id, "destination", val)
              }
              placeholder={t("builder.operationFields.destinationPaymentPlaceholder")}
              style={textInputStyle(hasErrors)}
              network={network}
              hasError={hasErrors}
            />
          </LabeledField>
        );

      case "manageData":
        return (
          <>
            <LabeledField label={t("builder.operationFields.dataName")}>
              <input
                value={op.params.name || ""}
                onChange={(e) => updateOperation(op.id, "name", e.target.value)}
                placeholder="key"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.dataValue")}>
              <input
                value={op.params.value || ""}
                onChange={(e) =>
                  updateOperation(op.id, "value", e.target.value)
                }
                placeholder={t("builder.operationFields.dataValuePlaceholder")}
                style={textInputStyle()}
              />
            </LabeledField>
          </>
        );
        
      case "manageSellOffer":
      case "manageBuyOffer":
        return (
          <>
            <LabeledField label={t("builder.operationFields.sellingAssetType")}>
              <select
                value={op.params.sellingAssetType || "native"}
                onChange={(e) => updateOperation(op.id, "sellingAssetType", e.target.value)}
                style={textInputStyle()}
              >
                <option value="native">{t("builder.operationFields.assetTypeNative")}</option>
                <option value="credit">{t("builder.operationFields.assetTypeCredit")}</option>
              </select>
            </LabeledField>
            {op.params.sellingAssetType === "credit" && (
              <>
                <LabeledField label={t("builder.operationFields.sellingAssetCode")}>
                  <input
                    value={op.params.sellingAssetCode || ""}
                    onChange={(e) => updateOperation(op.id, "sellingAssetCode", e.target.value)}
                    placeholder="USDC"
                    style={textInputStyle()}
                  />
                </LabeledField>
                <LabeledField label={t("builder.operationFields.sellingAssetIssuer")}>
                  <input
                    value={op.params.sellingAssetIssuer || ""}
                    onChange={(e) => updateOperation(op.id, "sellingAssetIssuer", e.target.value)}
                    placeholder="G..."
                    style={textInputStyle()}
                  />
                </LabeledField>
              </>
            )}
            <LabeledField label={t("builder.operationFields.buyingAssetType")}>
              <select
                value={op.params.buyingAssetType || "native"}
                onChange={(e) => updateOperation(op.id, "buyingAssetType", e.target.value)}
                style={textInputStyle()}
              >
                <option value="native">{t("builder.operationFields.assetTypeNative")}</option>
                <option value="credit">{t("builder.operationFields.assetTypeCredit")}</option>
              </select>
            </LabeledField>
            {op.params.buyingAssetType === "credit" && (
              <>
                <LabeledField label={t("builder.operationFields.buyingAssetCode")}>
                  <input
                    value={op.params.buyingAssetCode || ""}
                    onChange={(e) => updateOperation(op.id, "buyingAssetCode", e.target.value)}
                    placeholder="USDC"
                    style={textInputStyle()}
                  />
                </LabeledField>
                <LabeledField label={t("builder.operationFields.buyingAssetIssuer")}>
                  <input
                    value={op.params.buyingAssetIssuer || ""}
                    onChange={(e) => updateOperation(op.id, "buyingAssetIssuer", e.target.value)}
                    placeholder="G..."
                    style={textInputStyle()}
                  />
                </LabeledField>
              </>
            )}
            <LabeledField label={op.type === "manageSellOffer" ? t("builder.operationFields.amount") : t("builder.operationFields.buyAmount")}>
              <input
                value={op.type === "manageSellOffer" ? (op.params.amount || "") : (op.params.buyAmount || "")}
                onChange={(e) => updateOperation(op.id, op.type === "manageSellOffer" ? "amount" : "buyAmount", e.target.value)}
                placeholder="100"
                style={textInputStyle()}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.price")}>
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
            <LabeledField label={t("builder.operationFields.feeSourceAccount")}>
              <input
                value={op.params.feeSource || ""}
                onChange={(e) =>
                  updateOperation(op.id, "feeSource", e.target.value)
                }
                placeholder={t("builder.operationFields.feeSourcePlaceholder")}
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.baseFee")}>
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
            <LabeledField label={t("builder.operationFields.innerTransactionXdr")}>
              <textarea
                value={op.params.innerTransaction || ""}
                onChange={(e) =>
                  updateOperation(op.id, "innerTransaction", e.target.value)
                }
                placeholder={t("builder.operationFields.innerTransactionPlaceholder")}
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
          <LabeledField label={t("builder.operationFields.sponsoredAccountId")}>
            <input
              value={op.params.sponsoredId || ""}
              onChange={(e) =>
                updateOperation(op.id, "sponsoredId", e.target.value)
              }
              placeholder={t("builder.operationFields.sponsoredIdPlaceholder")}
              style={textInputStyle(hasErrors)}
            />
          </LabeledField>
        );

      case "endSponsoringFutureReserves":
        return (
          <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px", background: "var(--bg-base)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            {t("builder.operationFields.endSponsoringNoParams")}
          </div>
        );

      case "clawback":
        return (
          <>
            <LabeledField label={t("builder.operationFields.assetCode")}>
              <input
                value={op.params.assetCode || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetCode", e.target.value)
                }
                placeholder="USDC"
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.assetIssuer")}>
              <input
                value={op.params.assetIssuer || ""}
                onChange={(e) =>
                  updateOperation(op.id, "assetIssuer", e.target.value)
                }
                placeholder={t("builder.operationFields.assetIssuerPlaceholder")}
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.fromAccount")}>
              <input
                value={op.params.from || ""}
                onChange={(e) =>
                  updateOperation(op.id, "from", e.target.value)
                }
                placeholder={t("builder.operationFields.fromPlaceholder")}
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.amount")}>
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

      case "invokeHostFunction": {
        const args = op.params.args || [];
        return (
          <>
            <LabeledField label={t("builder.contractId")}>
              <input
                value={op.params.contractId || ""}
                onChange={(e) =>
                  updateOperation(op.id, "contractId", e.target.value)
                }
                placeholder={t("builder.contractIdPlaceholder")}
                style={textInputStyle(hasErrors)}
              />
            </LabeledField>
            <LabeledField label={t("builder.operationFields.functionName")}>
              <input
                value={op.params.functionName || ""}
                onChange={(e) =>
                  updateOperation(op.id, "functionName", e.target.value)
                }
                placeholder="increment"
                style={textInputStyle()}
              />
            </LabeledField>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <LabeledField label={t("builder.operationFields.arguments")} style={{ marginBottom: 0 }}>
                </LabeledField>
                <button
                  onClick={() => {
                    const newArgs = [...args, { type: "string", value: "" }];
                    updateOperation(op.id, "args", newArgs);
                  }}
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    border: "1px dashed var(--border-bright)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {t("builder.operationFields.addArgument")}
                </button>
              </div>
              {args.map((arg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr auto",
                    gap: "8px",
                    alignItems: "center",
                    marginTop: "8px",
                  }}
                >
                  <select
                    value={arg.type}
                    onChange={(e) => {
                      const newArgs = [...args];
                      newArgs[idx] = { ...arg, type: e.target.value };
                      updateOperation(op.id, "args", newArgs);
                    }}
                    style={textInputStyle()}
                  >
                    <option value="string">String</option>
                    <option value="int">Int</option>
                    <option value="address">Address</option>
                    <option value="bool">Bool</option>
                  </select>
                  <input
                    value={arg.value}
                    onChange={(e) => {
                      const newArgs = [...args];
                      newArgs[idx] = { ...arg, value: e.target.value };
                      updateOperation(op.id, "args", newArgs);
                    }}
                    placeholder={arg.type === "bool" ? t("builder.operationFields.boolPlaceholder") : t("builder.operationFields.argumentValuePlaceholder")}
                    style={textInputStyle()}
                  />
                  <button
                    onClick={() => {
                      const newArgs = args.filter((_, i) => i !== idx);
                      updateOperation(op.id, "args", newArgs);
                    }}
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--red)",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                    disabled={args.length === 0}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        );
      }

      default:
        return (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {t("builder.operationFields.configureParameters")}
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
            {isNovice ? t("builder.title") : t("builder.titleAdvanced")}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {isNovice ? t("builder.subtitleNovice") : t("builder.subtitleExpert")}
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
      <Panel title={t("builder.quickStartTemplates")} subtitle={t("builder.quickStartTemplatesSubtitle")}>
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

      {!isNovice && (
        <Panel title={t("builder.contractStateInspection")} subtitle={t("builder.contractStateInspectionSubtitle")}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <LabeledField label={t("builder.contractId")}>
              <input
                value={inspectContractId}
                onChange={(e) => setInspectContractId(e.target.value)}
                placeholder={t("builder.contractIdPlaceholder")}
                style={textInputStyle()}
              />
            </LabeledField>
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <LabeledField label={t("builder.storageKey")}>
              <input
                value={inspectContractKey}
                onChange={(e) => setInspectContractKey(e.target.value)}
                placeholder={t("builder.storageKeyPlaceholder")}
                style={textInputStyle()}
              />
            </LabeledField>
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <ActionButton
              label={inspectContractLoading ? t("builder.fetching") : t("builder.fetchState")}
              onClick={handleFetchContractData}
              disabled={inspectContractLoading || !inspectContractId.trim()}
            />
          </div>
        </div>
          {inspectContractError && (
            <div style={{ fontSize: "12px", color: "var(--red)", marginBottom: "12px" }}>
              {inspectContractError}
            </div>
          )}
          {inspectContractData && (
            <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {t("builder.key")}
              </div>
              <pre style={{
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
              }}>
                {JSON.stringify(inspectContractData.key, null, 2)}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                {t("builder.value")}
              </div>
              <pre style={{
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
              }}>
                {JSON.stringify(inspectContractData.value, null, 2)}
              </pre>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* Transaction Settings */}
      <Panel title={t("builder.transactionSettings")} subtitle={t("builder.transactionSettingsSubtitle")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          <LabeledField label={t("builder.sourceAccount")}>
            <FederatedAddressInput
              value={sourceAccount}
              onChange={(val) => setSourceAccount(val)}
              placeholder={connectedAddress || t("builder.sourceAccountPlaceholder")}
              style={textInputStyle(!sourceAccount && !feeBumpOnly)}
              network={network}
              hasError={!sourceAccount && !feeBumpOnly}
            />
            {feeBumpOnly && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                {t("builder.sourceAccountOptionalFeeBump")}
              </div>
            )}
          </LabeledField>

          <LabeledField label={t("builder.baseFee")}>
            <input
              type="number"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              placeholder="100"
              style={textInputStyle()}
            />
          </LabeledField>

          <LabeledField label={t("builder.timeout")}>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              placeholder="300"
              style={textInputStyle()}
            />
            <TimeboundsPreset timeout={timeout} setTimeout={setTimeout} />
          </LabeledField>

          <LabeledField label={t("builder.memoType")}>
            <select
              value={memoType}
              onChange={(e) => setMemoType(e.target.value)}
              style={textInputStyle()}
            >
              <option value="text">{t("builder.operationFields.memoTypeText")}</option>
              <option value="id">{t("builder.operationFields.memoTypeId")}</option>
              <option value="hash">{t("builder.operationFields.memoTypeHash")}</option>
              <option value="return">{t("builder.operationFields.memoTypeReturn")}</option>
            </select>
          </LabeledField>

          <LabeledField label={t("builder.memo")}>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={
                memoType === "id"
                  ? t("builder.memoPlaceholderId")
                  : memoType === "hash" || memoType === "return"
                  ? t("builder.memoPlaceholderHash")
                  : t("builder.memoPlaceholder")
              }
              style={textInputStyle(!memoValidation.valid)}
            />
            {!memoValidation.valid && (
              <div style={{ fontSize: "11px", color: "var(--red)", marginTop: "4px" }}>
                {memoValidation.errors[0]}
              </div>
            )}
          </LabeledField>
        </div>

        {memoRequiredWarning && (
          <div style={{
            marginTop: "14px",
            padding: "10px 14px",
            background: "var(--amber-glow)",
            border: "1px solid var(--amber)",
            borderRadius: "var(--radius-md)",
            fontSize: "12px",
            color: "var(--amber)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <AlertCircle size={14} />
            {t("builder.memoRequiredSep29")}
          </div>
        )}

        {memoRequirement.error && !memoRequirement.checking && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
            {t("builder.memoRequirementUnverified", { reason: memoRequirement.error })}
          </div>
        )}
      </Panel>

      {/* Visual Flow Diagram */}
      {operations.length > 0 && (
        <Panel title={t("builder.transactionFlow")} subtitle={t("builder.transactionFlowSubtitle")}>
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
              {t("builder.operationFields.source")}: {sourceAccount ? `${sourceAccount.slice(0, 8)}...${sourceAccount.slice(-8)}` : t("builder.notSet")}
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
              {t("builder.submitToNetwork")}
            </div>
          </div>
        </Panel>
      )}

      {/* Operations */}
      <Panel title={`${t("builder.operations")} (${operations.length})`} subtitle={t("builder.operationsSubtitle")}>
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
                    {t("builder.operation")} {index + 1}
                  </span>
                  {validationErrors[op.id] && (
                    <AlertCircle size={14} style={{ color: "var(--red)" }} />
                  )}
                </div>
                {!isNovice && (
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
                      title={t("builder.duplicateTitle")}
                    >
                      <Copy size={12} />
                      {t("builder.duplicate")}
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
                      {t("builder.remove")}
                    </button>
                  </div>
                )}
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
                <LabeledField label={t("builder.operationType")}>
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
            {t("builder.addOperation")}
          </button>
        </div>
      </Panel>

      {/* Actions */}
      {isNovice && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "12px" }}>
          {t("builder.guidanceNovice")}
        </div>
      )}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => txHistory.undo()}
          disabled={!txHistory?.canUndo?.()}
          title={t("builder.undo")}
          style={{
            padding: "10px 14px",
            background: txHistory?.canUndo?.() ? "var(--bg-elevated)" : "var(--bg-base)",
            color: txHistory?.canUndo?.() ? "var(--text-primary)" : "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "12px",
            cursor: txHistory?.canUndo?.() ? "pointer" : "not-allowed",
          }}
        >
          {t("builder.undo")}
        </button>

        <button
          onClick={() => txHistory.redo()}
          disabled={!txHistory?.canRedo?.()}
          title={t("builder.redo")}
          style={{
            padding: "10px 14px",
            background: txHistory?.canRedo?.() ? "var(--bg-elevated)" : "var(--bg-base)",
            color: txHistory?.canRedo?.() ? "var(--text-primary)" : "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "12px",
            cursor: txHistory?.canRedo?.() ? "pointer" : "not-allowed",
          }}
        >
          {t("builder.redo")}
        </button>

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
              {t("builder.simulating")}
            </>
          ) : (
            <>
              <Play size={16} />
              {t("builder.simulate")}
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
          {t("builder.exportXdr")}
        </button>

        {!isNovice && (
          <button
            onClick={async () => {
              const name = window.prompt(t("builder.draftNamePrompt"), "My Draft");
              if (!name) return;
              try {
                txHistory.saveDraft(name, getSnapshot());
                setDraftsList(txHistory.listDrafts());
                window.alert(t("builder.draftSaved"));
              } catch (e) {
                window.alert(t("builder.draftSaveFailed"));
              }
            }}
            style={{
            padding: "12px 20px",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "var(--transition)",
          }}
        >
            {t("builder.saveDraft")}
          </button>
        )}

        {!isNovice && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                const list = txHistory.listDrafts();
                setDraftsList(list);
                setShowDraftsPanel(!showDraftsPanel);
              }}
              style={{
                padding: "12px 20px",
                background: "transparent",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {t("builder.drafts")} ({txHistory.listDrafts().length})
            </button>

            {showDraftsPanel && (
              <div style={{
                position: "absolute",
                right: 0,
                marginTop: "8px",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "8px",
                minWidth: "260px",
                zIndex: 60,
              }}>
                {draftsList.length === 0 && (
                  <div style={{ padding: "8px", color: "var(--text-muted)" }}>{t("builder.noDraftsSaved")}</div>
                )}
                {draftsList.map((d) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center", padding: "6px 4px" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{d.name}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => { txHistory.loadDraft(d.id); setShowDraftsPanel(false); }} style={{ padding: "6px", fontSize: "12px" }}>{t("builder.load")}</button>
                      <button onClick={() => { txHistory.deleteDraft(d.id); setDraftsList(txHistory.listDrafts()); }} style={{ padding: "6px", fontSize: "12px", color: "var(--red)" }}>{t("builder.delete")}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isNovice && (
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
            {t("builder.saveAsTemplate")}
          </button>
        )}
      </div>

      {/* Simulation Results */}
      {simulation && (
        <Panel
          title={t("builder.simulationResults")}
          subtitle={simulation.success ? t("builder.simulationSuccessSubtitle") : t("builder.simulationFailureSubtitle")}
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
                  {simulation.success ? t("builder.simulationSuccessful") : t("builder.simulationFailed")}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {simulation.success
                    ? t("builder.simulationPassedChecks")
                    : t("builder.simulationErrorsFound", { count: simulation.errors.length })}
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
                  {t("builder.estimatedFee")}
                </div>
                <div style={{ fontSize: "20px", fontFamily: "var(--font-mono)", color: "var(--cyan)", fontWeight: 700 }}>
                  {simulation.fee.toLocaleString()}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {t("builder.stroopsPerOp", { xlm: (simulation.fee / 10000000).toFixed(7) })}
                </div>
              </div>

              <div style={{
                padding: "14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
              }}>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  {t("builder.operations")}
                </div>
                <div style={{ fontSize: "20px", fontFamily: "var(--font-mono)", color: "var(--amber)", fontWeight: 700 }}>
                  {simulation.operationCount}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {t("builder.stroopsPerOperation", { stroops: baseFee })}
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
                    {t("builder.transactionHash")}
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
                  {t("builder.validationErrors")}
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
                    {t("builder.transactionXdr")}
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
                    {showXDR ? t("builder.hideXdr") : t("builder.showXdr")} XDR
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
