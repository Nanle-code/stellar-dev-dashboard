// src/lib/biometricAuth.ts
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export interface BiometricOptions {
  userId: string;
  userName: string;
  displayName: string;
}

export async function registerBiometric(options: BiometricOptions) {
  const registrationOptions = {
    rp: { name: 'Stellar Dev Dashboard' },
    user: {
      id: Uint8Array.from(options.userId, c => c.charCodeAt(0)),
      name: options.userName,
      displayName: options.displayName,
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    timeout: 60000,
    attestation: 'direct' as const,
  };
  const attResp = await startRegistration(registrationOptions);
  // TODO: send attResp to backend for verification/storage
  return attResp;
}

export async function loginBiometric() {
  const authOptions = {} as any; // options can be fetched from server if needed
  const assertion = await startAuthentication(authOptions);
  // TODO: verify assertion with backend
  return assertion;
}

export function isBiometricSupported(): boolean {
  return !!(window.PublicKeyCredential && navigator.credentials);
}
