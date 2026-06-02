import * as StellarSdk from "@stellar/stellar-sdk";
import {
  getSorobanServer,
  getServer,
  NETWORKS,
  isValidContractId,
  isValidPublicKey,
} from "./stellar";

export async function parseContractWasm(contractId, network = "testnet") {
  const server = getSorobanServer(network);

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

    return {
      found: true,
      contractId,
      ledgerEntry: response.entries[0].xdr,
    };
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

  // Parse arguments
  const scArgs = args.map((arg, index) => {
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

  // Build transaction
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .addOperation(contract.call(functionName, ...scArgs))
    .setTimeout(30)
    .build();

  // Prepare and sign
  const prepared = await server.prepareTransaction(transaction);
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  prepared.sign(keypair);

  // Submit
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
