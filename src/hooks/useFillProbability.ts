import { useMemo } from 'react';
import {
  estimateFillProbability,
  type FillProbabilityParams,
  type FillProbabilityResult,
} from '../lib/fillProbability';

/**
 * Derives a fill probability estimate reactively from the current order book
 * and trade history. Re-runs only when the inputs change.
 *
 * Returns `null` when required inputs are missing or clearly invalid so the
 * UI can choose to hide the indicator rather than show a misleading "0%".
 */
export function useFillProbability(
  params: Omit<FillProbabilityParams, 'bids' | 'asks' | 'trades'> & {
    bids?: FillProbabilityParams['bids'] | null;
    asks?: FillProbabilityParams['asks'] | null;
    trades?: FillProbabilityParams['trades'] | null;
  }
): FillProbabilityResult | null {
  return useMemo(() => {
    const { bids, asks, trades, limitPrice, quantity, side } = params;

    // Need at least a live order book to produce a meaningful estimate
    if (!bids?.length && !asks?.length) return null;
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) return null;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    return estimateFillProbability({
      ...params,
      bids: bids ?? [],
      asks: asks ?? [],
      trades: trades ?? [],
    });
  }, [
    params.side,
    params.limitPrice,
    params.quantity,
    params.bids,
    params.asks,
    params.trades,
    params.cadenceWindowSeconds,
  ]);
}
