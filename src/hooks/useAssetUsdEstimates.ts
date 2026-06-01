import { useEffect, useState } from 'react';
import { fetchAssetPrice, fetchXLMPrice } from '../lib/stellar';
import type { Horizon } from '@stellar/stellar-sdk';

export interface AssetEstimate {
  usd: number;
  amount: number;
  priceXlm: number;
  priceUsd: number;
}

export interface UseAssetUsdEstimatesParams {
  balances?: Horizon.HorizonApi.BalanceLine[];
  connectedAddress: string | null;
  network: string;
  refreshKey?: unknown;
}

export interface UseAssetUsdEstimatesReturn {
  getEstimate: (balance: Horizon.HorizonApi.BalanceLine) => AssetEstimate | null;
}

function getBalanceEstimateKey(balance: Horizon.HorizonApi.BalanceLine): string {
  if (balance.asset_type === 'native') return 'native';
  const b = balance as Horizon.HorizonApi.BalanceLineAsset;
  return `${balance.asset_type}:${b.asset_code ?? ''}:${b.asset_issuer ?? ''}`;
}

export function formatEstimatedUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function useAssetUsdEstimates({
  balances = [],
  connectedAddress,
  network,
  refreshKey,
}: UseAssetUsdEstimatesParams): UseAssetUsdEstimatesReturn {
  const [estimates, setEstimates] = useState<Record<string, AssetEstimate>>({});

  const balanceSignature = balances
    .map((b) => `${getBalanceEstimateKey(b)}:${b.balance}`)
    .join('|');

  useEffect(() => {
    if (!connectedAddress || balances.length === 0) {
      setEstimates({});
      return;
    }

    let cancelled = false;

    const loadEstimates = async () => {
      setEstimates({});
      try {
        const xlmPrice = await fetchXLMPrice();
        const pricedBalances = await Promise.all(
          balances.map(async (balance) => {
            const amount = parseFloat(balance.balance);
            if (!Number.isFinite(amount)) return null;

            if (balance.asset_type === 'native') {
              return [
                getBalanceEstimateKey(balance),
                { usd: amount * xlmPrice.usd, amount, priceXlm: 1, priceUsd: xlmPrice.usd },
              ] as const;
            }

            try {
              const assetPrice = await fetchAssetPrice(balance, network);
              if (!assetPrice) return null;
              return [
                getBalanceEstimateKey(balance),
                {
                  usd: amount * assetPrice.xlm * xlmPrice.usd,
                  amount,
                  priceXlm: assetPrice.xlm,
                  priceUsd: assetPrice.xlm * xlmPrice.usd,
                },
              ] as const;
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;
        setEstimates(Object.fromEntries(pricedBalances.filter(Boolean) as [string, AssetEstimate][]));
      } catch {
        if (!cancelled) setEstimates({});
      }
    };

    loadEstimates();
    return () => { cancelled = true; };
  }, [balanceSignature, connectedAddress, network, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    getEstimate: (balance) => estimates[getBalanceEstimateKey(balance)] ?? null,
  };
}
