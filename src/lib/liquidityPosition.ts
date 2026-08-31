export type LiquidityEstimateError =
  | "unsupported-network"
  | "invalid-pool"
  | "invalid-position"
  | "invalid-withdrawal"
  | "insufficient-shares";

export interface LiquidityPositionEstimate {
  ownershipPercent: number;
  underlyingA: number;
  underlyingB: number;
  withdrawalShares: number;
  withdrawalA: number;
  withdrawalB: number;
  poolReserveImpactPercent: number;
  remainingShares: number;
  remainingUnderlyingA: number;
  remainingUnderlyingB: number;
}

export type LiquidityEstimateResult =
  | { ok: true; value: LiquidityPositionEstimate }
  | { ok: false; error: LiquidityEstimateError; message: string };

const SUPPORTED_NETWORKS = new Set(["mainnet", "testnet", "futurenet"]);

export function isLiquidityPoolNetworkSupported(network: string): boolean {
  return SUPPORTED_NETWORKS.has(network);
}

function amount(value: string | number | undefined): number {
  if (value === "" || value === undefined) return Number.NaN;
  return typeof value === "number" ? value : Number(value);
}

/**
 * Produces read-only estimates from Horizon pool reserves. Values are estimates,
 * not transaction minimums: ledger rounding and reserve changes can alter output.
 */
export function estimateLiquidityPosition(input: {
  network: string;
  positionShares: string | number;
  totalShares: string | number;
  reserveA: string | number;
  reserveB: string | number;
  withdrawalShares?: string | number;
}): LiquidityEstimateResult {
  if (!isLiquidityPoolNetworkSupported(input.network)) {
    return {
      ok: false,
      error: "unsupported-network",
      message: `Liquidity-pool estimates are unavailable on ${input.network || "this network"}.`,
    };
  }

  const positionShares = amount(input.positionShares);
  const totalShares = amount(input.totalShares);
  const reserveA = amount(input.reserveA);
  const reserveB = amount(input.reserveB);
  if (![totalShares, reserveA, reserveB].every(Number.isFinite) || totalShares <= 0 || reserveA < 0 || reserveB < 0) {
    return { ok: false, error: "invalid-pool", message: "Pool reserve or total-share data is invalid." };
  }
  if (!Number.isFinite(positionShares) || positionShares < 0) {
    return { ok: false, error: "invalid-position", message: "The account LP share balance is invalid." };
  }

  const withdrawalShares = input.withdrawalShares === undefined ? positionShares : amount(input.withdrawalShares);
  if (!Number.isFinite(withdrawalShares) || withdrawalShares < 0) {
    return { ok: false, error: "invalid-withdrawal", message: "Enter a valid, non-negative share amount." };
  }
  if (withdrawalShares > positionShares) {
    return { ok: false, error: "insufficient-shares", message: "Withdrawal shares exceed the connected account balance." };
  }

  const ownership = positionShares / totalShares;
  const withdrawalRatio = withdrawalShares / totalShares;
  const remainingShares = positionShares - withdrawalShares;
  return {
    ok: true,
    value: {
      ownershipPercent: ownership * 100,
      underlyingA: reserveA * ownership,
      underlyingB: reserveB * ownership,
      withdrawalShares,
      withdrawalA: reserveA * withdrawalRatio,
      withdrawalB: reserveB * withdrawalRatio,
      poolReserveImpactPercent: withdrawalRatio * 100,
      remainingShares,
      remainingUnderlyingA: reserveA * (remainingShares / totalShares),
      remainingUnderlyingB: reserveB * (remainingShares / totalShares),
    },
  };
}
