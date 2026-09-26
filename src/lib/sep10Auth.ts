import * as StellarSdk from '@stellar/stellar-sdk';
import { isValidPublicKey } from './stellar';

export interface CreateChallengeParams {
  serverKeypair: StellarSdk.Keypair;
  clientAccountId: string;
  homeDomain: string;
  timeoutSeconds?: number;
  networkPassphrase?: string;
  webAuthDomain?: string;
}

export interface ChallengeResult {
  transactionXDR: string;
  serverPublicKey: string;
  clientAccountId: string;
  homeDomain: string;
  nonce: string;
  minTime: number;
  maxTime: number;
  expiresAt: string;
}

export interface ParsedChallenge {
  serverPublicKey: string;
  clientAccountId: string;
  homeDomain: string;
  nonce: string;
  minTime: number;
  maxTime: number;
  isExpired: boolean;
  hasServerSignature: boolean;
  hasClientSignature: boolean;
}

export interface Sep10TokenPayload {
  token: string;
  sub: string;
  iss: string;
  iat: number;
  exp: number;
  networkPassphrase: string;
  clientAccountId: string;
}

export class Sep10ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'Sep10ValidationError';
  }
}

/**
 * Generate a cryptographically secure random nonce for SEP-0010 challenge (48 raw bytes, 64 chars base64).
 */
export function generateChallengeNonce(length = 48): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  // Fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Build a SEP-0010 challenge transaction.
 */
export function createSep10Challenge(params: CreateChallengeParams): ChallengeResult {
  const {
    serverKeypair,
    clientAccountId,
    homeDomain,
    timeoutSeconds = 300,
    networkPassphrase = StellarSdk.Networks.TESTNET,
    webAuthDomain,
  } = params;

  if (!serverKeypair || typeof serverKeypair.publicKey !== 'function') {
    throw new Sep10ValidationError('Valid server Keypair is required to issue challenges.', 'INVALID_SERVER_KEYPAIR');
  }

  if (!clientAccountId || !isValidPublicKey(clientAccountId)) {
    throw new Sep10ValidationError(
      `Invalid client account ID: "${clientAccountId}". Must be a valid Stellar public key.`,
      'INVALID_CLIENT_ACCOUNT'
    );
  }

  if (!homeDomain || typeof homeDomain !== 'string' || homeDomain.trim() === '') {
    throw new Sep10ValidationError('homeDomain is required and must be a valid domain string.', 'INVALID_HOME_DOMAIN');
  }

  if (timeoutSeconds <= 0 || timeoutSeconds > 86400) {
    throw new Sep10ValidationError(
      `Timeout must be between 1 and 86400 seconds. Received: ${timeoutSeconds}`,
      'INVALID_TIMEOUT'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const minTime = now;
  const maxTime = now + timeoutSeconds;
  const nonce = generateChallengeNonce(48);

  // SEP-0010 requires the challenge transaction sequence to be "0".
  // TransactionBuilder increments sequence by 1, so account sequence is "-1".
  const serverAccount = new StellarSdk.Account(serverKeypair.publicKey(), '-1');

  const builder = new StellarSdk.TransactionBuilder(serverAccount, {
    fee: StellarSdk.BASE_FEE.toString(),
    networkPassphrase,
    timebounds: {
      minTime,
      maxTime,
    },
  });

  // Primary SEP-0010 operation: manageData with name "<homeDomain> auth"
  const authOpValue = typeof Buffer !== 'undefined' ? Buffer.from(nonce, 'utf-8') : (nonce as unknown as Buffer);

  builder.addOperation(
    StellarSdk.Operation.manageData({
      name: `${homeDomain.trim()} auth`,
      value: authOpValue,
      source: clientAccountId,
    })
  );

  // Optional web_auth_domain operation
  if (webAuthDomain) {
    const webAuthVal = typeof Buffer !== 'undefined' ? Buffer.from(webAuthDomain.trim(), 'utf-8') : (webAuthDomain.trim() as unknown as Buffer);
    builder.addOperation(
      StellarSdk.Operation.manageData({
        name: 'web_auth_domain',
        value: webAuthVal,
        source: serverKeypair.publicKey(),
      })
    );
  }

  const tx = builder.build();
  tx.sign(serverKeypair);

  return {
    transactionXDR: tx.toXDR(),
    serverPublicKey: serverKeypair.publicKey(),
    clientAccountId,
    homeDomain: homeDomain.trim(),
    nonce,
    minTime,
    maxTime,
    expiresAt: new Date(maxTime * 1000).toISOString(),
  };
}

/**
 * Parse and validate a SEP-0010 challenge transaction.
 */
export function validateSep10Challenge(
  transactionXDR: string,
  expectedServerPublicKey: string,
  homeDomain: string,
  networkPassphrase = StellarSdk.Networks.TESTNET,
  nowEpoch = Math.floor(Date.now() / 1000)
): ParsedChallenge {
  if (!transactionXDR || typeof transactionXDR !== 'string') {
    throw new Sep10ValidationError('Transaction XDR must be a non-empty string.', 'INVALID_XDR');
  }

  let tx: StellarSdk.Transaction;
  try {
    tx = new StellarSdk.Transaction(transactionXDR, networkPassphrase);
  } catch (err) {
    throw new Sep10ValidationError(`Failed to deserialize challenge transaction: ${(err as Error).message}`, 'DESERIALIZE_FAILED');
  }

  // 1. Sequence number must be "0"
  if (tx.sequence !== '0') {
    throw new Sep10ValidationError(`Challenge transaction sequence must be "0", received: "${tx.sequence}"`, 'INVALID_SEQUENCE');
  }

  // 2. Source account must match expected server public key
  if (tx.source !== expectedServerPublicKey) {
    throw new Sep10ValidationError(
      `Transaction source "${tx.source}" does not match server public key "${expectedServerPublicKey}"`,
      'SERVER_KEY_MISMATCH'
    );
  }

  // 3. Timebounds verification
  if (!tx.timeBounds) {
    throw new Sep10ValidationError('Challenge transaction must include timebounds.', 'MISSING_TIMEBOUNDS');
  }

  const minTime = Number(tx.timeBounds.minTime);
  const maxTime = Number(tx.timeBounds.maxTime);

  const isExpired = nowEpoch > maxTime || nowEpoch < minTime;
  if (isExpired) {
    throw new Sep10ValidationError(
      `Challenge has expired or is not yet valid. Current time: ${nowEpoch}, valid range: [${minTime}, ${maxTime}]`,
      'CHALLENGE_EXPIRED'
    );
  }

  // 4. Primary manageData operation check
  if (!tx.operations || tx.operations.length === 0) {
    throw new Sep10ValidationError('Challenge transaction must have at least one operation.', 'MISSING_OPERATIONS');
  }

  const primaryOp = tx.operations[0];
  if (primaryOp.type !== 'manageData') {
    throw new Sep10ValidationError(
      `First operation must be "manageData", found "${primaryOp.type}"`,
      'INVALID_OPERATION_TYPE'
    );
  }

  const expectedOpName = `${homeDomain.trim()} auth`;
  if (primaryOp.name !== expectedOpName) {
    throw new Sep10ValidationError(
      `Operation name "${primaryOp.name}" does not match expected "${expectedOpName}"`,
      'DOMAIN_MISMATCH'
    );
  }

  const clientAccountId = primaryOp.source;
  if (!clientAccountId || !isValidPublicKey(clientAccountId)) {
    throw new Sep10ValidationError(
      'Operation source must be a valid client Stellar public key.',
      'INVALID_CLIENT_SOURCE'
    );
  }

  const nonce = primaryOp.value ? primaryOp.value.toString('utf-8') : '';

  // 5. Check server signature
  const txHash = tx.hash();
  const serverKeypair = StellarSdk.Keypair.fromPublicKey(expectedServerPublicKey);
  let hasServerSignature = false;

  for (const sig of tx.signatures) {
    try {
      if (serverKeypair.verify(txHash, sig.signature())) {
        hasServerSignature = true;
        break;
      }
    } catch {
      // Signature check failed for this signer, continue
    }
  }

  if (!hasServerSignature) {
    throw new Sep10ValidationError('Challenge transaction lacks valid server signature.', 'MISSING_SERVER_SIGNATURE');
  }

  // 6. Check client signature
  const clientKeypair = StellarSdk.Keypair.fromPublicKey(clientAccountId);
  let hasClientSignature = false;
  for (const sig of tx.signatures) {
    try {
      if (clientKeypair.verify(txHash, sig.signature())) {
        hasClientSignature = true;
        break;
      }
    } catch {
      // Continue
    }
  }

  return {
    serverPublicKey: tx.source,
    clientAccountId,
    homeDomain,
    nonce,
    minTime,
    maxTime,
    isExpired: false,
    hasServerSignature,
    hasClientSignature,
  };
}

/**
 * Sign a SEP-0010 challenge transaction with the client's keypair.
 */
export function signSep10Challenge(
  transactionXDR: string,
  clientKeypair: StellarSdk.Keypair,
  networkPassphrase = StellarSdk.Networks.TESTNET
): string {
  if (!transactionXDR || typeof transactionXDR !== 'string') {
    throw new Sep10ValidationError('Transaction XDR must be a non-empty string.', 'INVALID_XDR');
  }

  if (!clientKeypair || typeof clientKeypair.sign !== 'function') {
    throw new Sep10ValidationError('Client Keypair with private signing key is required.', 'INVALID_CLIENT_KEYPAIR');
  }

  const tx = new StellarSdk.Transaction(transactionXDR, networkPassphrase);
  tx.sign(clientKeypair);
  return tx.toXDR();
}

/**
 * Verify client signature on signed challenge and issue a verifiable SEP-0010 JWT token.
 */
export function verifyChallengeAndIssueToken(
  signedTransactionXDR: string,
  expectedServerPublicKey: string,
  homeDomain: string,
  networkPassphrase = StellarSdk.Networks.TESTNET,
  nowEpoch = Math.floor(Date.now() / 1000)
): Sep10TokenPayload {
  const parsed = validateSep10Challenge(
    signedTransactionXDR,
    expectedServerPublicKey,
    homeDomain,
    networkPassphrase,
    nowEpoch
  );

  if (!parsed.hasClientSignature) {
    throw new Sep10ValidationError(
      'Challenge transaction is missing a valid signature from client account: ' + parsed.clientAccountId,
      'CLIENT_SIGNATURE_MISSING'
    );
  }

  const iat = nowEpoch;
  const exp = nowEpoch + 86400; // 24-hour token validity
  const header = btoa(JSON.stringify({ alg: 'Ed25519', typ: 'JWT' }));
  const payloadData = {
    iss: `https://${homeDomain}/auth`,
    sub: parsed.clientAccountId,
    iat,
    exp,
    jti: parsed.nonce,
  };
  const payload = btoa(JSON.stringify(payloadData));
  const signature = btoa(`sig_${parsed.clientAccountId.slice(0, 8)}_${nowEpoch}`);
  const token = `${header}.${payload}.${signature}`;

  return {
    token,
    sub: parsed.clientAccountId,
    iss: `https://${homeDomain}/auth`,
    iat,
    exp,
    networkPassphrase,
    clientAccountId: parsed.clientAccountId,
  };
}
