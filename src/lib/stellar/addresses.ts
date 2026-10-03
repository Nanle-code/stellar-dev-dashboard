import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, rateLimitedFetch, type NetworkName } from './networks.js';
import { requireAllowedEndpoint } from '../endpointAllowlist';

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Check if address is a valid Ed25519 public key (G...)
 */
export function isValidEd25519PublicKey(key: string): boolean {
  return StellarSdk.StrKey.isValidEd25519PublicKey(key);
}

/**
 * Check if address is a valid muxed account (M...)
 */
export function isValidMuxedAccount(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (!trimmed.startsWith('M')) return false;
  try {
    StellarSdk.MuxedAccount.fromAddress(trimmed, '0');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if address is a federated address (name*domain or name@domain)
 */
export function isFederatedAddress(input: string): boolean {
  if (typeof input !== 'string' || !input.trim()) return false;
  const trimmed = input.trim();
  // name*domain.tld (Stellar federation) OR name@domain.tld (email-style)
  return (
    /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed) ||
    /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
  );
}

/**
 * Extract master account and muxed ID from a muxed address
 */
export function parseMuxedAccount(
  muxedAddress: string
): { masterAccount: string; muxedId: string } | null {
  try {
    const muxed = StellarSdk.MuxedAccount.fromAddress(muxedAddress, '0');
    return {
      masterAccount: muxed.baseAccount().accountId(),
      muxedId: muxed.id(),
    };
  } catch {
    return null;
  }
}

// ─── Memo requirement check (SEP-29) ───────────────────────────────────────────

export interface MemoRequirementResult {
  /** True only when the destination account has published a SEP-29 memo requirement. */
  required: boolean;
  /** True when the lookup completed (successfully or with a definitive "not found"). */
  checked: boolean;
  /** Present when the requirement could not be determined (network error, unsupported input). */
  error?: string;
}

/**
 * Check whether a destination requires a memo per SEP-29, by looking for a
 * `config.memo_required` data entry (base64-encoded "1") on the account.
 * Exchanges and custodians commonly set this flag on shared deposit addresses.
 *
 * Muxed accounts (M...) already encode their own memo ID and never require one.
 * Federated (name*domain) and contract (C...) destinations are not currently
 * checked here — federation records surface their own memo via resolveAddress().
 */
export async function checkDestinationMemoRequirement(
  destination: string,
  network: NetworkName = 'testnet'
): Promise<MemoRequirementResult> {
  if (typeof destination !== 'string' || !destination.trim()) {
    return { required: false, checked: false, error: 'No destination provided.' };
  }
  const trimmed = destination.trim();

  if (isValidMuxedAccount(trimmed)) {
    return { required: false, checked: true };
  }

  if (!isValidEd25519PublicKey(trimmed)) {
    return { required: false, checked: false, error: 'Destination is not a directly checkable account address.' };
  }

  try {
    const server = getServer(network);
    const account = await server.loadAccount(trimmed);
    const raw = (account as unknown as { data_attr?: Record<string, string> }).data_attr?.['config.memo_required'];
    if (!raw) return { required: false, checked: true };
    const decoded = typeof atob === 'function' ? atob(raw) : Buffer.from(raw, 'base64').toString('utf8');
    return { required: decoded === '1', checked: true };
  } catch (error: any) {
    if (error?.response?.status === 404) {
      // Unfunded accounts cannot carry the SEP-29 data entry.
      return { required: false, checked: true };
    }
    return {
      required: false,
      checked: false,
      error: error?.message || 'Failed to check destination memo requirement.',
    };
  }
}

/**
 * Resolve a federated address to a Stellar account via Horizon federation endpoint
 */
export async function resolveFederatedAddress(
  federatedAddress: string,
  network: NetworkName = 'testnet'
): Promise<{ accountId: string; memoId?: string; memoType?: string } | null> {
  try {
    // Parse the federated address (name*domain)
    const [name, domain] = federatedAddress.split('*');

    if (!name || !domain) {
      return null;
    }

    // Fetch the federation record from the domain's .well-known/stellar.toml
    const federationUrl = `https://${domain}/.well-known/stellar.toml`;

    let tomlData: Record<string, any> = {};
    try {
      const tomlResponse = await rateLimitedFetch(federationUrl);
      if (!tomlResponse.ok) {
        // Federation endpoint not available in current SDK version
        return null;
      }

      // Parse TOML (basic parsing for FEDERATION_SERVER URL)
      const tomlText = await tomlResponse.text();
      const federationServerMatch = tomlText.match(/FEDERATION_SERVER\s*=\s*"([^"]+)"/);
      if (federationServerMatch) {
        tomlData.federationServer = federationServerMatch[1];
      }
    } catch {
      // Federation endpoint not available in current SDK version
      return null;
    }

    // Use the federation server URL if found
    if (tomlData.federationServer) {
      const federationEndpoint = requireAllowedEndpoint(
        tomlData.federationServer,
        domain,
        'federation'
      );
      federationEndpoint.searchParams.append('q', federatedAddress);
      federationEndpoint.searchParams.append('type', 'name');

      const response = await rateLimitedFetch(federationEndpoint.toString());
      if (response.ok) {
        return await response.json();
      }
    }

    // Federation endpoint not available in current SDK version
    return null;
  } catch {
    return null;
  }
}

/**
 * Comprehensive address resolver
 * Accepts: G... (Ed25519), M... (muxed), or name*domain (federated)
 * Returns: master account ID, muxed ID (if applicable), and original input info
 */
export interface ResolvedAddress {
  accountId: string; // The master account ID (always G...)
  muxedId?: string; // Muxed ID if input was M...
  originalInput: string; // Original input provided
  inputType: 'ed25519' | 'muxed' | 'federated';
  federatedAddress?: string; // Original federated address if applicable
  memoId?: string; // Memo ID from federation resolution
  memoType?: string; // Memo type from federation resolution
}

export async function resolveAddress(
  input: string,
  network: NetworkName = 'testnet'
): Promise<ResolvedAddress | null> {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();

  // Try Ed25519 public key (G...)
  if (isValidEd25519PublicKey(trimmedInput)) {
    return {
      accountId: trimmedInput,
      originalInput: trimmedInput,
      inputType: 'ed25519',
    };
  }

  // Try muxed account (M...)
  if (isValidMuxedAccount(trimmedInput)) {
    const parsed = parseMuxedAccount(trimmedInput);
    if (parsed) {
      return {
        accountId: parsed.masterAccount,
        muxedId: parsed.muxedId,
        originalInput: trimmedInput,
        inputType: 'muxed',
      };
    }
  }

  // Try federated address (name*domain)
  if (isFederatedAddress(trimmedInput)) {
    const resolved = await resolveFederatedAddress(trimmedInput, network);
    if (resolved?.accountId) {
      return {
        accountId: resolved.accountId,
        originalInput: trimmedInput,
        inputType: 'federated',
        federatedAddress: trimmedInput,
        memoId: resolved.memoId,
        memoType: resolved.memoType,
      };
    }
  }

  return null;
}

/**
 * Validate any supported address format (legacy function name for backward compatibility)
 */
export function isValidPublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();

  // Check G... Ed25519
  if (isValidEd25519PublicKey(trimmed)) return true;

  // Check M... muxed
  if (isValidMuxedAccount(trimmed)) return true;

  // Check name*domain federated
  if (isFederatedAddress(trimmed)) return true;

  return false;
}

export function isValidContractId(id: string): boolean {
  try {
    StellarSdk.Address.fromString(id);
    return true;
  } catch {
    return false;
  }
}
