import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORKS, getServer, type NetworkName } from './networks.js';
import { isValidPublicKey } from './addresses.js';
import { validateMemo } from '../validation';

// ─── Transaction builder ──────────────────────────────────────────────────────

export type OperationType = 'payment' | 'createAccount';

export interface PaymentOperation {
  type: 'payment';
  destination: string;
  amount: string;
}

export interface CreateAccountOperation {
  type: 'createAccount';
  destination: string;
  startingBalance: string;
}

export interface InvokeHostFunctionOperation {
  type: 'invokeHostFunction';
  [key: string]: any;
}

export type BuilderOperation =
  | PaymentOperation
  | CreateAccountOperation
  | InvokeHostFunctionOperation;

export interface TimeBounds {
  minTime?: string | number;
  maxTime?: string | number;
}

export interface TransactionPreconditions {
  ledgerBounds?: {
    minLedger?: number | string;
    maxLedger?: number | string;
  };
  minSequence?: number | string;
  minSequenceAge?: number | string;
  minSequenceLedgerGap?: number | string;
  extraSigners?: string[];
}

export interface BuildTransactionParams {
  sourceAccount: string;
  operations: BuilderOperation[];
  memo?: string;
  baseFee: number;
  timeBounds: TimeBounds;
  preconditions?: TransactionPreconditions;
  network: NetworkName;
}

export async function buildTransaction(
  params: BuildTransactionParams
): Promise<StellarSdk.Transaction | StellarSdk.FeeBumpTransaction> {
  const { sourceAccount, operations, memo, baseFee, timeBounds, preconditions, network } = params;

  // ── Fee-bump shortcut ──────────────────────────────────────────────────────
  // A fee-bump must be the only operation and is built entirely from its own
  // params — it doesn't need a source account or sequence number load.
  if (operations.length === 1 && operations[0].type === 'feeBump') {
    const op = operations[0] as any;
    const { feeSource, baseFee: fbFee, innerTransaction } = op;

    if (!feeSource || !isValidPublicKey(feeSource)) {
      throw new Error('Fee-bump: feeSource must be a valid Stellar public key.');
    }
    const fee = parseInt(fbFee, 10);
    if (!Number.isFinite(fee) || fee <= 0) {
      throw new Error('Fee-bump: baseFee must be a positive integer (stroops).');
    }
    if (!innerTransaction || typeof innerTransaction !== 'string' || innerTransaction.trim() === '') {
      throw new Error('Fee-bump: innerTransaction XDR is required.');
    }

    try {
      const innerTx = new StellarSdk.Transaction(innerTransaction.trim(), NETWORKS[network].passphrase);
      return StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        feeSource,
        fee.toString(),
        innerTx,
        NETWORKS[network].passphrase,
      );
    } catch (err) {
      throw new Error(`Fee-bump: failed to wrap inner transaction — ${(err as Error).message}`);
    }
  }

  if (operations.some((op) => op.type === 'feeBump')) {
    throw new Error('A fee-bump operation must be the only operation in the transaction.');
  }
  // ──────────────────────────────────────────────────────────────────────────

  const server = getServer(network);
  const account = await server.loadAccount(sourceAccount);

  const txBuilder = new StellarSdk.TransactionBuilder(account, {
    fee: baseFee.toString(),
    networkPassphrase: NETWORKS[network].passphrase,
  });

  if (timeBounds.minTime || timeBounds.maxTime) {
    txBuilder.setTimeout(
      timeBounds.maxTime ? parseInt(String(timeBounds.maxTime)) - Math.floor(Date.now() / 1000) : 0
    );
  }

  if (preconditions) {
    if (preconditions.ledgerBounds) {
      const minLedger = parseInt(String(preconditions.ledgerBounds.minLedger || 0), 10);
      const maxLedger = parseInt(String(preconditions.ledgerBounds.maxLedger || 0), 10);
      txBuilder.setLedgerbounds(minLedger, maxLedger);
    }

    if (preconditions.minSequence !== undefined && preconditions.minSequence !== '') {
      txBuilder.setMinAccountSequence(parseInt(String(preconditions.minSequence), 10));
    }

    if (preconditions.minSequenceAge !== undefined && preconditions.minSequenceAge !== '') {
      txBuilder.setMinAccountSequenceAge(parseInt(String(preconditions.minSequenceAge), 10));
    }

    if (preconditions.minSequenceLedgerGap !== undefined && preconditions.minSequenceLedgerGap !== '') {
      txBuilder.setMinAccountSequenceLedgerGap(parseInt(String(preconditions.minSequenceLedgerGap), 10));
    }

    if (preconditions.extraSigners && preconditions.extraSigners.length > 0) {
      txBuilder.setExtraSigners(preconditions.extraSigners);
    }
  }

  operations.forEach((op) => {
    if (op.type === 'payment') {
      txBuilder.addOperation(
        StellarSdk.Operation.payment({
          destination: op.destination,
          asset: StellarSdk.Asset.native(),
          amount: op.amount,
        })
      );
    } else if (op.type === 'createAccount') {
      txBuilder.addOperation(
        StellarSdk.Operation.createAccount({
          destination: op.destination,
          startingBalance: op.startingBalance,
        })
      );
    } else if (op.type === 'invokeHostFunction') {
      txBuilder.addOperation(
        StellarSdk.Operation.invokeHostFunction({
          func: (op as any).func,
          auth: (op as any).auth || [],
        })
      );
    }
  });

  if (memo) {
    const memoCheck = validateMemo(memo, 'text');
    if (!memoCheck.valid) {
      throw new Error(memoCheck.errors[0]);
    }
    txBuilder.addMemo(StellarSdk.Memo.text(memo));
  }

  return txBuilder.build();
}
