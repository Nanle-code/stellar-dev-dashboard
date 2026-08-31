import { describe, expect, it } from "vitest";
import { estimateLiquidityPosition } from "../liquidityPosition";

describe("estimateLiquidityPosition", () => {
  it("estimates owned assets and a partial withdrawal", () => {
    const result = estimateLiquidityPosition({
      network: "mainnet",
      positionShares: "100",
      totalShares: "1000",
      reserveA: "5000",
      reserveB: "2000",
      withdrawalShares: "25",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ownershipPercent: 10,
        underlyingA: 500,
        underlyingB: 200,
        withdrawalShares: 25,
        withdrawalA: 125,
        withdrawalB: 50,
        poolReserveImpactPercent: 2.5,
        remainingShares: 75,
        remainingUnderlyingA: 375,
        remainingUnderlyingB: 150,
      },
    });
  });

  it("supports the zero-share boundary without dividing by the position", () => {
    const result = estimateLiquidityPosition({
      network: "testnet",
      positionShares: 0,
      totalShares: 100,
      reserveA: 20,
      reserveB: 40,
      withdrawalShares: 0,
    });
    expect(result.ok && result.value.underlyingA).toBe(0);
    expect(result.ok && result.value.poolReserveImpactPercent).toBe(0);
  });

  it("rejects invalid and excessive withdrawals", () => {
    const base = { network: "mainnet", positionShares: 10, totalShares: 100, reserveA: 20, reserveB: 40 };
    expect(estimateLiquidityPosition({ ...base, withdrawalShares: "abc" })).toMatchObject({ ok: false, error: "invalid-withdrawal" });
    expect(estimateLiquidityPosition({ ...base, withdrawalShares: 11 })).toMatchObject({ ok: false, error: "insufficient-shares" });
  });

  it("reports unsupported environments", () => {
    expect(estimateLiquidityPosition({
      network: "custom",
      positionShares: 1,
      totalShares: 10,
      reserveA: 20,
      reserveB: 40,
    })).toMatchObject({ ok: false, error: "unsupported-network" });
  });
});

