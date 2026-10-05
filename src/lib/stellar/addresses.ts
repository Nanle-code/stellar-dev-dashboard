import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, rateLimitedFetch, type NetworkName } from './networks.js';
import { requireAllowedEndpoint } from '../endpointAllowlist';
import {
  isValidEd25519PublicKey as coreIsValidEd25519PublicKey,
  isValidMuxedAccount as coreIsValidMuxedAccount,
  isFederatedAddress as coreIsFederatedAddress,
  parseMuxedAccount as coreParseMuxedAccount,
  checkDestinationMemoRequirement as coreCheckDestinationMemoRequirement,
  resolveFederatedAddress as coreResolveFederatedAddress,
  resolveAddress as coreResolveAddress,
  isValidPublicKey as coreIsValidPublicKey,
  isValidContractId as coreIsValidContractId,
  type MemoRequirementResult,
  type ResolvedAddress,
} from '@stellar-dev-dashboard/core';

export function isValidEd25519PublicKey(key: string): boolean {
  return coreIsValidEd25519PublicKey(key);
}

export function isValidMuxedAccount(key: string): boolean {
  return coreIsValidMuxedAccount(key);
}

export function isFederatedAddress(input: string): boolean {
  return coreIsFederatedAddress(input);
}

export function parseMuxedAccount(
  muxedAddress: string
): { masterAccount: string; muxedId: string } | null {
  return coreParseMuxedAccount(muxedAddress);
}

export { type MemoRequirementResult };

export async function checkDestinationMemoRequirement(
  destination: string,
  network: NetworkName = 'testnet'
): Promise<MemoRequirementResult> {
  return coreCheckDestinationMemoRequirement(destination, network);
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
      const tomlResponse = await rateLimitedFetch(federationUrl);
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

    return null;
  } catch {
    return null;
  }
}

export { type ResolvedAddress };

export async function resolveAddress(
  input: string,
  network: NetworkName = 'testnet'
): Promise<ResolvedAddress | null> {
  return coreResolveAddress(input, network);
}

export function isValidPublicKey(key: string): boolean {
  return coreIsValidPublicKey(key);
}

export function isValidContractId(id: string): boolean {
  return coreIsValidContractId(id);
}