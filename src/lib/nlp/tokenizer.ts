/**
 * Tokenizer and clause splitter for the Natural Language Transaction Builder (#551).
 *
 * Clause splitting is what makes multi-operation input work: an instruction is
 * cut into independent fragments, each of which is matched against the pattern
 * table separately. Quoted spans are masked before splitting so a memo that
 * contains "then" or "and" does not tear the sentence apart.
 */

export interface Token {
  raw: string;
  lower: string;
  start: number;
  end: number;
}

export interface Clause {
  text: string;
  tokens: Token[];
  index: number;
}

/**
 * Verbs that can begin an operation. Used to decide whether a bare "and"
 * separates two operations or merely two parameters ("selling XLM and buying
 * USDC" must not split).
 */
export const ACTION_VERBS = [
  "send",
  "pay",
  "transfer",
  "give",
  "create",
  "fund",
  "open",
  "trust",
  "untrust",
  "add",
  "remove",
  "sell",
  "buy",
  "offer",
  "swap",
  "convert",
  "exchange",
  "merge",
  "close",
  "set",
  "store",
  "save",
  "write",
  "delete",
  "claim",
  "lock",
  "bump",
  "sponsor",
  "stop",
  "end",
  "clawback",
  "claw",
];

/** Explicit separators that always mark an operation boundary. */
const HARD_SEPARATORS = [
  "\\n+",
  ";\\s*",
  ",\\s*then\\s+",
  ",\\s*and\\s+then\\s+",
  "\\s+and\\s+then\\s+",
  "\\s+then\\s+",
  "\\s+after\\s+that,?\\s+",
  "\\s+also,?\\s+",
];

const HARD_SEPARATOR_RE = new RegExp(`(?:${HARD_SEPARATORS.join("|")})`, "gi");

/** Split on "and" only when an action verb follows it. */
const AND_BEFORE_VERB_RE = new RegExp(
  `\\s+and\\s+(?=(?:${ACTION_VERBS.join("|")})\\b)`,
  "gi",
);

/** Normalizes smart punctuation and collapses runs of whitespace. */
export function sanitize(input: string): string {
  return input
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes politeness and trailing punctuation that carry no parameters. */
export function stripFiller(text: string): string {
  return text
    .replace(
      /^\s*(?:please\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|i\s+(?:want|need|would\s+like)\s+to\s+|i'?d\s+like\s+to\s+|let'?s\s+|kindly\s+)+/i,
      "",
    )
    .replace(/\s*(?:,?\s*(?:please|thanks|thank\s+you))\s*[.!?]*\s*$/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /"[^"]*"|'[^']*'|\S+/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    tokens.push({
      raw: match[0],
      lower: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

const MASK_OPEN = "\u0001";
const MASK_CLOSE = "\u0002";

/** Replaces quoted spans with placeholders so separators inside them are inert. */
function maskQuoted(text: string): { masked: string; quoted: string[] } {
  const quoted: string[] = [];
  const masked = text.replace(/"[^"]*"|'[^']*'/g, (m) => {
    quoted.push(m);
    return `${MASK_OPEN}${quoted.length - 1}${MASK_CLOSE}`;
  });
  return { masked, quoted };
}

function unmask(text: string, quoted: string[]): string {
  return text.replace(
    new RegExp(`${MASK_OPEN}(\\d+)${MASK_CLOSE}`, "g"),
    (_, i) => quoted[Number(i)] ?? "",
  );
}

/**
 * Splits an instruction into clauses. Always returns at least one clause for
 * non-empty input.
 */
export function splitClauses(input: string): Clause[] {
  const text = sanitize(input);
  if (!text) return [];

  const { masked, quoted } = maskQuoted(text);

  // "Swap X to Y and send to Z" is one path payment, not a conversion followed
  // by a separate payment, so conversion openers suppress the "and" split.
  const isConversion = /^\s*(?:swap|convert|exchange)\b/i.test(masked);

  const parts = masked
    .split(HARD_SEPARATOR_RE)
    .flatMap((part) => (isConversion ? [part] : part.split(AND_BEFORE_VERB_RE)))
    .map((part) => stripFiller(unmask(part, quoted)))
    .filter((part) => part.length > 0);

  return parts.map((part, index) => ({
    text: part,
    tokens: tokenize(part),
    index,
  }));
}