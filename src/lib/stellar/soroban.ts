import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORKS, getServer, getSorobanServer, type NetworkName } from './networks.js';
import { isValidContractId, isValidPublicKey } from './addresses.js';

// ─── Contract ─────────────────────────────────────────────────────────────────

export async function fetchContractInfo(
  contractId: string,
  network: NetworkName = 'testnet'
): Promise<StellarSdk.rpc.Api.LedgerEntryResult> {
  const server = getSorobanServer(network);
  try {
    const instance = await server.getContractData(
      contractId,
      StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
      StellarSdk.rpc.Durability.Persistent
    );
    return instance;
  } catch (e) {
    throw new Error(`Contract not found: ${(e as Error).message}`);
  }
}

export async function fetchContractData(
  contractId: string,
  key: StellarSdk.xdr.ScVal | string,
  network: NetworkName = 'testnet',
  durability: StellarSdk.rpc.Durability = StellarSdk.SorobanRpc.Durability.Persistent
): Promise<any> {
  const server = getSorobanServer(network);

  let scValKey;
  if (typeof key === 'string') {
    try {
      // Try to parse from JSON first
      const parsed = JSON.parse(key);
      scValKey = StellarSdk.nativeToScVal(parsed);
    } catch {
      // If JSON fails, treat as string
      scValKey = StellarSdk.nativeToScVal(key, { type: 'string' });
    }
  } else {
    scValKey = key;
  }

  try {
    const result = await server.getContractData(contractId, scValKey, durability);
    return {
      key: StellarSdk.scValToNative(result.key),
      value: StellarSdk.scValToNative(result.val),
      xdr: result.xdr,
    };
  } catch (e) {
    throw new Error(`Failed to fetch contract data: ${(e as Error).message}`);
  }
}

export interface ContractInvocationArg {
  type: 'string' | 'int' | 'address' | 'bool';
  value: string;
}

export interface SerializedLedgerKey {
  type: string;
  xdr: string;
}

export interface SerializedContractEvent {
  inSuccessfulContractCall: boolean;
  type: string;
  contractId: string | null;
  topics: unknown[];
  value: unknown;
}

export interface ContractSimulationResult {
  xdr: string;
  latestLedger: number;
  cost?: StellarSdk.rpc.Api.Cost;
  result: unknown;
  events: SerializedContractEvent[];
  footprint: {
    readOnly: SerializedLedgerKey[];
    readWrite: SerializedLedgerKey[];
    minResourceFee: string;
  } | null;
}

export interface ContractSubmitResult {
  hash: string;
  status: StellarSdk.rpc.Api.SendTransactionStatus;
  errorResult: string | null;
  diagnosticEvents: string[];
}

function getLedgerKeyType(key: StellarSdk.xdr.LedgerKey): string {
  const kind = key.switch();
  return kind?.name || kind?.toString?.() || 'unknown';
}

export function serializeLedgerKey(key: StellarSdk.xdr.LedgerKey): SerializedLedgerKey {
  return {
    type: getLedgerKeyType(key),
    xdr: key.toXDR('base64'),
  };
}

function serializeScVal(value: StellarSdk.xdr.ScVal): unknown {
  try {
    return StellarSdk.scValToNative(value);
  } catch {
    return value.toXDR('base64');
  }
}

export function serializeDiagnosticEvent(event: StellarSdk.xdr.DiagnosticEvent): SerializedContractEvent {
  const contractEvent = event.event();
  const body = contractEvent.body().v0();
  const contractId = contractEvent.contractId();

  return {
    inSuccessfulContractCall: event.inSuccessfulContractCall(),
    type: contractEvent.type().name || contractEvent.type().toString(),
    contractId: contractId
      ? StellarSdk.Address.fromScAddress(
          contractId as unknown as StellarSdk.xdr.ScAddress
        ).toString()
      : null,
    topics: body.topics().map(serializeScVal),
    value: serializeScVal(body.data()),
  };
}

function parseContractArgument(arg: ContractInvocationArg, index: number): StellarSdk.xdr.ScVal {
  const trimmedValue = arg.value?.trim?.() ?? '';

  if (!trimmedValue) {
    throw new Error(`Argument ${index + 1} is empty`);
  }

  switch (arg.type) {
    case 'string':
      return StellarSdk.nativeToScVal(trimmedValue, { type: 'string' });
    case 'int': {
      let parsed: bigint;
      try {
        parsed = BigInt(trimmedValue);
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid integer`);
      }
      return StellarSdk.nativeToScVal(parsed, { type: 'i128' });
    }
    case 'address':
      try {
        return StellarSdk.Address.fromString(trimmedValue).toScVal();
      } catch {
        throw new Error(`Argument ${index + 1} must be a valid Stellar address`);
      }
    case 'bool':
      if (trimmedValue !== 'true' && trimmedValue !== 'false') {
        throw new Error(`Argument ${index + 1} must be true or false`);
      }
      return StellarSdk.nativeToScVal(trimmedValue === 'true', { type: 'bool' });
    default:
      throw new Error(`Unsupported argument type: ${arg.type}`);
  }
}

interface BuildContractInvocationParams {
  contractId: string;
  functionName: string;
  args?: ContractInvocationArg[];
  sourceAccount: string;
  network?: NetworkName;
}

async function buildContractInvocationTransaction(
  params: BuildContractInvocationParams
): Promise<StellarSdk.Transaction> {
  const { contractId, functionName, args = [], sourceAccount, network = 'testnet' } = params;

  if (!isValidContractId(contractId)) {
    throw new Error('Invalid contract address');
  }

  if (!functionName.trim()) {
    throw new Error('Function name is required');
  }

  if (!isValidPublicKey(sourceAccount)) {
    throw new Error('A valid source account is required');
  }

  const horizon = getServer(network);
  const account = await horizon.loadAccount(sourceAccount);
  const contract = new StellarSdk.Contract(contractId.trim());
  const parsedArgs = args.map(parseContractArgument);

  return new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  })
    .setTimeout(30)
    .addOperation(contract.call(functionName.trim(), ...parsedArgs))
    .build();
}

export async function simulateContractCall(
  params: BuildContractInvocationParams
): Promise<ContractSimulationResult> {
  const { network = 'testnet' } = params;
  const server = getSorobanServer(network);
  const transaction = await buildContractInvocationTransaction(params);
  const simulation = await server.simulateTransaction(transaction);

  if ('error' in simulation && simulation.error) {
    throw new Error(simulation.error);
  }

  const successfulSimulation = simulation as Exclude<
    StellarSdk.rpc.Api.SimulateTransactionResponse,
    StellarSdk.rpc.Api.SimulateTransactionErrorResponse
  >;

  const footprint = successfulSimulation.transactionData
    ? {
        readOnly: successfulSimulation.transactionData.getReadOnly().map(serializeLedgerKey),
        readWrite: successfulSimulation.transactionData.getReadWrite().map(serializeLedgerKey),
        minResourceFee: successfulSimulation.minResourceFee,
      }
    : null;

  return {
    xdr: transaction.toXDR(),
    latestLedger: successfulSimulation.latestLedger,
    cost: successfulSimulation.cost,
    result: successfulSimulation.result ? serializeScVal(successfulSimulation.result.retval) : null,
    events: (successfulSimulation.events || []).map(serializeDiagnosticEvent),
    footprint,
  };
}

interface InvokeContractParams {
  contractId: string;
  functionName: string;
  args?: ContractInvocationArg[];
  secretKey: string;
  network?: NetworkName;
}

export async function invokeContract(params: InvokeContractParams): Promise<ContractSubmitResult> {
  const { contractId, functionName, args = [], secretKey, network = 'testnet' } = params;

  if (network !== 'testnet') {
    throw new Error('Transaction submission is only enabled on Testnet');
  }

  if (!secretKey.trim()) {
    throw new Error('Secret key is required to submit a transaction');
  }

  // Guard: contract invocation submits to the network — block offline unless queued.
  const { isWriteSafe } = await import('../offlineReadOnly');
  if (!isWriteSafe('contract invocation')) {
    const { OfflineWriteError } = await import('../offlineReadOnly');
    throw new OfflineWriteError('contract invocation');
  }

  let keypair: StellarSdk.Keypair;
  try {
    keypair = StellarSdk.Keypair.fromSecret(secretKey.trim());
  } catch {
    throw new Error('Invalid secret key');
  }

  const sourceAccount = keypair.publicKey();
  const server = getSorobanServer(network);
  const transaction = await buildContractInvocationTransaction({
    contractId,
    functionName,
    args,
    sourceAccount,
    network,
  });
  const prepared = await server.prepareTransaction(transaction);

  prepared.sign(keypair);

  const response = await server.sendTransaction(prepared);

  return {
    hash: response.hash,
    status: response.status,
    errorResult: response.errorResult ? response.errorResult.toXDR('base64') : null,
    diagnosticEvents: (response.diagnosticEvents || []).map((event) => event.toXDR('base64')),
  };
}
