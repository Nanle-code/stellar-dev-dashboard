/**
 * Shared types for the Natural Language Transaction Builder (#551).
 *
 * ParsedOperation intentionally mirrors the { type, params } shape consumed by
 * createOperation() in src/lib/transactionBuilder.js and validateOperation()
 * in src/utils/transactionValidation.ts, so parser output can be handed to
 * either without translation.
 */

/** Operation type strings accepted by createOperation(). */
export type OperationType =
  | "payment"
  | "createAccount"
  | "changeTrust"
  | "manageSellOffer"
  | "manageBuyOffer"
  | "accountMerge"
  | "manageData"
  | "pathPaymentStrictSend"
  | "pathPaymentStrictReceive"
  | "claimClaimableBalance"
  | "bumpSequence"
  | "beginSponsoringFutureReserves"
  | "endSponsoringFutureReserves"
  | "clawback";

/** A resolved asset reference. Native XLM carries no code or issuer. */
export interface AssetRef {
  assetType: "native" | "credit_alphanum4" | "credit_alphanum12";
  assetCode?: string;
  assetIssuer?: string;
  /** True when the issuer could not be resolved and must be supplied by the user. */
  issuerUnresolved?: boolean;
}

/** A quantity extracted from text, kept as a string to avoid float drift. */
export interface AmountRef {
  value: string;
  raw: string;
}

/**
 * A destination as written by the user, plus its resolution.
 * `resolved` is a G... public key once an alias or federation address is
 * mapped; until then the UI must prompt.
 */
export interface DestinationRef {
  raw: string;
  resolved?: string;
  kind: "publicKey" | "alias" | "federation" | "muxed" | "unknown";
}

/** Per-field confidence, used to decide which inputs to highlight for review. */
export type FieldConfidence = Record<string, number>;

export interface ParsedOperation {
  type: OperationType;
  params: Record<string, unknown>;
  /** 0..1 confidence that this clause was understood correctly. */
  confidence: number;
  fieldConfidence: FieldConfidence;
  /** Identifier of the pattern that matched, for debugging and correction keys. */
  patternId: string;
  /** The clause text this operation came from. */
  sourceText: string;
  /** Fields the user must fill before the operation is valid. */
  missingFields: string[];
}

export interface ParseWarning {
  code:
    | "unresolved_destination"
    | "unresolved_issuer"
    | "ambiguous_asset"
    | "no_match"
    | "low_confidence"
    | "memo_too_long";
  message: string;
  clauseIndex?: number;
  field?: string;
}

export interface ParseResult {
  operations: ParsedOperation[];
  memo?: string;
  memoType?: "text" | "id" | "hash" | "return";
  /** Mean confidence across matched operations, 0 when nothing matched. */
  confidence: number;
  warnings: ParseWarning[];
  /** Clauses that matched no pattern, surfaced so the user can rephrase. */
  unparsed: string[];
  /** Original input after sanitization. */
  normalizedInput: string;
}

/** A user correction, persisted to improve later parses. */
export interface Correction {
  id: string;
  /** Lowercased phrase the user corrected, e.g. an alias like "alice". */
  key: string;
  kind: "destination" | "issuer" | "assetCode" | "operationType";
  /** The value the user chose. */
  value: string;
  /** Times this correction has been confirmed. Higher wins on conflict. */
  hits: number;
  updatedAt: number;
}

/** Resolution tables the parser consults. Supplied by the caller. */
export interface ResolutionContext {
  /** alias (lowercased) -> G... public key */
  addressBook?: Record<string, string>;
  /** asset code (uppercased) -> issuer public key */
  knownIssuers?: Record<string, string>;
  /** Corrections learned from prior sessions. */
  corrections?: Correction[];
  /** Source account, used for operations that default to self. */
  sourceAccount?: string;
}