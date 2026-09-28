import { StrKey } from '@stellar/stellar-sdk';

export type IssuerValidationState = 'valid' | 'missing' | 'invalid';
export type TrustlineAuthorizationState =
  | 'not-required'
  | 'required'
  | 'authorized'
  | 'maintain-liabilities'
  | 'unauthorized';

export interface AssetAuthorizationFlags {
  auth_required?: boolean;
  auth_clawback_enabled?: boolean;
}

export interface TrustlineAuthorizationFlags {
  is_authorized?: boolean;
  is_authorized_to_maintain_liabilities?: boolean;
}

export interface AssetTrustlineStatusInput {
  issuer?: string | null;
  flags?: AssetAuthorizationFlags | null;
  trustline?: TrustlineAuthorizationFlags | null;
  /** Injectable for deterministic consumers and tests. Defaults to Stellar StrKey validation. */
  validatePublicKey?: (value: string) => boolean;
}

export interface AssetTrustlineStatus {
  issuer: {
    state: IssuerValidationState;
    normalized: string | null;
    message: string;
  };
  authorization: {
    state: TrustlineAuthorizationState;
    message: string;
  };
  clawbackEnabled: boolean;
}

const ISSUER_MESSAGES: Record<IssuerValidationState, string> = {
  valid: 'Issuer is a valid Stellar ed25519 public key.',
  missing: 'Issuer is missing. Do not create a trustline until an issuer is provided.',
  invalid: 'Issuer is not a valid Stellar ed25519 public key.',
};

const AUTHORIZATION_MESSAGES: Record<TrustlineAuthorizationState, string> = {
  'not-required': 'This asset does not require issuer authorization.',
  required: 'Issuer authorization is required before this trustline can hold the asset.',
  authorized: 'This trustline is authorized to transact with the asset.',
  'maintain-liabilities': 'This trustline may maintain liabilities but cannot receive new funds.',
  unauthorized: 'This trustline is not authorized by the issuer.',
};

function getIssuerState(
  issuer: string | null | undefined,
  validatePublicKey: (value: string) => boolean
): { state: IssuerValidationState; normalized: string | null } {
  const normalized = typeof issuer === 'string' ? issuer.trim() : '';
  if (!normalized) return { state: 'missing', normalized: null };

  try {
    return validatePublicKey(normalized)
      ? { state: 'valid', normalized }
      : { state: 'invalid', normalized };
  } catch {
    // Validation failures are fail-closed: an issuer is never presented as safe
    // when validation support is unavailable or unexpectedly throws.
    return { state: 'invalid', normalized };
  }
}

function getAuthorizationState(
  authRequired: boolean,
  trustline?: TrustlineAuthorizationFlags | null
): TrustlineAuthorizationState {
  if (trustline?.is_authorized === true) return 'authorized';
  if (trustline?.is_authorized_to_maintain_liabilities === true) {
    return 'maintain-liabilities';
  }
  if (trustline?.is_authorized === false) return 'unauthorized';
  return authRequired ? 'required' : 'not-required';
}

/**
 * Produces the security-relevant issuer and trustline state used by asset UIs.
 * Missing/invalid issuers fail closed, and trustline state takes precedence over
 * the asset-level authorization requirement when Horizon provides both.
 */
export function getAssetTrustlineStatus({
  issuer,
  flags,
  trustline,
  validatePublicKey = StrKey.isValidEd25519PublicKey,
}: AssetTrustlineStatusInput): AssetTrustlineStatus {
  const issuerResult = getIssuerState(issuer, validatePublicKey);
  const authorizationState = getAuthorizationState(Boolean(flags?.auth_required), trustline);

  return {
    issuer: {
      ...issuerResult,
      message: ISSUER_MESSAGES[issuerResult.state],
    },
    authorization: {
      state: authorizationState,
      message: AUTHORIZATION_MESSAGES[authorizationState],
    },
    clawbackEnabled: Boolean(flags?.auth_clawback_enabled),
  };
}
