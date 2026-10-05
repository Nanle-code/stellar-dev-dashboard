import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, type NetworkName } from './networks.js';

export function isValidEd25519PublicKey(key: string): boolean {
  return StellarSdk.StrKey.isValidEd25519PublicKey(key);
}

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

export function isFederatedAddress(input: string): boolean {
  if (typeof input !== 'string' || !input.trim()) return false;
  const trimmed = input.trim();
  return (
    /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed) ||
    /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
  );
}

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
      return { required: false, checked: true };
    }
    return {
      required: false,
      checked: false,
      error: error?.message || 'Failed to check destination memo requirement.',
    };
  }
}

export async function resolveFederatedAddress(
  federatedAddress: string,
  network: NetworkName = 'testnet'
): Promise<{ accountId: string; memoId?: string; memoType?: string } | null> {
  try {
    const [name, domain] = federatedAddress.split('*');

    if (!name || !domain) {
      return null;
    }

    const federationUrl = `https://${domain}/.well-known/stellar.toml`;

    let tomlData: Record<string, any> = {};
    try {
      const tomlResponse = await fetch(federationUrl);
      if (!tomlResponse.ok) {
        return null;
      }

      const tomlText = await tomlResponse.text();
      const federationServerMatch = tomlText.match(/FEDERATION_SERVER\s*=\s*"([^"]+)"/);
      if (federationServerMatch) {
        tomlData.federationServer = federationServerMatch[1];
      }
    } catch {
      return null;
    }

    if (tomlData.federationServer) {
      const federationEndpoint = new URL(tomlData.federationServer);
      federationEndpoint.searchParams.append('q', federatedAddress);
      federationEndpoint.searchParams.append('type', 'name');

      const response = await fetch(federationEndpoint.toString());
      if (response.ok) {
        return await response.json();
      }
    }

    return null;
  } catch {
    return null;
  }
}

export interface MemoRequirementResult {
  required: boolean;
  checked: boolean;
  error?: string;
}

export interface ResolvedAddress {
  accountId: string;
  muxedId?: string;
  originalInput: string;
  inputType: 'ed25519' | 'muxed' | 'federated';
  federatedAddress?: string;
  memoId?: string;
  memoType?: string;
}

export async function resolveAddress(
  input: string,
  network: NetworkName = 'testnet'
): Promise<ResolvedAddress | null> {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();

  if (isValidEd25519PublicKey(trimmedInput)) {
    return {
      accountId: trimmedInput,
      originalInput: trimmedInput,
      inputType: 'ed25519',
    };
  }

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

export function isValidPublicKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();

  if (isValidEd25519PublicKey(trimmed)) return true;
  if (isValidMuxedAccount(trimmed)) return true;
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