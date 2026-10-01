import { describe, it, expect, beforeEach } from "vitest";
import {
  parseSequenceNumber,
  computeNextReservedSequence,
  detectSequenceConflicts,
  formatReservationNotice,
  findActiveSequenceCollision,
} from "../sequenceReservation";
import type { ReservedDraft } from "../sequenceReservation";

const ACCOUNT_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ACCOUNT_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function makeDraft(
  id: string,
  sourceAccount: string,
  reservedSequence: string | null,
  network = "testnet"
): ReservedDraft {
  return {
    id,
    name: `draft-${id}`,
    sourceAccount,
    reservedSequence,
    network,
    reservedAt: 1_000,
    createdAt: 1_000,
  };
}

describe("parseSequenceNumber", () => {
  it("parses valid non-negative sequence numbers", () => {
    expect(parseSequenceNumber("0")).toBe(0n);
    expect(parseSequenceNumber("123456789")).toBe(123456789n);
    expect(parseSequenceNumber(42)).toBe(42n);
    expect(parseSequenceNumber(BigInt(7))).toBe(7n);
  });

  it("rejects invalid and negative input (failure cases)", () => {
    expect(parseSequenceNumber(null)).toBeNull();
    expect(parseSequenceNumber(undefined)).toBeNull();
    expect(parseSequenceNumber("")).toBeNull();
    expect(parseSequenceNumber("abc")).toBeNull();
    expect(parseSequenceNumber("-1")).toBeNull();
    expect(parseSequenceNumber("1.5")).toBeNull();
    expect(parseSequenceNumber(NaN)).toBeNull();
  });

  it("boundary: accepts zero and the max safe integer", () => {
    expect(parseSequenceNumber("0")).toBe(0n);
    expect(parseSequenceNumber("9007199254740991")).toBe(9007199254740991n);
  });
});

describe("computeNextReservedSequence", () => {
  it("primary flow: returns account sequence + 1 when no existing reservations", () => {
    const next = computeNextReservedSequence([], "123", ACCOUNT_A);
    expect(next).toBe("124");
  });

  it("does not collide with an existing reservation for the same account", () => {
    const drafts = [makeDraft("d1", ACCOUNT_A, "124")];
    const next = computeNextReservedSequence(drafts, "123", ACCOUNT_A);
    expect(next).toBe("125");
  });

  it("prefers the existing reservation over a lower account sequence", () => {
    // Account sequence advanced to 123, but an older draft already reserved 200.
    const drafts = [makeDraft("d1", ACCOUNT_A, "200")];
    const next = computeNextReservedSequence(drafts, "123", ACCOUNT_A);
    expect(next).toBe("201");
  });

  it("ignores reservations for other source accounts", () => {
    const drafts = [makeDraft("d1", ACCOUNT_B, "124")];
    const next = computeNextReservedSequence(drafts, "99", ACCOUNT_A);
    expect(next).toBe("100");
  });

  it("failure path: returns null for invalid account sequence input", () => {
    expect(computeNextReservedSequence([], "not-a-number", ACCOUNT_A)).toBeNull();
    expect(computeNextReservedSequence([], "", ACCOUNT_A)).toBeNull();
    expect(computeNextReservedSequence([], null, ACCOUNT_A)).toBeNull();
  });

  it("boundary: handles a reservation that equals the account sequence", () => {
    const drafts = [makeDraft("d1", ACCOUNT_A, "123")];
    const next = computeNextReservedSequence(drafts, "123", ACCOUNT_A);
    expect(next).toBe("124");
  });
});

describe("detectSequenceConflicts", () => {
  it("primary flow: flags colliding drafts for the same account + sequence", () => {
    const drafts = [
      makeDraft("d1", ACCOUNT_A, "124"),
      makeDraft("d2", ACCOUNT_A, "124"),
      makeDraft("d3", ACCOUNT_A, "125"),
    ];
    const result = detectSequenceConflicts(drafts);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].sourceAccount).toBe(ACCOUNT_A);
    expect(result.conflicts[0].reservedSequence).toBe("124");
    expect(result.conflicts[0].count).toBe(2);
    expect(result.conflicts[0].draftIds.sort()).toEqual(["d1", "d2"]);
    expect(result.unresolved).toHaveLength(0);
  });

  it("does not flag drafts on different accounts even with the same sequence", () => {
    const drafts = [
      makeDraft("d1", ACCOUNT_A, "124"),
      makeDraft("d2", ACCOUNT_B, "124"),
    ];
    const result = detectSequenceConflicts(drafts);
    expect(result.conflicts).toHaveLength(0);
  });

  it("does not flag non-overlapping reservations for the same account", () => {
    const drafts = [
      makeDraft("d1", ACCOUNT_A, "124"),
      makeDraft("d2", ACCOUNT_A, "125"),
      makeDraft("d3", ACCOUNT_A, "126"),
    ];
    const result = detectSequenceConflicts(drafts);
    expect(result.conflicts).toHaveLength(0);
  });

  it("boundary: a single draft never conflicts", () => {
    const result = detectSequenceConflicts([makeDraft("d1", ACCOUNT_A, "124")]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it("boundary: empty input produces no conflicts", () => {
    const result = detectSequenceConflicts([]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.unresolved).toHaveLength(0);
  });

  it("failure path: drafts with null/unknown reservations are reported as unresolved, not crashes", () => {
    const drafts = [
      makeDraft("d1", ACCOUNT_A, null),
      makeDraft("d2", ACCOUNT_A, "abc"),
      makeDraft("d3", "", "124"),
    ];
    const result = detectSequenceConflicts(drafts);
    expect(result.conflicts).toHaveLength(0);
    // d1 and d2 are unresolved (same account), d3 has no source account.
    expect(result.unresolved.length).toBeGreaterThanOrEqual(2);
  });
});

describe("formatReservationNotice", () => {
  it("primary flow: reserved notice", () => {
    const notice = formatReservationNotice(ACCOUNT_A, "testnet", "124", null);
    expect(notice.type).toBe("reserved");
    expect(notice.message).toContain("124");
  });

  it("skips reservation for local network (unsupported environment)", () => {
    const notice = formatReservationNotice(ACCOUNT_A, "local", null, null);
    expect(notice.type).toBe("skipped");
    expect(notice.message).toContain("Local network");
  });

  it("skips reservation when no source account (invalid input)", () => {
    const notice = formatReservationNotice("", "testnet", null, null);
    expect(notice.type).toBe("skipped");
  });

  it("failure path: surfaces a failed reservation", () => {
    const notice = formatReservationNotice(ACCOUNT_A, "testnet", null, "timeout");
    expect(notice.type).toBe("failed");
    expect(notice.message).toContain("timeout");
  });
});

describe("findActiveSequenceCollision", () => {
  it("primary flow: detects an active transaction colliding with a saved draft", () => {
    const drafts = [
      makeDraft("d1", ACCOUNT_A, "124"),
      makeDraft("d2", ACCOUNT_A, "125"),
    ];
    const collision = findActiveSequenceCollision(drafts, ACCOUNT_A, "124");
    expect(collision).not.toBeNull();
    expect(collision!.draftIds).toContain("d1");
  });

  it("returns null when the active sequence is unused", () => {
    const drafts = [makeDraft("d1", ACCOUNT_A, "124")];
    expect(findActiveSequenceCollision(drafts, ACCOUNT_A, "999")).toBeNull();
  });

  it("returns null for an invalid active sequence", () => {
    const drafts = [makeDraft("d1", ACCOUNT_A, "124")];
    expect(findActiveSequenceCollision(drafts, ACCOUNT_A, "nope")).toBeNull();
  });
});
