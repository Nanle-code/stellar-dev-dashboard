import { NETWORKS, withNetworkHeaders, type NetworkName } from './networks.js';
import { isValidPublicKey } from './addresses.js';

// ─── Path payments ────────────────────────────────────────────────────────────

export type PathPaymentMode = 'strict-send' | 'strict-receive';

export interface PathAsset {
  type: 'native' | 'credit';
  code: string;
  issuer?: string;
}

export interface PaymentPathRecord {
  source_asset_type: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  source_amount: string;
  destination_asset_type: string;
  destination_asset_code?: string;
  destination_asset_issuer?: string;
  destination_amount: string;
  path: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  /** Slippage % vs best path — annotated client-side, not from Horizon */
  slippagePct?: string;
}

export interface FetchPaymentPathsParams {
  sourceAsset: PathAsset;
  destAsset: PathAsset;
  amount: string;
  mode?: PathPaymentMode;
  network?: NetworkName;
}

export type PathPaymentErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_NETWORK'
  | 'HORIZON_ERROR'
  | 'REQUEST_FAILED';

/** A user-safe path quote failure with a stable code for UI handling. */
export class PathPaymentError extends Error {
  constructor(
    public readonly code: PathPaymentErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'PathPaymentError';
  }
}



export async function fetchPaymentPaths(
  params: FetchPaymentPathsParams
): Promise<PaymentPathRecord[]> {
  const { sourceAsset, destAsset, amount, mode = 'strict-send', network = 'testnet' } = params;

  if (mode !== 'strict-send' && mode !== 'strict-receive') {
    throw new PathPaymentError('INVALID_INPUT', 'Choose either strict-send or strict-receive mode.');
  }

  if (!/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) {
    throw new PathPaymentError(
      'INVALID_INPUT',
      'Amount must be a positive decimal with no more than 7 decimal places.'
    );
  }

  function validateAsset(asset: PathAsset, label: string): void {
    if (!asset || (asset.type !== 'native' && asset.type !== 'credit')) {
      throw new PathPaymentError('INVALID_INPUT', `${label} asset type is invalid.`);
    }
    if (asset.type === 'credit') {
      if (!/^[a-zA-Z0-9]{1,12}$/.test(asset.code)) {
        throw new PathPaymentError('INVALID_INPUT', `${label} asset code must contain 1 to 12 letters or numbers.`);
      }
      if (!asset.issuer || !isValidPublicKey(asset.issuer)) {
        throw new PathPaymentError('INVALID_INPUT', `${label} asset issuer must be a valid Stellar G address.`);
      }
    }
  }

  validateAsset(sourceAsset, 'Source');
  validateAsset(destAsset, 'Destination');

  const networkConfig = NETWORKS[network];
  if (!networkConfig?.horizonUrl) {
    throw new PathPaymentError(
      'UNSUPPORTED_NETWORK',
      `Path quotes are not available for the ${network || 'selected'} network.`
    );
  }
  const horizonUrl = networkConfig.horizonUrl.replace(/\/$/, '');

  function assetParams(asset: PathAsset, prefix: string): string {
    if (asset.type === 'native') {
      return `${prefix}_asset_type=native`;
    }
    const alphaNum = asset.code.length <= 4 ? '4' : '12';
    return `${prefix}_asset_type=credit_alphanum${alphaNum}&${prefix}_asset_code=${asset.code}&${prefix}_asset_issuer=${asset.issuer}`;
  }

  function assetString(asset: PathAsset): string {
    if (asset.type === 'native') return 'native';
    return `${asset.code}:${asset.issuer}`;
  }

  let url: string;
  if (mode === 'strict-send') {
    url = `${horizonUrl}/paths/strict-send?${assetParams(sourceAsset, 'source')}&source_amount=${amount}&destination_assets=${encodeURIComponent(assetString(destAsset))}`;
  } else {
    url = `${horizonUrl}/paths/strict-receive?${assetParams(destAsset, 'destination')}&destination_amount=${amount}&source_assets=${encodeURIComponent(assetString(sourceAsset))}`;
  }

  let res: Response;
  try {
    res = await fetch(url, withNetworkHeaders({}, network));
  } catch {
    throw new PathPaymentError(
      'REQUEST_FAILED',
      'Could not reach Horizon. Check your connection and try again.'
    );
  }

  if (!res.ok) {
    let detail = '';
    try {
      const problem = (await res.json()) as { detail?: string };
      detail = problem.detail ? ` ${problem.detail}` : '';
    } catch {
      // Horizon may return an empty or non-JSON proxy response.
    }
    throw new PathPaymentError(
      'HORIZON_ERROR',
      `Horizon could not produce a path quote (${res.status}).${detail}`,
      res.status
    );
  }

  let records: PaymentPathRecord[];
  try {
    const data = (await res.json()) as { _embedded?: { records?: PaymentPathRecord[] } };
    records = Array.isArray(data._embedded?.records) ? data._embedded.records : [];
  } catch {
    throw new PathPaymentError('HORIZON_ERROR', 'Horizon returned an invalid path quote response.');
  }

  const amountFor = (record: PaymentPathRecord) => Number(
    mode === 'strict-send' ? record.destination_amount : record.source_amount
  );
  const validRecords = records.filter((record) => Number.isFinite(amountFor(record)) && amountFor(record) > 0);
  validRecords.sort((a, b) => mode === 'strict-send'
    ? amountFor(b) - amountFor(a)
    : amountFor(a) - amountFor(b));

  const bestAmount = validRecords[0] ? amountFor(validRecords[0]) : 0;
  return validRecords.map((record) => {
    const quotedAmount = amountFor(record);
    const slippage = mode === 'strict-send'
      ? ((bestAmount - quotedAmount) / bestAmount) * 100
      : ((quotedAmount - bestAmount) / bestAmount) * 100;
    return { ...record, slippagePct: slippage.toFixed(2) };
  });
}
