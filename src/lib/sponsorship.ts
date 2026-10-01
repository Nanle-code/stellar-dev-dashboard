/**
 * Sponsorship relationships & reserve liabilities (#844)
 * =====================================================
 * Derives a readable summary of an account's Stellar sponsorship graph from a
 * Horizon `/accounts/{id}` record:
 *
 *  - which accounts sponsor this account's entries;
 *  - which entries are sponsored (signers, balances/trustlines);
 *  - the reserve this account still has to cover itself (residual liability);
 *  - the reserve this account provides to others (sponsoring liability).
 *
 * All calculations are in stroops and converted to XLM for display. Invalid or
 * partial account records degrade to a zeroed summary rather than throwing, so
 * the dashboard can always render.
 */

/** 0.5 XLM expressed in stroops — Stellar's base reserve. */
export const BASE_RESERVE_STROOPS = 5_000_000;
/** Every account starts with 2 base reserves (account + owner entry). */
export const ACCOUNT_BASE_ENTRIES = 2;
const STROOPS_PER_XLM = 10_000_000;

export type SponsoredEntryType = 'signer' | 'trustline' | 'data' | 'offer' | 'other';

export interface SponsoredEntry {
  type: SponsoredEntryType;
  /** Identifier for the entry (signer key or asset code/issuer). */
  id: string;
  /** Sponsoring account, when known. */
  sponsor: string | null;
}

export interface ReserveImpact {
  /** Total reserve the account would owe without any sponsorship. */
  grossReserveStroops: number;
  /** Reserve removed because others sponsor this account's entries. */
  reliefStroops: number;
  /** Reserve this account must still cover itself. */
  residualReserveStroops: number;
  /** Reserve this account provides for entries it sponsors for others. */
  providedReserveStroops: number;
}

export interface SponsorshipAnalysis {
  accountId: string | null;
  /** Entries of this account paid for by other accounts (`num_sponsoring`). */
  sponsoredEntryCount: number;
  /** Entries of other accounts paid for by this account (`num_sponsored`). */
  sponsoringEntryCount: number;
  /** Distinct accounts sponsoring this account. */
  sponsoringAccounts: string[];
  /** Detailed sponsored entries discoverable from the account record. */
  sponsoredEntries: SponsoredEntry[];
  reserve: ReserveImpact;
  /** True when the record was missing required fields. */
  degraded: boolean;
  warnings: string[];
}

function toCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function toXlm(stroops: number): number {
  return Math.round((stroops / STROOPS_PER_XLM) * 1e7) / 1e7;
}

/** Convert a stroop amount to a fixed 7-decimal XLM string. */
export function formatStroopsAsXlm(stroops: number): string {
  const safe = typeof stroops === 'number' && Number.isFinite(stroops) ? stroops : 0;
  return (safe / STROOPS_PER_XLM).toFixed(7);
}

function emptyAnalysis(warnings: string[]): SponsorshipAnalysis {
  return {
    accountId: null,
    sponsoredEntryCount: 0,
    sponsoringEntryCount: 0,
    sponsoringAccounts: [],
    sponsoredEntries: [],
    reserve: {
      grossReserveStroops: 0,
      reliefStroops: 0,
      residualReserveStroops: 0,
      providedReserveStroops: 0,
    },
    degraded: true,
    warnings,
  };
}

function isAccountLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

/**
 * Analyse sponsorship for a single Horizon account record.
 *
 * @param account Horizon account JSON (may be `null` / partial).
 * @param baseReserveStroops Override the base reserve (defaults to 0.5 XLM).
 */
export function analyzeSponsorship(account: unknown, baseReserveStroops = BASE_RESERVE_STROOPS): SponsorshipAnalysis {
  if (!isAccountLike(account)) {
    return emptyAnalysis(['Account record is missing or not an object.']);
  }

  const record = account as Record<string, unknown>;
  const warnings: string[] = [];
  if (typeof record.account_id !== 'string' || record.account_id.length === 0) {
    warnings.push('Account record has no account_id.');
  }

  const baseReserve =
    typeof baseReserveStroops === 'number' && Number.isFinite(baseReserveStroops) && baseReserveStroops > 0
      ? baseReserveStroops
      : BASE_RESERVE_STROOPS;

  const sponsoredEntryCount = toCount(record.num_sponsoring); // entries of mine paid by others
  const sponsoringEntryCount = toCount(record.num_sponsored); // entries of others paid by me
  const subentryCount = toCount(record.subentry_count);

  const sponsoredEntries: SponsoredEntry[] = [];
  const sponsoringAccounts = new Set<string>();

  const signers = Array.isArray(record.signers) ? record.signers : [];
  for (const signer of signers) {
    if (!isAccountLike(signer)) continue;
    const sponsor = typeof signer.sponsor === 'string' ? signer.sponsor : null;
    if (!sponsor) continue;
    sponsoringAccounts.add(sponsor);
    sponsoredEntries.push({
      type: 'signer',
      id: typeof signer.key === 'string' ? signer.key : 'signer',
      sponsor,
    });
  }

  const balances = Array.isArray(record.balances) ? record.balances : [];
  for (const balance of balances) {
    if (!isAccountLike(balance)) continue;
    const sponsor = typeof balance.sponsor === 'string' ? balance.sponsor : null;
    if (!sponsor) continue;
    sponsoringAccounts.add(sponsor);
    const asset =
      balance.asset_type === 'native'
        ? 'XLM'
        : `${String(balance.asset_code ?? '?')}:${String(balance.asset_issuer ?? '?')}`;
    sponsoredEntries.push({ type: 'trustline', id: asset, sponsor });
  }

  const grossEntries = ACCOUNT_BASE_ENTRIES + subentryCount;
  const grossReserveStroops = grossEntries * baseReserve;
  const reliefStroops = Math.min(sponsoredEntryCount, grossEntries) * baseReserve;
  const residualReserveStroops = Math.max(0, grossReserveStroops - reliefStroops);
  const providedReserveStroops = sponsoringEntryCount * baseReserve;

  return {
    accountId: typeof record.account_id === 'string' ? record.account_id : null,
    sponsoredEntryCount,
    sponsoringEntryCount,
    sponsoringAccounts: [...sponsoringAccounts].sort(),
    sponsoredEntries,
    reserve: {
      grossReserveStroops,
      reliefStroops,
      residualReserveStroops,
      providedReserveStroops,
    },
    degraded: warnings.length > 0,
    warnings,
  };
}

/** Convenience helper: XLM view of a reserve impact. */
export function reserveImpactXlm(impact: ReserveImpact) {
  return {
    gross: toXlm(impact.grossReserveStroops),
    relief: toXlm(impact.reliefStroops),
    residual: toXlm(impact.residualReserveStroops),
    provided: toXlm(impact.providedReserveStroops),
  };
}
