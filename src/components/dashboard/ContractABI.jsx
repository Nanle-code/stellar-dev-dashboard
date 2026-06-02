import React, { useState } from "react";
import { parseContractWasm } from "../../lib/contractInvoker";
import { useStore } from "../../lib/store";

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

function textInputStyle() {
  return {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-bright)",
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

function Tag({ children, tone = "default" }) {
  const palette =
    tone === "accent"
      ? {
          color: "var(--cyan)",
          background: "rgba(34, 211, 238, 0.08)",
          border: "rgba(34, 211, 238, 0.2)",
        }
      : tone === "warning"
        ? {
            color: "var(--amber)",
            background: "rgba(255, 184, 0, 0.1)",
            border: "rgba(255, 184, 0, 0.22)",
          }
        : tone === "success"
          ? {
              color: "var(--green)",
              background: "rgba(34, 197, 94, 0.1)",
              border: "rgba(34, 197, 94, 0.22)",
            }
          : {
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
              border: "var(--border)",
            };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: "999px",
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

function MetricCard({ label, value }) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.8px",
          marginBottom: "6px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 700,
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function schemaRefName(ref = "") {
  return ref.startsWith("#/definitions/") ? ref.slice("#/definitions/".length) : ref;
}

function schemaSummary(schema, definitions = {}, depth = 0) {
  if (!schema || depth > 5) return "unknown";

  if (schema.$ref) return schemaRefName(schema.$ref);

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf
      .map((entry) => schemaSummary(entry, definitions, depth + 1))
      .join(" | ");
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf
      .map((entry) => schemaSummary(entry, definitions, depth + 1))
      .join(" | ");
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf
      .map((entry) => schemaSummary(entry, definitions, depth + 1))
      .join(" & ");
  }

  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  if (schema.enum?.length) return `enum(${schema.enum.join(", ")})`;
  if (schema.type === "array") {
    return `Array<${schemaSummary(schema.items, definitions, depth + 1)}>`;
  }
  if (schema.type === "object" && schema.additionalProperties) {
    return `Map<string, ${schemaSummary(
      schema.additionalProperties,
      definitions,
      depth + 1,
    )}>`;
  }
  if (schema.type === "object" && schema.properties) return "object";
  if (schema.type) return schema.type;
  return "unknown";
}

function resolveSchema(schema, definitions = {}, seenRefs = []) {
  if (!schema?.$ref) {
    return { refName: null, schema, circular: false };
  }

  const refName = schemaRefName(schema.$ref);
  if (seenRefs.includes(refName)) {
    return { refName, schema: definitions[refName] || schema, circular: true };
  }

  return {
    refName,
    schema: definitions[refName] || schema,
    circular: false,
  };
}

function buildExampleValue(schema, definitions = {}, depth = 0, seenRefs = []) {
  if (!schema || depth > 4) return "";

  const resolved = resolveSchema(schema, definitions, seenRefs);
  const nextSeenRefs = resolved.refName ? [...seenRefs, resolved.refName] : seenRefs;
  const activeSchema = resolved.schema;
  const summary = schemaSummary(schema, definitions).toLowerCase();

  if (resolved.circular) {
    return resolved.refName ? { $ref: resolved.refName } : {};
  }

  if (Array.isArray(activeSchema.enum) && activeSchema.enum.length > 0) {
    return activeSchema.enum[0];
  }

  if (Array.isArray(activeSchema.oneOf) && activeSchema.oneOf.length > 0) {
    return buildExampleValue(
      activeSchema.oneOf[0],
      definitions,
      depth + 1,
      nextSeenRefs,
    );
  }

  if (Array.isArray(activeSchema.anyOf) && activeSchema.anyOf.length > 0) {
    return buildExampleValue(
      activeSchema.anyOf[0],
      definitions,
      depth + 1,
      nextSeenRefs,
    );
  }

  if (Array.isArray(activeSchema.allOf) && activeSchema.allOf.length > 0) {
    return buildExampleValue(
      activeSchema.allOf[0],
      definitions,
      depth + 1,
      nextSeenRefs,
    );
  }

  if (activeSchema.type === "array") {
    return [buildExampleValue(activeSchema.items, definitions, depth + 1, nextSeenRefs)];
  }

  if (activeSchema.type === "object" && activeSchema.properties) {
    return Object.fromEntries(
      Object.entries(activeSchema.properties).map(([name, propertySchema]) => [
        name,
        buildExampleValue(propertySchema, definitions, depth + 1, nextSeenRefs),
      ]),
    );
  }

  if (activeSchema.type === "object" && activeSchema.additionalProperties) {
    return {
      key: buildExampleValue(
        activeSchema.additionalProperties,
        definitions,
        depth + 1,
        nextSeenRefs,
      ),
    };
  }

  if (activeSchema.type === "boolean") return false;
  if (activeSchema.type === "integer" || activeSchema.type === "number") return 0;
  if (activeSchema.type === "null") return null;
  if (summary.includes("address")) return "G...";
  return "";
}

function buildValidationTemplate(contractFunction, definitions = {}) {
  if (!contractFunction?.parameters?.length) return {};

  return Object.fromEntries(
    contractFunction.parameters.map((parameter) => [
      parameter.name,
      parameter.schema
        ? buildExampleValue(parameter.schema, definitions)
        : parameter.type.toLowerCase().includes("bool")
          ? false
          : parameter.type.toLowerCase().includes("address")
            ? "G..."
            : parameter.type.match(/[iu]\d+/)
              ? 0
              : "",
    ]),
  );
}

function SchemaNode({ schema, definitions, label, depth = 0, seenRefs = [] }) {
  if (!schema) {
    return (
      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
        No schema details published for this node.
      </div>
    );
  }

  const resolved = resolveSchema(schema, definitions, seenRefs);
  const nextSeenRefs = resolved.refName ? [...seenRefs, resolved.refName] : seenRefs;
  const activeSchema = resolved.schema || schema;
  const properties = Object.entries(activeSchema.properties || {});
  const variants = activeSchema.oneOf || activeSchema.anyOf || activeSchema.allOf || [];
  const enumValues = activeSchema.enum || [];

  return (
    <div
      style={{
        marginTop: depth === 0 ? 0 : "10px",
        paddingLeft: depth === 0 ? 0 : "12px",
        borderLeft: depth === 0 ? "none" : "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {label && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {label}
          </span>
        )}
        <Tag tone="accent">{schemaSummary(schema, definitions)}</Tag>
        {resolved.refName && <Tag>{resolved.refName}</Tag>}
        {resolved.circular && <Tag tone="warning">circular</Tag>}
      </div>

      {activeSchema.description && (
        <div
          style={{
            marginTop: "6px",
            fontSize: "11px",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {activeSchema.description}
        </div>
      )}

      {properties.length > 0 && (
        <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
          {properties.map(([propertyName, propertySchema]) => (
            <SchemaNode
              key={propertyName}
              schema={propertySchema}
              definitions={definitions}
              label={propertyName}
              depth={depth + 1}
              seenRefs={nextSeenRefs}
            />
          ))}
        </div>
      )}

      {activeSchema.items && (
        <SchemaNode
          schema={activeSchema.items}
          definitions={definitions}
          label="items"
          depth={depth + 1}
          seenRefs={nextSeenRefs}
        />
      )}

      {activeSchema.additionalProperties && (
        <SchemaNode
          schema={activeSchema.additionalProperties}
          definitions={definitions}
          label="values"
          depth={depth + 1}
          seenRefs={nextSeenRefs}
        />
      )}

      {variants.length > 0 && (
        <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
          {variants.map((variant, index) => (
            <SchemaNode
              key={`${label || "variant"}-${index}`}
              schema={variant}
              definitions={definitions}
              label={`variant ${index + 1}`}
              depth={depth + 1}
              seenRefs={nextSeenRefs}
            />
          ))}
        </div>
      )}

      {enumValues.length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {enumValues.map((value) => (
            <Tag key={String(value)}>{String(value)}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}

function FunctionCard({
  contractFunction,
  definitions,
  validationInput,
  validationResult,
  onValidationChange,
  onValidate,
  validationDisabled,
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-elevated)",
        padding: "16px",
        display: "grid",
        gap: "14px",
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            {contractFunction.name}
          </div>
          <Tag tone="accent">{contractFunction.returnType}</Tag>
        </div>
        <code
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 12px",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {contractFunction.signature}
        </code>
        {contractFunction.doc && (
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {contractFunction.doc}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          Parameters
        </div>

        {contractFunction.parameters.length === 0 ? (
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            This function does not take any parameters.
          </div>
        ) : (
          contractFunction.parameters.map((parameter) => (
            <div
              key={`${contractFunction.name}-${parameter.name}`}
              style={{
                padding: "12px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                display: "grid",
                gap: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {parameter.name}
                </span>
                <Tag tone="accent">{parameter.type}</Tag>
                {parameter.required ? (
                  <Tag tone="warning">required</Tag>
                ) : (
                  <Tag>optional</Tag>
                )}
              </div>

              {parameter.description && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {parameter.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {contractFunction.inputSchema && (
        <details style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Input Shape
          </summary>
          <div style={{ marginTop: "12px" }}>
            <SchemaNode
              schema={contractFunction.inputSchema}
              definitions={definitions}
              label="arguments"
            />
          </div>
        </details>
      )}

      <details style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        <summary
          style={{
            cursor: validationDisabled ? "not-allowed" : "pointer",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Validate Parameters
        </summary>
        <div style={{ marginTop: "12px", display: "grid", gap: "12px" }}>
          <textarea
            value={validationInput}
            onChange={(event) =>
              onValidationChange(contractFunction.name, event.target.value)
            }
            rows={Math.max(6, contractFunction.parameters.length * 2)}
            spellCheck={false}
            style={{
              ...textInputStyle(),
              minHeight: "150px",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <ActionButton
              label="Validate JSON Payload"
              onClick={() => onValidate(contractFunction.name)}
              disabled={validationDisabled}
              tone="secondary"
            />
            {validationDisabled && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Validation requires the contract to publish a readable on-chain spec.
              </div>
            )}
          </div>

          {validationResult && (
            <div
              style={{
                padding: "12px",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${
                  validationResult.ok ? "rgba(34, 197, 94, 0.25)" : "rgba(220, 38, 38, 0.25)"
                }`,
                background: validationResult.ok
                  ? "rgba(34, 197, 94, 0.08)"
                  : "rgba(220, 38, 38, 0.08)",
                color: validationResult.ok ? "var(--green)" : "var(--red)",
                fontSize: "11px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {validationResult.message}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

export default function ContractABI() {
  const { network } = useStore();
  const [contractId, setContractId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contractData, setContractData] = useState(null);
  const [validationInputs, setValidationInputs] = useState({});
  const [validationResults, setValidationResults] = useState({});

  async function handleFetch() {
    const normalizedContractId = contractId.trim();

    setError("");
    setContractData(null);
    setValidationInputs({});
    setValidationResults({});
    setLoading(true);

    try {
      const data = await parseContractWasm(normalizedContractId, network);
      const definitions = data.schema?.definitions || {};
      const initialValidationInputs = Object.fromEntries(
        (data.functions || []).map((contractFunction) => [
          contractFunction.name,
          JSON.stringify(
            buildValidationTemplate(contractFunction, definitions),
            null,
            2,
          ),
        ]),
      );

      setContractData(data);
      setValidationInputs(initialValidationInputs);
    } catch (err) {
      setError(err.message || "Failed to fetch contract");
    } finally {
      setLoading(false);
    }
  }

  function updateValidationInput(functionName, value) {
    setValidationInputs((current) => ({
      ...current,
      [functionName]: value,
    }));
    setValidationResults((current) => ({
      ...current,
      [functionName]: null,
    }));
  }

  function validateFunction(functionName) {
    const spec = contractData?.spec;

    if (!spec || typeof spec.funcArgsToScVals !== "function") {
      setValidationResults((current) => ({
        ...current,
        [functionName]: {
          ok: false,
          message:
            "Validation is unavailable because this contract did not expose a compatible spec payload.",
        },
      }));
      return;
    }

    try {
      const parsed = JSON.parse(validationInputs[functionName] || "{}");
      const encodedArgs = spec.funcArgsToScVals(functionName, parsed);

      setValidationResults((current) => ({
        ...current,
        [functionName]: {
          ok: true,
          message: `Payload matches the contract type definition. Encoded ${encodedArgs.length} argument${encodedArgs.length === 1 ? "" : "s"}.`,
        },
      }));
    } catch (validationError) {
      setValidationResults((current) => ({
        ...current,
        [functionName]: {
          ok: false,
          message: validationError.message || "Validation failed",
        },
      }));
    }
  }

  const schemaDefinitions = contractData?.schema?.definitions || {};
  const validationDisabled = !contractData?.spec?.funcArgsToScVals;

  return (
    <div
      className="animate-in"
      style={{ display: "flex", flexDirection: "column", gap: "24px" }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 700,
        }}
      >
        Contract ABI Explorer
      </div>

      <Panel
        title="Contract Lookup"
        subtitle="Fetch published Soroban type metadata, parameter docs, and storage key structures."
      >
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            placeholder="C... contract address"
            style={{ ...textInputStyle(), flex: 1, minWidth: "280px" }}
          />
          <ActionButton
            label={loading ? "Loading..." : "Fetch ABI"}
            onClick={handleFetch}
            disabled={loading || !contractId.trim()}
          />
        </div>

        {error && (
          <div
            style={{ marginTop: "12px", fontSize: "12px", color: "var(--red)" }}
          >
            {error}
          </div>
        )}
      </Panel>

      {contractData && (
        <>
          <Panel
            title="Contract Summary"
            subtitle="A compact overview of the published interface and schema coverage."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: "12px",
              }}
            >
              <MetricCard label="Functions" value={contractData.functions.length} />
              <MetricCard label="Error Types" value={contractData.errorTypes.length} />
              <MetricCard label="Custom Types" value={contractData.customTypes.length} />
              <MetricCard
                label="Storage Key Types"
                value={contractData.storage.keyTypes.length}
              />
            </div>

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <Tag tone="accent">{contractData.network}</Tag>
              {contractData.specSource ? (
                <Tag>spec via {contractData.specSource}</Tag>
              ) : (
                <Tag tone="warning">ledger fallback only</Tag>
              )}
              <Tag>{contractData.contractId}</Tag>
            </div>

            {contractData.warnings?.length > 0 && (
              <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
                {contractData.warnings.map((warning) => (
                  <div
                    key={warning}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid rgba(255, 184, 0, 0.22)",
                      background: "rgba(255, 184, 0, 0.08)",
                      color: "var(--amber)",
                      fontSize: "11px",
                      lineHeight: 1.5,
                    }}
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Contract Functions"
            subtitle="Every published parameter type is shown inline, with deeper nested shapes and payload validation available per function."
          >
            {contractData.functions.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No contract functions were published in the fetched spec payload.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                {contractData.functions.map((contractFunction) => (
                  <FunctionCard
                    key={contractFunction.name}
                    contractFunction={contractFunction}
                    definitions={schemaDefinitions}
                    validationInput={validationInputs[contractFunction.name] || "{}"}
                    validationResult={validationResults[contractFunction.name]}
                    onValidationChange={updateValidationInput}
                    onValidate={validateFunction}
                    validationDisabled={validationDisabled}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Error Types"
            subtitle="Published contract errors and their numeric codes."
          >
            {contractData.errorTypes.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No explicit contract error enum was published.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {contractData.errorTypes.map((errorType) => (
                  <div
                    key={`${errorType.code}-${errorType.name}`}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      display: "grid",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {errorType.name}
                      </span>
                      <Tag tone="warning">#{String(errorType.code)}</Tag>
                    </div>
                    {errorType.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {errorType.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Storage Key Structure"
            subtitle="Likely storage key types are inferred from the published custom type definitions, which is where Soroban contracts usually document ledger key shapes."
          >
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {contractData.storage.summary}
            </div>

            {contractData.storage.keyTypes.length > 0 ? (
              <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
                {contractData.storage.keyTypes.map((typeEntry) => (
                  <details
                    key={`storage-${typeEntry.name}`}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      {typeEntry.name}
                      <Tag tone="accent">{typeEntry.summary}</Tag>
                    </summary>
                    <div style={{ marginTop: "12px" }}>
                      <SchemaNode
                        schema={typeEntry.schema}
                        definitions={schemaDefinitions}
                        label={typeEntry.name}
                      />
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--text-muted)" }}>
                The contract spec did not publish a custom type whose name clearly matches a storage key pattern such as
                {" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>DataKey</code> or
                {" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>StorageKey</code>.
                Review the custom types below for the full nested structures that were published.
              </div>
            )}
          </Panel>

          <Panel
            title="Custom Types"
            subtitle="Nested structs, unions, maps, and enums that support the contract interface."
          >
            {contractData.customTypes.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No additional custom types were published in the fetched schema.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {contractData.customTypes.map((typeEntry) => (
                  <details
                    key={typeEntry.name}
                    style={{
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      {typeEntry.name}
                      <Tag tone="accent">{typeEntry.summary}</Tag>
                    </summary>
                    <div style={{ marginTop: "12px" }}>
                      <SchemaNode
                        schema={typeEntry.schema}
                        definitions={schemaDefinitions}
                        label={typeEntry.name}
                      />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Raw Contract Data"
            subtitle="Underlying schema and ledger entry for deeper inspection."
          >
            <div style={{ display: "grid", gap: "12px" }}>
              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Schema JSON
                </summary>
                <pre
                  style={{
                    margin: "12px 0 0",
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
                  {JSON.stringify(contractData.schema, null, 2)}
                </pre>
              </details>

              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Ledger Entry XDR
                </summary>
                <pre
                  style={{
                    margin: "12px 0 0",
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
                  {contractData.ledgerEntry}
                </pre>
              </details>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
