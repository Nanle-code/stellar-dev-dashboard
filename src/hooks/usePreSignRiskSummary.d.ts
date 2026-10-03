/**
 * Type declarations for the pre-sign risk review hook (#982).
 *
 * The implementation is plain JS and the project runs TypeScript with
 * `checkJs: false`, so without this file `beginReview` is inferred as returning
 * `Promise<void>` and callers cannot compare its result against the review
 * outcomes. These signatures must stay in step with the JSDoc in
 * `usePreSignRiskSummary.js`.
 */

export type ReviewOutcome = 'shown' | 'pass' | 'error';

export const REVIEW_SHOWN: 'shown';
export const REVIEW_PASS: 'pass';
export const REVIEW_ERROR: 'error';

/** Mirrors the `RiskSummary` shape returned by `computeRiskSummary`. */
export interface RiskSummary {
  overallSeverity: 'info' | 'warning' | 'danger';
  requiresAcknowledgement: boolean;
  sourceAccount: string | null;
  network: string;
  operationCount: number;
  operations: Array<{
    index: number;
    type: string;
    severity: 'info' | 'warning' | 'danger';
    label: string;
    detail: string;
    matchedRuleIds: string[];
  }>;
  flaggedContracts: string[];
  notes: string[];
  simulation: { available: boolean } | null;
}

export interface ReviewOptions {
  network?: string;
  account?: unknown;
  loadAccount?: (accountId: string, network: string) => Promise<unknown>;
  simulate?: (transaction: unknown, network: string) => Promise<unknown>;
  knownContracts?: string[];
}

export interface ReviewResult {
  summary: RiskSummary | null;
  transaction: unknown | null;
  error: string | null;
}

export function parseTransactionXdr(xdr: string, network: string): unknown;
export function reviewTransaction(xdr: string, options?: ReviewOptions): Promise<ReviewResult>;
export function trustContract(contractId: string): Promise<string[]>;
export function usePreSignRiskSummary(): {
  summary: RiskSummary | null;
  pendingXdr: string | null;
  reviewing: boolean;
  reviewError: string | null;
  knownContracts: string[];
  beginReview: (xdr: string, networkOverride?: string) => Promise<ReviewOutcome>;
  cancelReview: () => void;
  onAcknowledged: (signFn: () => Promise<unknown>) => Promise<void>;
  onTrustContract: () => Promise<void>;
};
