
import * as StellarSdk from "@stellar/stellar-sdk";
import { getServer, NETWORKS, isValidPublicKey } from "./stellar";
import { createOperation, buildTransaction, signAndSubmitTransaction } from "./transactionBuilder";

export interface BulkOperationStatus {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "rollback";
  account: string;
  error?: string;
  result?: { hash: string; ledger: number; successful: boolean };
  rollbackResult?: { hash: string; ledger: number; successful: boolean };
  rollbackError?: string;
}

export interface BulkPaymentConfig {
  sourceAccount: string;
  payments: Array<{
    destination: string;
    amount: string;
    assetType: "native" | "credit_alphanum4" | "credit_alphanum12";
    assetCode?: string;
    assetIssuer?: string;
  }>;
  secretKey: string;
  network?: string;
  concurrency?: number;
  onProgress?: (status: BulkOperationStatus[]) => void;
}

export interface BulkTrustlineConfig {
  sourceAccount: string;
  trustlines: Array<{
    assetCode: string;
    assetIssuer: string;
    limit?: string;
  }>;
  secretKey: string;
  network?: string;
  concurrency?: number;
  onProgress?: (status: BulkOperationStatus[]) => void;
}

export interface RollbackConfig {
  sourceAccount: string;
  secretKey: string;
  network?: string;
  concurrency?: number;
  onProgress?: (statuses: BulkOperationStatus[]) => void;
}

export class BulkOperationManager {
  private async processInParallel<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<BulkOperationStatus>,
    concurrency: number = 5,
    onProgress?: (statuses: BulkOperationStatus[]) => void
  ): Promise<BulkOperationStatus[]> {
    const statuses: BulkOperationStatus[] = items.map((_, index) => ({
      id: `op-${index}`,
      status: "pending" as const,
      account: "",
    }));

    let inProgress = 0;
    let nextIndex = 0;

    const processNext = async () => {
      while (nextIndex < items.length) {
        if (inProgress >= concurrency) {
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        const currentIndex = nextIndex++;
        inProgress++;

        try {
          statuses[currentIndex].status = "in_progress";
          onProgress?.([...statuses]);

          const result = await processor(items[currentIndex], currentIndex);
          statuses[currentIndex] = result;
        } catch (error) {
          statuses[currentIndex] = {
            id: `op-${currentIndex}`,
            status: "failed",
            account: "",
            error: (error as Error).message,
          };
        } finally {
          inProgress--;
          onProgress?.([...statuses]);
        }
      }
    };

    const workers = Array.from({ length: concurrency }, processNext);
    await Promise.all(workers);

    return statuses;
  }

  async processBulkPayments(config: BulkPaymentConfig): Promise<BulkOperationStatus[]> {
    const {
      sourceAccount,
      payments,
      secretKey,
      network = "testnet",
      concurrency = 5,
      onProgress,
    } = config;

    return this.processInParallel(
      payments,
      async (payment, index) => {
        try {
          const transaction = await buildTransaction({
            sourceAccount,
            operations: [
              {
                type: "payment",
                params: payment,
              },
            ],
            network,
          });

          const result = await signAndSubmitTransaction(transaction, secretKey, network);

          return {
            id: `op-${index}`,
            status: "completed",
            account: payment.destination,
            result,
          };
        } catch (error) {
          return {
            id: `op-${index}`,
            status: "failed",
            account: payment.destination,
            error: (error as Error).message,
          };
        }
      },
      concurrency,
      onProgress
    );
  }

  async processBulkTrustlines(config: BulkTrustlineConfig): Promise<BulkOperationStatus[]> {
    const {
      sourceAccount,
      trustlines,
      secretKey,
      network = "testnet",
      concurrency = 5,
      onProgress,
    } = config;

    return this.processInParallel(
      trustlines,
      async (trustline, index) => {
        try {
          const transaction = await buildTransaction({
            sourceAccount,
            operations: [
              {
                type: "changeTrust",
                params: trustline,
              },
            ],
            network,
          });

          const result = await signAndSubmitTransaction(transaction, secretKey, network);

          return {
            id: `op-${index}`,
            status: "completed",
            account: sourceAccount,
            result,
          };
        } catch (error) {
          return {
            id: `op-${index}`,
            status: "failed",
            account: sourceAccount,
            error: (error as Error).message,
          };
        }
      },
      concurrency,
      onProgress
    );
  }

  async rollbackBulkPayments(
    originalPayments: BulkPaymentConfig["payments"],
    originalResults: BulkOperationStatus[],
    config: RollbackConfig
  ): Promise<BulkOperationStatus[]> {
    const {
      sourceAccount,
      secretKey,
      network = "testnet",
      concurrency = 5,
      onProgress,
    } = config;

    const rollbackItems = originalPayments.map((payment, index) => ({
      payment,
      originalResult: originalResults[index],
    }));

    return this.processInParallel(
      rollbackItems,
      async (item, index) => {
        const { payment, originalResult } = item;
        const status = { ...originalResult };

        if (status.status !== "completed" || !status.result?.successful) {
          return status;
        }

        try {
          status.status = "rollback";
          onProgress?.([
            ...originalResults.slice(0, index),
            status,
            ...originalResults.slice(index + 1),
          ]);

          // Reverse the payment: send back from destination to source
          const reverseTransaction = await buildTransaction({
            sourceAccount: payment.destination,
            operations: [
              {
                type: "payment",
                params: {
                  destination: sourceAccount,
                  amount: payment.amount,
                  assetType: payment.assetType,
                  assetCode: payment.assetCode,
                  assetIssuer: payment.assetIssuer,
                },
              },
            ],
            network,
          });

          const rollbackResult = await signAndSubmitTransaction(
            reverseTransaction,
            secretKey,
            network
          );

          status.rollbackResult = rollbackResult;
          return status;
        } catch (error) {
          status.rollbackError = (error as Error).message;
          return status;
        }
      },
      concurrency,
      onProgress
    );
  }

  async rollbackBulkTrustlines(
    originalTrustlines: BulkTrustlineConfig["trustlines"],
    originalResults: BulkOperationStatus[],
    config: RollbackConfig
  ): Promise<BulkOperationStatus[]> {
    const {
      sourceAccount,
      secretKey,
      network = "testnet",
      concurrency = 5,
      onProgress,
    } = config;

    const rollbackItems = originalTrustlines.map((trustline, index) => ({
      trustline,
      originalResult: originalResults[index],
    }));

    return this.processInParallel(
      rollbackItems,
      async (item, index) => {
        const { trustline, originalResult } = item;
        const status = { ...originalResult };

        if (status.status !== "completed" || !status.result?.successful) {
          return status;
        }

        try {
          status.status = "rollback";
          onProgress?.([
            ...originalResults.slice(0, index),
            status,
            ...originalResults.slice(index + 1),
          ]);

          // Rollback by setting limit to 0
          const rollbackTransaction = await buildTransaction({
            sourceAccount,
            operations: [
              {
                type: "changeTrust",
                params: {
                  assetCode: trustline.assetCode,
                  assetIssuer: trustline.assetIssuer,
                  limit: "0",
                },
              },
            ],
            network,
          });

          const rollbackResult = await signAndSubmitTransaction(
            rollbackTransaction,
            secretKey,
            network
          );

          status.rollbackResult = rollbackResult;
          return status;
        } catch (error) {
          status.rollbackError = (error as Error).message;
          return status;
        }
      },
      concurrency,
      onProgress
    );
  }
}

export const bulkOperationManager = new BulkOperationManager();
