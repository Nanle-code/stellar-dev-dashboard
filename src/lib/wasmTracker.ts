import { generateId } from './notifications';
import { addWasmHashRecord } from './storage';

/**
 * Track a WASM hash for a contract upgrade transaction.
 * This function should be called when a contract upgrade is detected or performed.
 * 
 * @param {Object} params - The upgrade parameters
 * @param {string} params.contractId - The contract ID being upgraded
 * @param {string} params.wasmHash - The new WASM hash
 * @param {string} params.transactionHash - The transaction hash of the upgrade
 * @param {string} params.authorization - Authorization requirements for the upgrade
 * @param {string} params.network - The network (testnet, mainnet, etc.)
 * @returns {Promise<void>}
 */
export async function trackWasmHash({
  contractId,
  wasmHash,
  transactionHash,
  authorization = 'none',
  network = 'testnet',
}: {
  contractId: string;
  wasmHash: string;
  transactionHash: string;
  authorization?: string;
  network?: string;
}): Promise<void> {
  try {
    // Validate required parameters
    if (!contractId || typeof contractId !== 'string') {
      throw new Error('Invalid contractId: must be a non-empty string');
    }
    if (!wasmHash || typeof wasmHash !== 'string') {
      throw new Error('Invalid wasmHash: must be a non-empty string');
    }
    if (!transactionHash || typeof transactionHash !== 'string') {
      throw new Error('Invalid transactionHash: must be a non-empty string');
    }
    if (!network || typeof network !== 'string') {
      throw new Error('Invalid network: must be a non-empty string');
    }

    const record = {
      id: generateId(),
      contractId,
      wasmHash,
      transactionHash,
      authorization,
      timestamp: Date.now(),
      network,
    };

    await addWasmHashRecord(record);
  } catch (error) {
    console.error('Failed to track WASM hash:', error);
    // Don't throw - tracking failures shouldn't break the main flow
  }
}

/**
 * Extract WASM hash from a Soroban upgrade transaction.
 * This is a helper function to parse upgrade transactions and extract relevant information.
 * 
 * @param {Object} transaction - The transaction object from Stellar SDK
 * @returns {Object|null} - Extracted WASM information or null if not an upgrade transaction
 */
export function extractWasmFromUpgradeTransaction(transaction: any): {
  wasmHash: string | null;
  contractId: string | null;
  authorization: string;
} | null {
  try {
    if (!transaction || !transaction.operations) {
      return null;
    }

    // Look for invoke_host_function operations which are used for contract upgrades
    const upgradeOp = transaction.operations.find((op: any) => 
      op.type === 'invoke_host_function' || 
      op.body?.invoke_host_function
    );

    if (!upgradeOp) {
      return null;
    }

    // Extract WASM hash from the operation
    // This is a simplified extraction - actual implementation depends on Stellar SDK structure
    let wasmHash = null;
    let contractId = null;
    let authorization = 'none';

    // Try to extract from different possible locations based on SDK version
    if (upgradeOp.body?.invoke_host_function?.host_function?.type === 'upload_contract_wasm') {
      wasmHash = upgradeOp.body.invoke_host_function.host_function.wasm?.hash;
    } else if (upgradeOp.wasm_hash) {
      wasmHash = upgradeOp.wasm_hash;
    }

    // Extract contract ID if present
    if (upgradeOp.body?.invoke_host_function?.host_function?.contract_id) {
      contractId = upgradeOp.body.invoke_host_function.host_function.contract_id;
    } else if (upgradeOp.contract_id) {
      contractId = upgradeOp.contract_id;
    }

    // Determine authorization requirements
    if (upgradeOp.auth || upgradeOp.authorizations) {
      authorization = upgradeOp.auth || upgradeOp.authorizations.join(',') || 'custom';
    }

    if (!wasmHash) {
      return null;
    }

    return {
      wasmHash,
      contractId,
      authorization,
    };
  } catch (error) {
    console.error('Failed to extract WASM from transaction:', error);
    return null;
  }
}

/**
 * Check if a transaction is a contract upgrade transaction.
 * 
 * @param {Object} transaction - The transaction object to check
 * @returns {boolean} - True if this is a contract upgrade transaction
 */
export function isContractUpgradeTransaction(transaction: any): boolean {
  if (!transaction || !transaction.operations) {
    return false;
  }

  return transaction.operations.some((op: any) => 
    op.type === 'invoke_host_function' || 
    op.body?.invoke_host_function?.host_function?.type === 'upload_contract_wasm' ||
    op.type === 'restore_contract' ||
    op.type === 'extend_contract'
  );
}
