/**
 * Tests for the Natural Language Transaction Builder parser (#551).
 *
 * The accuracy test is the one that matters for the acceptance criteria: a
 * fixed corpus of phrasings is parsed and the pass rate is asserted against the
 * 85% bar. Adding a pattern should raise it, never lower it.
 */

import { describe, expect, it } from "vitest";
import {
  isReadyToBuild,
  parseTransaction,
  toBuilderOperations,
} from "../parser";
import { PATTERN_COUNT } from "../patterns";
import { splitClauses } from "../tokenizer";
import { extractAmount, resolveAsset, resolveDestination } from "../entityRecognition";
import type { Correction, ResolutionContext } from "../types";

const ALICE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB";
const BOB = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBC";
const USDC_ISSUER = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCD";

const ctx: ResolutionContext = {
  addressBook: { alice: ALICE, bob: BOB },
  knownIssuers: { USDC: USDC_ISSUER },
};

describe("pattern table", () => {
  it("meets the 30+ pattern criterion", () => {
    expect(PATTERN_COUNT).toBeGreaterThanOrEqual(30);
  });
});

describe("tokenizer", () => {
  it("splits on explicit operation separators", () => {
    const clauses = splitClauses("Send 10 XLM to alice, then trust USDC");
    expect(clauses).toHaveLength(2);
    expect(clauses[1].text.toLowerCase()).toContain("trust");
  });

  it("does not split on 'and' between parameters", () => {
    const clauses = splitClauses("Create an offer selling 100 XLM and buying USDC");
    expect(clauses).toHaveLength(1);
  });

  it("does not split inside a quoted memo", () => {
    const clauses = splitClauses('Send 5 XLM to alice with memo "rent and bills"');
    expect(clauses).toHaveLength(1);
  });

  it("strips politeness without losing parameters", () => {
    const clauses = splitClauses("Please send 5 XLM to alice, thanks");
    expect(clauses[0].text.toLowerCase().startsWith("send")).toBe(true);
  });
});

describe("entity recognition", () => {
  it("parses digit amounts with separators", () => {
    expect(extractAmount("1,500.50 XLM")?.value).toBe("1500.5");
  });

  it("parses magnitude suffixes", () => {
    expect(extractAmount("1.5k XLM")?.value).toBe("1500");
  });

  it("parses number words", () => {
    expect(extractAmount("five XLM")?.value).toBe("5");
  });

  it("treats XLM as native", () => {
    expect(resolveAsset("XLM", ctx).asset.assetType).toBe("native");
  });

  it("resolves a known issuer", () => {
    const { asset } = resolveAsset("USDC", ctx);
    expect(asset.assetIssuer).toBe(USDC_ISSUER);
    expect(asset.issuerUnresolved).toBeFalsy();
  });

  it("flags an unknown issuer instead of guessing", () => {
    const { asset } = resolveAsset("EURT", ctx);
    expect(asset.issuerUnresolved).toBe(true);
  });

  it("accepts an explicit code:issuer pair", () => {
    const { asset } = resolveAsset(`EURT:${BOB}`, ctx);
    expect(asset.assetIssuer).toBe(BOB);
  });

  it("resolves an alias from the address book", () => {
    expect(resolveDestination("alice", ctx).destination.resolved).toBe(ALICE);
  });

  it("prefers a learned correction over the address book", () => {
    const corrections: Correction[] = [
      { id: "destination:alice", key: "alice", kind: "destination", value: BOB, hits: 3, updatedAt: 1 },
    ];
    const result = resolveDestination("alice", { ...ctx, corrections });
    expect(result.destination.resolved).toBe(BOB);
  });

  it("passes a literal public key through untouched", () => {
    const result = resolveDestination(ALICE, {});
    expect(result.destination.resolved).toBe(ALICE);
    expect(result.confidence).toBe(1);
  });
});

describe("payments", () => {
  it("parses the canonical example from the issue", () => {
    const result = parseTransaction("Send 500 XLM to Alice for rent", ctx);
    expect(result.operations).toHaveLength(1);
    const [op] = result.operations;
    expect(op.type).toBe("payment");
    expect(op.params.amount).toBe("500");
    expect(op.params.assetType).toBe("native");
    expect(op.params.destination).toBe(ALICE);
    expect(result.memo).toBe("rent");
  });

  it("parses recipient-first phrasing", () => {
    const result = parseTransaction("Send alice 25 USDC", ctx);
    const [op] = result.operations;
    expect(op.type).toBe("payment");
    expect(op.params.amount).toBe("25");
    expect(op.params.assetCode).toBe("USDC");
    expect(op.params.assetIssuer).toBe(USDC_ISSUER);
  });

  it("keeps an unresolved recipient out of the destination field", () => {
    const result = parseTransaction("Send 10 XLM to carol", ctx);
    const [op] = result.operations;
    expect(op.missingFields).toContain("destination");
    expect(op.confidence).toBeLessThan(0.75);
    expect(isReadyToBuild(result)).toBe(false);
  });

  it("does not lose precision on fractional amounts", () => {
    const result = parseTransaction("Send 0.0000001 XLM to alice", ctx);
    expect(result.operations[0].params.amount).toBe("0.0000001");
  });
});

describe("other operation types", () => {
  it("parses account creation", () => {
    const result = parseTransaction(`Create account for ${BOB} with 5 XLM`, ctx);
    const [op] = result.operations;
    expect(op.type).toBe("createAccount");
    expect(op.params.startingBalance).toBe("5");
  });

  it("parses a trustline with an explicit issuer", () => {
    const result = parseTransaction(`Add trustline for EURT from ${BOB}`, ctx);
    const [op] = result.operations;
    expect(op.type).toBe("changeTrust");
    expect(op.params.assetCode).toBe("EURT");
    expect(op.params.assetIssuer).toBe(BOB);
  });

  it("parses trustline removal as a zero limit", () => {
    const result = parseTransaction("Remove trustline for USDC", ctx);
    const [op] = result.operations;
    expect(op.type).toBe("changeTrust");
    expect(op.params.limit).toBe("0");
  });

  it("parses a sell offer with a price", () => {
    const result = parseTransaction("Sell 100 XLM for USDC at 0.12 each", ctx);
    const [op] = result.operations;
    expect(op.type).toBe("manageSellOffer");
    expect(op.params.amount).toBe("100");
    expect(op.params.price).toBe("0.12");
  });

  it("parses an account merge", () => {
    const result = parseTransaction(`Merge my account into ${BOB}`, ctx);
    expect(result.operations[0].type).toBe("accountMerge");
  });

  it("parses a data entry", () => {
    const result = parseTransaction("Set homepage to example.com", ctx);
    const [op] = result.operations;
    expect(op.type).toBe("manageData");
    expect(op.params.name).toBe("homepage");
  });

  it("parses a sequence bump", () => {
    const result = parseTransaction("Bump sequence to 123456789", ctx);
    expect(result.operations[0].params.bumpTo).toBe("123456789");
  });
});

describe("multi-operation input", () => {
  it("produces one operation per clause", () => {
    const result = parseTransaction(
      `Send 10 XLM to alice, then trust EURT from ${BOB}`,
      ctx,
    );
    expect(result.operations).toHaveLength(2);
    expect(result.operations[0].type).toBe("payment");
    expect(result.operations[1].type).toBe("changeTrust");
  });

  it("handles three chained operations", () => {
    const result = parseTransaction(
      `Send 5 XLM to alice; send 6 XLM to bob; bump sequence to 99`,
      ctx,
    );
    expect(result.operations).toHaveLength(3);
  });

  it("reports clauses it could not interpret", () => {
    const result = parseTransaction("Send 5 XLM to alice, then do something odd", ctx);
    expect(result.unparsed.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.code === "no_match")).toBe(true);
  });
});

describe("builder handoff", () => {
  it("drops parser-only fields", () => {
    const result = parseTransaction("Send 500 XLM to alice", ctx);
    const ops = toBuilderOperations(result.operations);
    expect(ops[0].params).not.toHaveProperty("destinationRaw");
    expect(ops[0].type).toBe("payment");
  });

  it("marks a fully resolved parse as ready", () => {
    const result = parseTransaction("Send 500 XLM to alice", ctx);
    expect(isReadyToBuild(result)).toBe(true);
  });
});

describe("memo handling", () => {
  it("extracts a quoted memo", () => {
    const result = parseTransaction('Send 5 XLM to alice with memo "invoice 42"', ctx);
    expect(result.memo).toBe("invoice 42");
    expect(result.memoType).toBe("text");
  });

  it("extracts a numeric memo id", () => {
    const result = parseTransaction("Send 5 XLM to alice with memo id 12345", ctx);
    expect(result.memoType).toBe("id");
    expect(result.memo).toBe("12345");
  });

  it("warns when a memo exceeds the byte limit", () => {
    const long = "x".repeat(40);
    const result = parseTransaction(`Send 5 XLM to alice with memo "${long}"`, ctx);
    expect(result.warnings.some((w) => w.code === "memo_too_long")).toBe(true);
  });
});

describe("robustness", () => {
  it("returns an empty result for empty input", () => {
    const result = parseTransaction("", ctx);
    expect(result.operations).toHaveLength(0);
    expect(result.confidence).toBe(0);
  });

  it("does not throw on gibberish", () => {
    expect(() => parseTransaction("asdf qwer zxcv", ctx)).not.toThrow();
  });

  it("does not invent an operation from gibberish", () => {
    const result = parseTransaction("asdf qwer zxcv", ctx);
    expect(result.operations).toHaveLength(0);
  });
});

/**
 * Accuracy corpus. Each entry is a phrasing plus the operation type it must
 * resolve to. The acceptance criteria require 85%.
 */
const CORPUS: Array<{ text: string; type: string }> = [
  { text: "Send 500 XLM to Alice for rent", type: "payment" },
  { text: "Send 500 XLM to alice", type: "payment" },
  { text: `Send 500 XLM to ${ALICE}`, type: "payment" },
  { text: "Pay bob 25 USDC", type: "payment" },
  { text: "Transfer 12.5 XLM to alice", type: "payment" },
  { text: "Give alice 3 XLM", type: "payment" },
  { text: "500 XLM to alice", type: "payment" },
  { text: "To alice: 40 XLM", type: "payment" },
  { text: "Repay alice 30 USDC", type: "payment" },
  { text: "Send 1.5k XLM to bob", type: "payment" },
  { text: "Please send 5 XLM to alice, thanks", type: "payment" },
  { text: 'Send 5 XLM to alice with memo "invoice 42"', type: "payment" },
  { text: `Create account for ${BOB} with 5 XLM`, type: "createAccount" },
  { text: "Open a new account for alice with 10 XLM", type: "createAccount" },
  { text: `Fund new ${BOB} with 2 XLM`, type: "createAccount" },
  { text: `Add trustline for EURT from ${BOB}`, type: "changeTrust" },
  { text: `Trust EURT issued by ${BOB}`, type: "changeTrust" },
  { text: "Trust USDC", type: "changeTrust" },
  { text: "Add a trustline for USDC", type: "changeTrust" },
  { text: "Remove trustline for USDC", type: "changeTrust" },
  { text: "Untrust EURT", type: "changeTrust" },
  { text: "Sell 100 XLM for USDC at 0.12 each", type: "manageSellOffer" },
  { text: "Offer 50 XLM for USDC at 0.1", type: "manageSellOffer" },
  { text: "Buy 50 USDC with XLM at 0.12", type: "manageBuyOffer" },
  { text: "Create an offer selling 100 XLM buying USDC at 0.12", type: "manageSellOffer" },
  { text: `Merge my account into ${BOB}`, type: "accountMerge" },
  { text: "Close my account to alice", type: "accountMerge" },
  { text: "Set homepage to example.com", type: "manageData" },
  { text: "Store theme as dark", type: "manageData" },
  { text: "Delete data entry theme", type: "manageData" },
  { text: `Claim balance ${"a".repeat(72)}`, type: "claimClaimableBalance" },
  { text: "Bump sequence to 123456789", type: "bumpSequence" },
  { text: `Begin sponsoring future reserves for ${BOB}`, type: "beginSponsoringFutureReserves" },
  { text: "End sponsoring future reserves", type: "endSponsoringFutureReserves" },
  { text: `Clawback 100 USDC from ${BOB}`, type: "clawback" },
  { text: "Swap 100 XLM to USDC and send to alice", type: "pathPaymentStrictSend" },
  { text: "Pay alice exactly 50 USDC using at most 300 XLM", type: "pathPaymentStrictReceive" },
  { text: "Send alice 25 USDC", type: "payment" },
  { text: "Send 0.0000001 XLM to alice", type: "payment" },
  { text: "Send five XLM to alice", type: "payment" },
];

describe("accuracy", () => {
  it("covers at least 30 distinct phrasings", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(30);
  });

  it("meets the 85% accuracy criterion", () => {
    const failures: string[] = [];

    CORPUS.forEach((entry) => {
      const result = parseTransaction(entry.text, ctx);
      const actual = result.operations[0]?.type;
      if (actual !== entry.type) {
        failures.push(`"${entry.text}" -> expected ${entry.type}, got ${actual ?? "no match"}`);
      }
    });

    const accuracy = (CORPUS.length - failures.length) / CORPUS.length;
    if (accuracy < 0.85) {
      throw new Error(
        `Accuracy ${(accuracy * 100).toFixed(1)}% is below 85%.\n${failures.join("\n")}`,
      );
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.85);
  });
});