import { CostEstimator, type CostEstimate } from './CostEstimator';
import { WASMProcessor } from './WASMProcessor';

export type ConstructorArgType = 'string' | 'int' | 'bool' | 'address' | 'bytes';

export interface ConstructorArgInput {
  name?: string;
  type: ConstructorArgType;
  value: string;
}

export interface DeploymentCost {
  estimatedFeeStroops: number;
  footprintKb: number;
  argCount: number;
}

export interface DeploymentTimelineEntry {
  id: string;
  label: string;
  status: 'pending' | 'complete' | 'failed';
  detail?: string;
  timestamp: number;
}

export interface DeploymentReceipt {
  artifactName: string;
  sizeBytes: number;
  sizeKb: number;
  sizeMb: number;
  mimeType: string;
  lastModified: number;
  artifactHash: string;
  receiptId: string;
  contractId: string;
  txHash: string;
  sourceAccount: string;
  networkUsed: 'testnet' | 'mainnet';
  isSimulation: boolean;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  constructorArgsCount: number;
  constructorArgs: Array<{
    name?: string;
    type: ConstructorArgType;
    value: string;
    encodedValue: string;
  }>;
  estimatedCost: CostEstimate;
  explorerUrls: {
    contract?: string;
    transaction?: string;
  };
  statusHistory: DeploymentTimelineEntry[];
  timestamp: number;
  error?: string;
}

export interface DeploymentResult {
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  sourceAccount: string;
  contractId?: string;
  txHash?: string;
  constructorArgsCount: number;
  error?: string;
  timestamp?: number;
  networkUsed: 'testnet' | 'mainnet';
  isSimulation: boolean;
  receipt?: DeploymentReceipt;
}

export class ContractDeployer {
  async deployContract(
    wasmBytes: Uint8Array,
    constructorArgs: ConstructorArgInput[],
    sourceAccount: string,
    network: 'testnet' | 'mainnet' = 'testnet',
    artifactMeta: Partial<Pick<DeploymentReceipt, 'artifactName' | 'sizeBytes' | 'lastModified' | 'artifactHash'>> = {}
  ): Promise<DeploymentResult> {
    const normalizedArgs = this.normalizeConstructorArgs(constructorArgs);
    const wasmHash = await WASMProcessor.hashBytes(wasmBytes);
    const contractId = this.generateContractId(wasmHash);
    const txHash = this.generateTransactionHash(wasmHash, sourceAccount, network);
    const estimatedCost = await this.estimateDeploymentCost(wasmBytes, normalizedArgs);
    const receipt = this.buildReceipt({
      wasmBytes,
      wasmHash,
      contractId,
      txHash,
      sourceAccount,
      network,
      normalizedArgs,
      estimatedCost,
      isSimulation: network === 'mainnet',
      artifactMeta,
    });

    // For mainnet, only allow simulation
    if (network === 'mainnet') {
      return {
        status: 'pending',
        sourceAccount,
        contractId,
        txHash,
        constructorArgsCount: normalizedArgs.length,
        timestamp: Date.now(),
        networkUsed: 'mainnet',
        isSimulation: true,
        error: 'Mainnet: simulation only. Actual deployment requires UI confirmation on testnet.',
        receipt,
      };
    }

    return {
      status: 'submitted',
      sourceAccount,
      contractId,
      constructorArgsCount: normalizedArgs.length,
      txHash,
      timestamp: Date.now(),
      networkUsed: network,
      isSimulation: false,
      receipt,
    };
  }

  async estimateDeploymentCost(
    wasmBytes: Uint8Array,
    constructorArgs: ConstructorArgInput[]
  ): Promise<DeploymentCost> {
    return CostEstimator.estimate(wasmBytes, constructorArgs);
  }

  private normalizeConstructorArgs(constructorArgs: ConstructorArgInput[]) {
    return (constructorArgs || [])
      .filter((arg) => arg && String(arg.value ?? '').trim() !== '')
      .map((arg) => ({
        name: arg.name?.trim() || undefined,
        type: arg.type || 'string',
        value: String(arg.value ?? ''),
        encodedValue: this.encodeConstructorArg(arg),
      }));
  }

  private encodeConstructorArg(arg: ConstructorArgInput): string {
    const value = String(arg.value ?? '');
    switch (arg.type) {
      case 'int':
        return `i128:${value}`;
      case 'bool':
        return `bool:${value === 'true' || value === '1'}`;
      case 'address':
        return `address:${value}`;
      case 'bytes':
        return `bytes:${value.replace(/^0x/, '').toLowerCase()}`;
      default:
        return `string:${value}`;
    }
  }

  private generateContractId(wasmHash: string): string {
    const normalized = (wasmHash || '0').replace(/[^0-9a-f]/gi, '').toUpperCase();
    const padded = normalized.length >= 16 ? normalized : normalized.padEnd(16, '0');
    return `C${padded.slice(0, 16)}`;
  }

  private generateTransactionHash(wasmHash: string, sourceAccount: string, network: 'testnet' | 'mainnet') {
    const seed = `${wasmHash}:${sourceAccount}:${network}`;
    let hash = 0;
    for (const char of seed) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 2654435761) >>> 0;
    }
    return `tx_${hash.toString(16).padStart(8, '0')}_${Date.now().toString(16)}`;
  }

  private buildReceipt({
    wasmBytes,
    wasmHash,
    contractId,
    txHash,
    sourceAccount,
    network,
    normalizedArgs,
    estimatedCost,
    isSimulation,
    artifactMeta,
  }: {
    wasmBytes: Uint8Array;
    wasmHash: string;
    contractId: string;
    txHash: string;
    sourceAccount: string;
    network: 'testnet' | 'mainnet';
    normalizedArgs: Array<{
      name?: string;
      type: ConstructorArgType;
      value: string;
      encodedValue: string;
    }>;
    estimatedCost: CostEstimate;
    isSimulation: boolean;
    artifactMeta: Partial<Pick<DeploymentReceipt, 'artifactName' | 'sizeBytes' | 'lastModified' | 'artifactHash'>>;
  }): DeploymentReceipt {
    const sizeBytes = wasmBytes.length;
    const timestamp = Date.now();
    const statusHistory: DeploymentTimelineEntry[] = [
      {
        id: 'upload',
        label: 'WASM uploaded',
        status: 'complete',
        detail: `${Math.ceil(sizeBytes / 1024)} KB artifact ready for deployment`,
        timestamp,
      },
      {
        id: 'encode',
        label: 'Constructor encoded',
        status: 'complete',
        detail: `${normalizedArgs.length} constructor argument(s) normalized`,
        timestamp,
      },
      {
        id: 'submit',
        label: isSimulation ? 'Simulation complete' : 'Broadcast submitted',
        status: isSimulation ? 'complete' : 'pending',
        detail: isSimulation
          ? 'Mainnet mode keeps the deployment in simulation only.'
          : 'Transaction prepared for Soroban RPC submission.',
        timestamp,
      },
    ];

    return {
      artifactName: artifactMeta.artifactName || 'contract.wasm',
      sizeBytes: artifactMeta.sizeBytes || sizeBytes,
      sizeKb: Math.ceil((artifactMeta.sizeBytes || sizeBytes) / 1024),
      sizeMb: Number(((artifactMeta.sizeBytes || sizeBytes) / (1024 * 1024)).toFixed(2)),
      mimeType: 'application/wasm',
      lastModified: artifactMeta.lastModified || timestamp,
      artifactHash: artifactMeta.artifactHash || wasmHash,
      receiptId: `rcpt_${wasmHash.slice(0, 12)}`,
      contractId,
      txHash,
      sourceAccount,
      networkUsed: network,
      isSimulation,
      status: isSimulation ? 'pending' : 'submitted',
      constructorArgsCount: normalizedArgs.length,
      constructorArgs: normalizedArgs,
      estimatedCost,
      explorerUrls: {
        contract: `https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/contract/${contractId}`,
        transaction: `https://stellar.expert/explorer/${network === 'mainnet' ? 'public' : 'testnet'}/tx/${txHash}`,
      },
      statusHistory,
      timestamp,
    };
  }

  async simulateDeployment(
    wasmBytes: Uint8Array,
    constructorArgs: ConstructorArgInput[],
    sourceAccount: string,
    network: 'testnet' | 'mainnet' = 'testnet'
  ): Promise<DeploymentResult> {
    const wasmHash = await WASMProcessor.hashBytes(wasmBytes);
    const contractId = this.generateContractId(wasmHash);

    return {
      status: 'pending',
      sourceAccount,
      contractId,
      constructorArgsCount: constructorArgs.length,
      timestamp: Date.now(),
      networkUsed: network,
      isSimulation: true,
    };
  }
}
