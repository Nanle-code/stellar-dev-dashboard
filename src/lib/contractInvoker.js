import * as StellarSdk from "@stellar/stellar-sdk";
import {
  getSorobanServer,
  getServer,
  NETWORKS,
  isValidContractId,
  isValidPublicKey,
} from "./stellar";

const STORAGE_KEY_NAME_PATTERN =
  /(data|state|storage).*(key)|(^|_)(key|keys)$|datakey|storagekey|statekey/i;
const PRIMITIVE_SCHEMA_NAMES = new Set([
  "Address",
  "Bytes",
  "BytesN",
  "Duration",
  "Error",
  "I128",
  "I256",
  "I32",
  "I64",
  "Map",
  "Option",
  "Result",
  "String",
  "Symbol",
  "Timepoint",
  "Tuple",
  "U128",
  "U256",
  "U32",
  "U64",
  "Val",
  "Vec",
  "Void",
  "bool",
  "bytes",
  "bytesN",
  "duration",
  "i128",
  "i256",
  "i32",
  "i64",
  "map",
  "option",
  "result",
  "string",
  "symbol",
  "timepoint",
  "tuple",
  "u128",
  "u256",
  "u32",
  "u64",
  "val",
  "vec",
  "void",
]);

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value.length === "number") return Array.from(value);
  return [value];
}

function safeInvoke(target, methods, ...args) {
  const candidates = Array.isArray(methods) ? methods : [methods];

  for (const method of candidates) {
    if (target && typeof target[method] === "function") {
      try {
        return target[method](...args);
      } catch {
        // Keep trying the next compatible accessor.
      }
    }
  }

  return undefined;
}

function readSwitchName(value) {
  const switchValue = safeInvoke(value, "switch");

  if (!switchValue) return "";
  if (typeof switchValue.name === "string") return switchValue.name;
  if (typeof switchValue.name === "function") return switchValue.name();
  if (typeof switchValue.toString === "function") return switchValue.toString();
  return String(switchValue);
}

function readString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;

  if (ArrayBuffer.isView(value)) {
    try {
      return new TextDecoder("utf-8").decode(value);
    } catch {
      return Array.from(value).join(",");
    }
  }

  if (typeof value.toString === "function") {
    const stringified = value.toString();
    if (stringified !== "[object Object]") return stringified;
  }

  return "";
}

function readDoc(value) {
  return readString(value).replace(/\s+/g, " ").trim();
}

function summarizeDoc(doc) {
  if (!doc) return "";
  const sentence = doc.split(/(?<=[.!?])\s+/)[0]?.trim();
  return sentence || doc;
}

function normalizeTypeLabel(label) {
  return String(label || "")
    .replace(/\s+/g, " ")
    .replace(/\s*<\s*/g, "<")
    .replace(/\s*>\s*/g, ">")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function fallbackTypeLabel(typeDef) {
  const switchName = readSwitchName(typeDef).toLowerCase();
  const scalarMatches = [
    ["scspectypebool", "bool"],
    ["scspectypevoid", "void"],
    ["scspectypeval", "Val"],
    ["scspectypeerror", "Error"],
    ["scspectypeu32", "u32"],
    ["scspectypei32", "i32"],
    ["scspectypeu64", "u64"],
    ["scspectypei64", "i64"],
    ["scspectypetimepoint", "Timepoint"],
    ["scspectypeduration", "Duration"],
    ["scspectypeu128", "u128"],
    ["scspectypei128", "i128"],
    ["scspectypeu256", "u256"],
    ["scspectypei256", "i256"],
    ["scspectypebytes", "Bytes"],
    ["scspectypestring", "String"],
    ["scspectypesymbol", "Symbol"],
    ["scspectypeaddress", "Address"],
  ];

  for (const [token, label] of scalarMatches) {
    if (switchName.includes(token)) return label;
  }

  if (switchName.includes("option")) return "Option<...>";
  if (switchName.includes("result")) return "Result<...>";
  if (switchName.includes("vec")) return "Vec<...>";
  if (switchName.includes("map")) return "Map<..., ...>";
  if (switchName.includes("tuple")) return "Tuple";
  if (switchName.includes("bytesn")) return "BytesN";

  const udt = safeInvoke(typeDef, ["udt", "value"]);
  const udtName = readString(safeInvoke(udt, "name"));
  if (udtName) return udtName;

  return readSwitchName(typeDef) || "unknown";
}

function formatTypeLabel(typeDef) {
  if (!typeDef) return "unknown";

  if (typeof StellarSdk.parseTypeFromTypeDef === "function") {
    try {
      return normalizeTypeLabel(StellarSdk.parseTypeFromTypeDef(typeDef));
    } catch {
      // Fall through to best-effort formatting.
    }
  }

  return fallbackTypeLabel(typeDef);
}

function schemaRefName(ref = "") {
  return ref.startsWith("#/definitions/") ? ref.slice("#/definitions/".length) : ref;
}

function summarizeSchemaType(schema, definitions = {}, depth = 0) {
  if (!schema || depth > 5) return "unknown";

  if (schema.$ref) {
    return schemaRefName(schema.$ref);
  }

  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return schema.oneOf
      .map((entry) => summarizeSchemaType(entry, definitions, depth + 1))
      .join(" | ");
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return schema.anyOf
      .map((entry) => summarizeSchemaType(entry, definitions, depth + 1))
      .join(" | ");
  }

  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf
      .map((entry) => summarizeSchemaType(entry, definitions, depth + 1))
      .join(" & ");
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  if (schema.enum?.length) {
    return `enum(${schema.enum.join(", ")})`;
  }

  if (schema.type === "array") {
    return `Array<${summarizeSchemaType(schema.items, definitions, depth + 1)}>`;
  }

  if (schema.type === "object" && schema.additionalProperties) {
    return `Map<string, ${summarizeSchemaType(
      schema.additionalProperties,
      definitions,
      depth + 1,
    )}>`;
  }

  if (schema.type === "object" && schema.properties) {
    return "object";
  }

  if (schema.type) return schema.type;
  return "unknown";
}

function isPrimitiveSchemaDefinition(name, definition) {
  if (PRIMITIVE_SCHEMA_NAMES.has(name)) return true;

  const summary = summarizeSchemaType(definition);
  return PRIMITIVE_SCHEMA_NAMES.has(summary);
}

function buildSchemaDefinitionList(schema, functionNames) {
  const definitions = schema?.definitions || {};

  return Object.entries(definitions)
    .filter(([name, definition]) => {
      return !functionNames.has(name) && !isPrimitiveSchemaDefinition(name, definition);
    })
    .map(([name, definition]) => ({
      name,
      description: definition.description || "",
      summary: summarizeSchemaType(definition, definitions),
      schema: definition,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function detectStorageKeyTypes(customTypes) {
  return customTypes.filter((entry) => STORAGE_KEY_NAME_PATTERN.test(entry.name));
}

function extractErrorTypes(spec) {
  if (!spec || typeof spec.errorCases !== "function") return [];

  return ensureArray(spec.errorCases())
    .map((errorCase) => ({
      code: safeInvoke(errorCase, "value"),
      name: readString(safeInvoke(errorCase, "name")) || `Error ${safeInvoke(errorCase, "value")}`,
      description: readDoc(safeInvoke(errorCase, "doc")),
    }))
    .sort((left, right) => Number(left.code) - Number(right.code));
}

function extractFunctionData(spec, schema) {
  if (!spec || typeof spec.funcs !== "function") return [];

  const definitions = schema?.definitions || {};

  return ensureArray(spec.funcs()).map((fn) => {
    const name = readString(safeInvoke(fn, "name"));
    const doc = readDoc(safeInvoke(fn, "doc"));
    const inputSchema = definitions[name] || null;
    const propertySchemas = inputSchema?.properties || {};
    const required = new Set(inputSchema?.required || []);

    const parameters = ensureArray(safeInvoke(fn, "inputs")).map((input) => {
      const paramName = readString(safeInvoke(input, "name"));
      const schemaDefinition = propertySchemas[paramName] || null;
      const description =
        readDoc(safeInvoke(input, "doc")) || schemaDefinition?.description || "";

      return {
        name: paramName,
        type: formatTypeLabel(safeInvoke(input, "type")),
        description,
        schema: schemaDefinition,
        required: required.size > 0 ? required.has(paramName) : true,
      };
    });

    const returnTypes = ensureArray(safeInvoke(fn, ["outputs", "output"]))
      .map((typeDef) => formatTypeLabel(typeDef))
      .filter(Boolean);
    const normalizedReturnTypes = returnTypes.length > 0 ? returnTypes : ["void"];

    return {
      name,
      doc,
      summary: summarizeDoc(doc),
      parameters,
      inputSchema,
      returnType: normalizedReturnTypes.join(" | "),
      returnTypes: normalizedReturnTypes,
      signature: `${name}(${parameters
        .map((param) => `${param.name}: ${param.type}`)
        .join(", ")}) -> ${normalizedReturnTypes.join(" | ")}`,
    };
  });
}

async function loadContractSpec(contractId, network, server) {
  const rpcUrl = NETWORKS?.[network]?.sorobanUrl;
  const allowHttp = typeof rpcUrl === "string" && rpcUrl.startsWith("http://");
  const options = {
    contractId,
    rpcUrl,
    networkPassphrase: NETWORKS?.[network]?.passphrase,
    allowHttp,
    headers: NETWORKS?.[network]?.headers,
  };

  if (StellarSdk.contract?.Client?.from && rpcUrl) {
    const client = await StellarSdk.contract.Client.from(options);
    if (client?.spec) {
      return { spec: client.spec, source: "contract.Client.from" };
    }
  }

  if (typeof server.getContractWasmByContractId === "function") {
    const wasm = await server.getContractWasmByContractId(contractId);

    if (StellarSdk.contract?.Spec?.fromWasm) {
      return {
        spec: await StellarSdk.contract.Spec.fromWasm(wasm),
        source: "contract.Spec.fromWasm",
      };
    }

    if (StellarSdk.contract?.Client?.fromWasm) {
      const client = await StellarSdk.contract.Client.fromWasm(wasm, options);
      if (client?.spec) {
        return { spec: client.spec, source: "contract.Client.fromWasm" };
      }
    }
  }

  return null;
}

function buildContractAbiPayload({
  contractId,
  network,
  ledgerEntry,
  spec,
  specSource = null,
  warnings = [],
}) {
  const schema = spec && typeof spec.jsonSchema === "function" ? spec.jsonSchema() : null;
  const functions = extractFunctionData(spec, schema);
  const functionNames = new Set(functions.map((entry) => entry.name));
  const customTypes = buildSchemaDefinitionList(schema, functionNames);
  const storageKeyTypes = detectStorageKeyTypes(customTypes);
  const errorTypes = extractErrorTypes(spec);

  return {
    found: true,
    contractId,
    network,
    fetchedAt: new Date().toISOString(),
    ledgerEntry,
    spec,
    specSource,
    schema,
    functions,
    errorTypes,
    customTypes,
    storage: {
      keyTypes: storageKeyTypes,
      summary:
        storageKeyTypes.length > 0
          ? `Detected ${storageKeyTypes.length} storage key type${storageKeyTypes.length === 1 ? "" : "s"}`
          : "No explicit storage key type detected in the published spec",
    },
    warnings,
  };
}

export async function parseContractWasm(contractId, network = "testnet") {
  const server = getSorobanServer(network);
  const warnings = [];

  try {
    const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
      new StellarSdk.xdr.LedgerKeyContractData({
        contract: StellarSdk.Address.fromString(contractId).toScAddress(),
        key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: StellarSdk.xdr.ContractDataDurability.persistent(),
      }),
    );

    const response = await server.getLedgerEntries(ledgerKey);

    if (!response.entries || response.entries.length === 0) {
      throw new Error("Contract not found");
    }

    let loadedSpec = null;

    try {
      loadedSpec = await loadContractSpec(contractId, network, server);
    } catch (specError) {
      warnings.push(
        `Type metadata could not be loaded from the published contract spec: ${
          specError.message || String(specError)
        }`,
      );
    }

    return buildContractAbiPayload({
      contractId,
      network,
      ledgerEntry: response.entries[0].xdr,
      spec: loadedSpec?.spec || null,
      specSource: loadedSpec?.source || null,
      warnings,
    });
  } catch (error) {
    throw new Error(`Failed to fetch contract: ${error.message}`);
  }
}

export async function invokeContractFunction({
  contractId,
  functionName,
  args = [],
  sourceAccount,
  secretKey,
  network = "testnet",
}) {
  if (!isValidContractId(contractId)) {
    throw new Error("Invalid contract ID");
  }

  if (!functionName?.trim()) {
    throw new Error("Function name is required");
  }

  if (!isValidPublicKey(sourceAccount)) {
    throw new Error("Invalid source account");
  }

  if (!StellarSdk.StrKey.isValidEd25519SecretSeed(secretKey)) {
    throw new Error("Invalid secret key");
  }

  const server = getSorobanServer(network);
  const horizon = getServer(network);
  const account = await horizon.loadAccount(sourceAccount);
  const contract = new StellarSdk.Contract(contractId);

  const scArgs = args.map((arg) => {
    switch (arg.type) {
      case "string":
        return StellarSdk.nativeToScVal(arg.value, { type: "string" });
      case "int":
        return StellarSdk.nativeToScVal(BigInt(arg.value), { type: "i128" });
      case "address":
        return StellarSdk.Address.fromString(arg.value).toScVal();
      case "bool":
        return StellarSdk.nativeToScVal(arg.value === "true", { type: "bool" });
      default:
        throw new Error(`Unsupported argument type: ${arg.type}`);
    }
  });

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .addOperation(contract.call(functionName, ...scArgs))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  prepared.sign(keypair);

  const response = await server.sendTransaction(prepared);

  return {
    hash: response.hash,
    status: response.status,
    latestLedger: response.latestLedger,
  };
}

export function normalizeContractValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(normalizeContractValue);

  if (value && typeof value === "object") {
    if (
      typeof value.toString === "function" &&
      value.constructor?.name === "Address"
    ) {
      return value.toString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        normalizeContractValue(entry),
      ]),
    );
  }

  return value;
}
