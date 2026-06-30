/**
 * Advanced transaction validation (#111).
 *
 * Provides per-operation validation rules beyond the basic checks in
 * transactionBuilder.js, returning structured error objects that the
 * Builder UI can surface inline next to the relevant field.
 */

import { validateStellarAddress } from "../lib/validation";

export interface FieldError {
  field: string;
  message: string;
}

export interface OperationValidationResult {
  operationIndex: number;
  errors: FieldError[];
}

export interface TransactionValidationResult {
  valid: boolean;
  operationErrors: OperationValidationResult[];
  globalErrors: string[];
}

function isPositiveAmount(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const n = parseFloat(String(value));
  return Number.isFinite(n) && n > 0;
}

function isNonNegativeAmount(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const n = parseFloat(String(value));
  return Number.isFinite(n) && n >= 0;
}

function isValidAssetCode(code: unknown): boolean {
  if (typeof code !== "string") return false;
  return /^[A-Z0-9]{1,12}$/.test(code);
}

function validatePayment(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  const destResult = validateStellarAddress(params.destination);
  if (!destResult.valid) errors.push({ field: "destination", message: destResult.errors[0] });
  if (!isPositiveAmount(params.amount))
    errors.push({ field: "amount", message: "Amount must be a positive number." });
  if (params.assetType !== "native") {
    if (!isValidAssetCode(params.assetCode))
      errors.push({ field: "assetCode", message: "Asset code must be 1–12 uppercase letters/digits." });
    const issuerResult = validateStellarAddress(params.assetIssuer);
    if (!issuerResult.valid)
      errors.push({ field: "assetIssuer", message: issuerResult.errors[0] });
  }
  return errors;
}

function validateCreateAccount(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  const destResult = validateStellarAddress(params.destination);
  if (!destResult.valid) errors.push({ field: "destination", message: destResult.errors[0] });
  const bal = parseFloat(String(params.startingBalance));
  if (!Number.isFinite(bal) || bal < 1)
    errors.push({ field: "startingBalance", message: "Starting balance must be at least 1 XLM." });
  return errors;
}

function validateChangeTrust(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!isValidAssetCode(params.assetCode))
    errors.push({ field: "assetCode", message: "Asset code must be 1–12 uppercase letters/digits." });
  const issuerResult = validateStellarAddress(params.assetIssuer);
  if (!issuerResult.valid)
    errors.push({ field: "assetIssuer", message: issuerResult.errors[0] });
  if (params.limit !== "" && params.limit !== undefined && !isNonNegativeAmount(params.limit))
    errors.push({ field: "limit", message: "Limit must be a non-negative number or empty for maximum." });
  return errors;
}

function validateManageOffer(params: Record<string, unknown>, type: string): FieldError[] {
  const errors: FieldError[] = [];
  const amountField = type === "manageBuyOffer" ? "buyAmount" : "amount";
  if (!isPositiveAmount(params[amountField]))
    errors.push({ field: amountField, message: "Amount must be a positive number." });
  if (!isPositiveAmount(params.price))
    errors.push({ field: "price", message: "Price must be a positive number." });
  return errors;
}

function validatePathPayment(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  const destResult = validateStellarAddress(params.destination);
  if (!destResult.valid) errors.push({ field: "destination", message: destResult.errors[0] });
  const sendAmount = (params.sendAmount ?? params.sendMax) as unknown;
  if (!isPositiveAmount(sendAmount))
    errors.push({ field: "sendAmount", message: "Send amount must be a positive number." });
  const destAmount = (params.destAmount ?? params.destMin) as unknown;
  if (!isPositiveAmount(destAmount))
    errors.push({ field: "destAmount", message: "Destination amount must be a positive number." });
  return errors;
}

function validateClaimClaimableBalance(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!params.balanceId || typeof params.balanceId !== "string" || params.balanceId.trim() === "")
    errors.push({ field: "balanceId", message: "Balance ID is required." });
  return errors;
}

function validateBumpSequence(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  const n = parseInt(String(params.bumpTo), 10);
  if (!Number.isFinite(n) || n < 0)
    errors.push({ field: "bumpTo", message: "Bump-to value must be a non-negative integer." });
  return errors;
}

function validateBeginSponsoring(params: Record<string, unknown>): FieldError[] {
  const result = validateStellarAddress(params.sponsoredId);
  if (!result.valid) return [{ field: "sponsoredId", message: result.errors[0] }];
  return [];
}

function validateEndSponsoring(): FieldError[] {
  // endSponsoringFutureReserves has no required parameters
  return [];
}

function validateFeeBump(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  const feeSourceResult = validateStellarAddress(params.feeSource);
  if (!feeSourceResult.valid)
    errors.push({ field: "feeSource", message: "Fee source: " + feeSourceResult.errors[0] });
  if (!params.innerTransaction || typeof params.innerTransaction !== "string" || String(params.innerTransaction).trim() === "")
    errors.push({ field: "innerTransaction", message: "Inner transaction XDR is required and must be a non-empty string." });
  const baseFee = parseInt(String(params.baseFee), 10);
  if (!Number.isFinite(baseFee) || baseFee <= 0)
    errors.push({ field: "baseFee", message: "Base fee must be a positive integer." });
  return errors;
}

function validateClawback(params: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = [];
  if (!isValidAssetCode(params.assetCode))
    errors.push({ field: "assetCode", message: "Asset code must be 1–12 uppercase letters/digits." });
  const issuerResult = validateStellarAddress(params.assetIssuer);
  if (!issuerResult.valid)
    errors.push({ field: "assetIssuer", message: issuerResult.errors[0] });
  const fromResult = validateStellarAddress(params.from);
  if (!fromResult.valid)
    errors.push({ field: "from", message: fromResult.errors[0] });
  if (!isPositiveAmount(params.amount))
    errors.push({ field: "amount", message: "Amount must be a positive number." });
  return errors;
}

/**
 * Validate a single operation.
 */
export function validateOperation(
  type: string,
  params: Record<string, unknown>,
): FieldError[] {
  switch (type) {
    case "payment": return validatePayment(params);
    case "createAccount": return validateCreateAccount(params);
    case "changeTrust": return validateChangeTrust(params);
    case "manageSellOffer":
    case "manageBuyOffer": return validateManageOffer(params, type);
    case "pathPaymentStrictSend":
    case "pathPaymentStrictReceive": return validatePathPayment(params);
    case "claimClaimableBalance": return validateClaimClaimableBalance(params);
    case "bumpSequence": return validateBumpSequence(params);
    case "beginSponsoringFutureReserves": return validateBeginSponsoring(params);
    case "endSponsoringFutureReserves": return validateEndSponsoring();
    case "feeBump": return validateFeeBump(params);
    case "clawback": return validateClawback(params);
    default: return [];
  }
}

/**
 * Validate an entire transaction parameter set.
 */
export function validateTransactionParams(params: {
  sourceAccount: string;
  operations: Array<{ type: string; params: Record<string, unknown> }>;
  baseFee?: number;
}): TransactionValidationResult {
  const globalErrors: string[] = [];
  const operationErrors: OperationValidationResult[] = [];

  const sourceResult = validateStellarAddress(params.sourceAccount);
  if (!sourceResult.valid) globalErrors.push(`Source account: ${sourceResult.errors[0]}`);

  if (!params.operations || params.operations.length === 0) {
    globalErrors.push("At least one operation is required.");
  } else if (params.operations.length > 100) {
    globalErrors.push("A transaction may contain at most 100 operations.");
  }

  (params.operations ?? []).forEach((op, i) => {
    const errors = validateOperation(op.type, op.params ?? {});
    if (errors.length > 0) operationErrors.push({ operationIndex: i, errors });
  });

  return {
    valid: globalErrors.length === 0 && operationErrors.length === 0,
    operationErrors,
    globalErrors,
  };
}
