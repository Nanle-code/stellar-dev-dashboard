/**
 * Parser entry point for the Natural Language Transaction Builder (#551).
 *
 * parseTransaction() takes plain English and returns operations shaped for
 * createOperation() in src/lib/transactionBuilder.js, along with per-field
 * confidence so the UI can highlight what needs review before signing.
 *
 * Nothing here builds or submits a transaction. Parsing is deliberately
 * separated from execution so a low-confidence parse can never reach the
 * network without passing through the confirmation step.
 */

import { extractMemo, MEMO_TEXT_MAX_BYTES, memoByteLength } from "./entityRecognition";
import { SORTED_PATTERNS } from "./patterns";
import { sanitize, splitClauses, stripFiller } from "./tokenizer";
import type {
  ParsedOperation,
  ParseResult,
  ParseWarning,
  ResolutionContext,
} from "./types";

/** Below this, the UI should require explicit review of the flagged fields. */
export const REVIEW_THRESHOLD = 0.75;

/** Below this, the parse is treated as a miss rather than a weak match. */
export const MIN_ACCEPTABLE_CONFIDENCE = 0.3;

function meanConfidence(values: number[]): number {
  if (!values.length) return 0;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Number((sum / values.length).toFixed(4));
}

/**
 * Combines per-field confidence into a single score for the operation.
 * Missing required fields cap the result, so an operation that parsed cleanly
 * but lacks a destination cannot report high confidence.
 */
function scoreOperation(
  fieldConfidence: Record<string, number>,
  missingFields: string[],
): number {
  const values = Object.values(fieldConfidence).filter((n) => Number.isFinite(n));
  const base = values.length ? meanConfidence(values) : 0.5;
  const penalty = Math.min(missingFields.length * 0.2, 0.6);
  return Number(Math.max(0, Math.min(1, base - penalty)).toFixed(4));
}

function matchClause(
  clause: string,
  ctx: ResolutionContext,
): ParsedOperation | undefined {
  const text = stripFiller(clause);
  if (!text) return undefined;

  for (const pattern of SORTED_PATTERNS) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    let output;
    try {
      output = pattern.build(match, text, ctx);
    } catch {
      // A malformed capture should skip the pattern, not abort the parse.
      continue;
    }

    const confidence = scoreOperation(output.fieldConfidence, output.missingFields);
    if (confidence < MIN_ACCEPTABLE_CONFIDENCE && pattern.weight < 50) continue;

    return {
      type: pattern.type,
      params: output.params,
      confidence,
      fieldConfidence: output.fieldConfidence,
      patternId: pattern.id,
      sourceText: text,
      missingFields: output.missingFields,
    };
  }

  return undefined;
}

function warningsForOperation(
  op: ParsedOperation,
  clauseIndex: number,
): ParseWarning[] {
  const warnings: ParseWarning[] = [];

  if (op.missingFields.includes("destination") || op.missingFields.includes("from")) {
    warnings.push({
      code: "unresolved_destination",
      message: `Could not resolve "${op.params.destinationRaw ?? "the recipient"}" to an address. Choose or enter one before continuing.`,
      clauseIndex,
      field: "destination",
    });
  }

  if (op.missingFields.some((f) => f.toLowerCase().includes("issuer"))) {
    warnings.push({
      code: "unresolved_issuer",
      message: `No issuer on file for ${op.params.assetCode ?? "that asset"}. Enter the issuing account.`,
      clauseIndex,
      field: "assetIssuer",
    });
  }

  if (op.confidence < REVIEW_THRESHOLD) {
    warnings.push({
      code: "low_confidence",
      message: "This operation needs review before signing.",
      clauseIndex,
    });
  }

  return warnings;
}

/**
 * Parses a plain-English instruction into Stellar operations.
 *
 * @param input Free text, e.g. "Send 500 XLM to Alice for rent"
 * @param ctx Address book, known issuers, and learned corrections
 */
export function parseTransaction(
  input: string,
  ctx: ResolutionContext = {},
): ParseResult {
  const normalizedInput = sanitize(input ?? "");
  const clauses = splitClauses(normalizedInput);

  const operations: ParsedOperation[] = [];
  const warnings: ParseWarning[] = [];
  const unparsed: string[] = [];

  clauses.forEach((clause, index) => {
    const op = matchClause(clause.text, ctx);
    if (!op) {
      unparsed.push(clause.text);
      warnings.push({
        code: "no_match",
        message: `Could not interpret: "${clause.text}"`,
        clauseIndex: index,
      });
      return;
    }
    operations.push(op);
    warnings.push(...warningsForOperation(op, index));
  });

  const memoResult = extractMemo(normalizedInput);
  let memo: string | undefined;
  let memoType: ParseResult["memoType"];

  if (memoResult) {
    memo = memoResult.memo;
    memoType = memoResult.memoType;
    if (memoType === "text" && memoByteLength(memo) > MEMO_TEXT_MAX_BYTES) {
      warnings.push({
        code: "memo_too_long",
        message: `Memo exceeds the ${MEMO_TEXT_MAX_BYTES}-byte limit and will need shortening.`,
        field: "memo",
      });
    }
  }

  return {
    operations,
    memo,
    memoType,
    confidence: meanConfidence(operations.map((o) => o.confidence)),
    warnings,
    unparsed,
    normalizedInput,
  };
}

/**
 * Strips parser-only bookkeeping fields so params can be passed straight to
 * createOperation(), which rejects unknown keys on some operation types.
 */
export function toBuilderOperations(
  operations: ParsedOperation[],
): Array<{ type: string; params: Record<string, unknown> }> {
  return operations.map((op) => {
    const params: Record<string, unknown> = {};
    Object.entries(op.params).forEach(([key, value]) => {
      if (key === "destinationRaw") return;
      if (value === undefined) return;
      params[key] = value;
    });
    return { type: op.type, params };
  });
}

/** True when every operation is complete enough to attempt a build. */
export function isReadyToBuild(result: ParseResult): boolean {
  return (
    result.operations.length > 0 &&
    result.unparsed.length === 0 &&
    result.operations.every((op) => op.missingFields.length === 0)
  );
}