/**
 * Multi-Signature Account Management Library
 * Handles co-signer coordination, threshold management, and signature collection
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { getServer, NETWORKS } from './stellar';
import { getStoredValue, setStoredValue } from './storage';
import { measureAsync, recordCustomMetric } from './performanceMonitoring';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MULTISIG_STORAGE_KEY = 'stellar-multisig-sessions';

export const SIGNER_WEIGHT = {
  REMOVE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export const THRESHOLD_TYPE = {
  LOW: 'low_threshold',
  MEDIUM: 'med_threshold',
  HIGH: 'high_threshold',
};

export const SESSION_STATUS = {
  PENDING: 'pending',
  COLLECTING: 'collecting',
  READY: 'ready',
  SUBMITTED: 'submitted',
  FAILED: 'failed',
};

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidPublicKey(key) {
  // Import the updated validation from stellar.ts
  // Keypair.fromPublicKey only works for G..., so we need to check all formats
  if (!key || typeof key !== 'string') return false

  const trimmed = key.trim()

  // Try G... Ed25519
  try {
    StellarSdk.Keypair.fromPublicKey(trimmed)
    return true
  } catch {
    // Fall through
  }

  // Try M... muxed account
  try {
    return StellarSdk.StrKey.isValidMuxedAccount(trimmed)
  } catch {
    // Fall through
  }

  // Try name*domain federated address
  return /^[a-zA-Z0-9._-]+\*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)
}

/**
 * Validate threshold configuration
 * @param {object} thresholds - { low, medium, high }
 * @param {Array} signers - [{ key, weight }]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateThresholds(thresholds, signers) {
  const errors = [];
  const totalWeight = signers.reduce((sum, s) => sum + (s.weight || 0), 0);

  if (thresholds.low < 0 || thresholds.low > 255) errors.push('Low threshold must be 0–255');
  if (thresholds.medium < 0 || thresholds.medium > 255) errors.push('Medium threshold must be 0–255');
  if (thresholds.high < 0 || thresholds.high > 255) errors.push('High threshold must be 0–255');
  if (thresholds.medium < thresholds.low) errors.push('Medium threshold should be ≥ low threshold');
  if (thresholds.high < thresholds.medium) errors.push('High threshold should be ≥ medium threshold');
  if (thresholds.high > totalWeight) errors.push(`High threshold (${thresholds.high}) exceeds total signer weight (${totalWeight})`);

  return { valid: errors.length === 0, errors };
}

// ─── Account Signers ──────────────────────────────────────────────────────────

/**
 * Parse signers and thresholds from a Horizon account response
 * @param {object} accountData - Horizon AccountResponse
 * @returns {{ signers: Array, thresholds: object, masterWeight: number }}
 */
export function parseAccountSigners(accountData) {
  if (!accountData) return { signers: [], thresholds: { low: 0, medium: 0, high: 0 }, masterWeight: 1 };

  const signers = (accountData.signers || []).map((s) => ({
    key: s.key,
    weight: s.weight,
    type: s.type,
    isMaster: s.key === accountData.id,
  }));

  const thresholds = {
    low: accountData.thresholds?.low_threshold ?? 0,
    medium: accountData.thresholds?.med_threshold ?? 0,
    high: accountData.thresholds?.high_threshold ?? 0,
  };

  const masterSigner = signers.find((s) => s.isMaster);
  const masterWeight = masterSigner?.weight ?? 1;

  return { signers, thresholds, masterWeight };
}

/**
 * Calculate whether a set of signatures meets a threshold
 * @param {Array} collectedSigners - public keys that have signed
 * @param {Array} allSigners - [{ key, weight }]
 * @param {number} threshold
 * @returns {{ met: boolean, currentWeight: number, needed: number }}
 */
export function checkThresholdMet(collectedSigners, allSigners, threshold) {
  const collectedSet = new Set(collectedSigners);
  const currentWeight = allSigners
    .filter((s) => collectedSet.has(s.key))
    .reduce((sum, s) => sum + s.weight, 0);

  return {
    met: currentWeight >= threshold,
    currentWeight,
    needed: Math.max(0, threshold - currentWeight),
  };
}

// ─── Transaction Building ─────────────────────────────────────────────────────

/**
 * Build a SetOptions transaction to configure multisig on an account
 * @param {string} sourceAccount - Horizon AccountResponse
 * @param {object} config - { signers: [{key, weight}], thresholds: {low, medium, high}, masterWeight }
 * @param {string} network
 * @returns {StellarSdk.Transaction}
 */
export function buildSetSignersTransaction(sourceAccount, config, network = 'testnet') {
  const { signers, thresholds, masterWeight } = config;
  const networkPassphrase = NETWORKS[network].passphrase;

  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  }).setTimeout(300);

  // Set master weight and thresholds
  txBuilder.addOperation(
    StellarSdk.Operation.setOptions({
      masterWeight,
      lowThreshold: thresholds.low,
      medThreshold: thresholds.medium,
      highThreshold: thresholds.high,
    })
  );

  // Add/update/remove co-signers
  for (const signer of signers) {
    if (signer.isMaster) continue; // master handled via masterWeight above
    txBuilder.addOperation(
      StellarSdk.Operation.setOptions({
        signer: {
          ed25519PublicKey: signer.key,
          weight: signer.weight,
        },
      })
    );
  }

  return txBuilder.build();
}

/**
 * Add a signature (decorated) to a transaction XDR
 * @param {string} txXdr - base64 XDR of the transaction
 * @param {string} signerSecret - secret key of the signer
 * @param {string} network
 * @returns {string} new XDR with signature appended
 */
export function addSignatureToXdr(txXdr, signerSecret, network = 'testnet') {
  const networkPassphrase = NETWORKS[network].passphrase;
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
  const keypair = StellarSdk.Keypair.fromSecret(signerSecret);
  const start = performance.now();
  tx.sign(keypair);
  recordCustomMetric('TRANSACTION_SIGNING_DURATION', performance.now() - start, {
    network,
    signer: 'multisig-local-keypair',
    signatureCount: tx.signatures.length,
  });
  return tx.toXDR();
}

/**
 * Add a raw signature (sig + hint) to a transaction XDR without needing the secret key
 * Used when a co-signer provides their signature externally
 * @param {string} txXdr
 * @param {string} publicKey
 * @param {string} signatureHex - hex-encoded signature bytes
 * @param {string} network
 * @returns {string} new XDR
 */
export function addRawSignatureToXdr(txXdr, publicKey, signatureHex, network = 'testnet') {
  const networkPassphrase = NETWORKS[network].passphrase;
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
  const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
  const hint = keypair.signatureHint();
  const signature = Buffer.from(signatureHex, 'hex');
  tx.signatures.push(new StellarSdk.xdr.DecoratedSignature({ hint, signature }));
  return tx.toXDR();
}

/**
 * Get the list of public keys that have already signed a transaction XDR
 * @param {string} txXdr
 * @param {string} network
 * @returns {string[]} public keys
 */
export function getSignersFromXdr(txXdr, network = 'testnet') {
  const networkPassphrase = NETWORKS[network].passphrase;
  try {
    const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
    return tx.signatures.map((sig) => {
      // hint is the last 4 bytes of the public key
      return Buffer.from(sig.hint()).toString('hex');
    });
  } catch {
    return [];
  }
}

/**
 * Submit a fully-signed transaction to the network
 * @param {string} txXdr
 * @param {string} network
 * @returns {Promise<object>} Horizon submit result
 */
export async function submitMultisigTransaction(txXdr, network = 'testnet') {
  const networkPassphrase = NETWORKS[network].passphrase;
  const server = getServer(network);
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXdr, networkPassphrase);
  return measureAsync(
    'TRANSACTION_SUBMIT_DURATION',
    () => server.submitTransaction(tx),
    {
      network,
      operationCount: tx.operations?.length || 0,
      source: 'multisig',
    },
  );
}

// ─── Session Management (IndexedDB) ──────────────────────────────────────────

/**
 * Load all multisig sessions from IndexedDB via storage.js
 * @returns {Promise<object[]>}
 */
export async function loadSessions() {
  try {
    const raw = await getStoredValue(MULTISIG_STORAGE_KEY);
    if (typeof raw === 'string') return JSON.parse(raw);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * Save sessions to IndexedDB via storage.js
 * @param {object[]} sessions
 * @returns {Promise<void>}
 */
export async function saveSessions(sessions) {
  await setStoredValue(MULTISIG_STORAGE_KEY, sessions);
}

/**
 * Create a new signature collection session
 * @param {object} params
 * @returns {Promise<object>} session
 */
export async function createSession({ txXdr, sourceAddress, description, requiredSigners, threshold, network }) {
  const session = {
    id: `msig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    txXdr,
    sourceAddress,
    description: description || 'Multisig Transaction',
    requiredSigners, // [{ key, weight, label? }]
    threshold,
    network,
    collectedSignatures: [], // [{ signerKey, xdr, addedAt }]
    status: SESSION_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sessions = await loadSessions();
  sessions.unshift(session);
  await saveSessions(sessions);
  return session;
}

/**
 * Update a session by id
 * @param {string} id
 * @param {object} updates
 * @returns {Promise<object|null>} updated session
 */
export async function updateSession(id, updates) {
  const sessions = await loadSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
  await saveSessions(sessions);
  return sessions[idx];
}

/**
 * Delete a session by id
 * @param {string} id
 */
export async function deleteSession(id) {
  const sessions = await loadSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  await saveSessions(filtered);
}

/**
 * Add a collected signature to a session
 * @param {string} sessionId
 * @param {string} signerKey - public key
 * @param {string} signedXdr - XDR with this signer's signature added
 * @returns {Promise<object|null>} updated session
 */
export async function addSignatureToSession(sessionId, signerKey, signedXdr) {
  const sessions = await loadSessions();
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;

  // Avoid duplicates
  const alreadySigned = session.collectedSignatures.some((s) => s.signerKey === signerKey);
  if (alreadySigned) return session;

  session.collectedSignatures.push({ signerKey, xdr: signedXdr, addedAt: new Date().toISOString() });
  session.txXdr = signedXdr; // accumulate signatures in the XDR

  // Recalculate status
  const { met } = checkThresholdMet(
    session.collectedSignatures.map((s) => s.signerKey),
    session.requiredSigners,
    session.threshold
  );
  session.status = met ? SESSION_STATUS.READY : SESSION_STATUS.COLLECTING;
  session.updatedAt = new Date().toISOString();

  const idx = sessions.findIndex((s) => s.id === sessionId);
  sessions[idx] = session;
  await saveSessions(sessions);
  return session;
}

/**
 * Export a multisig session to a JSON string for sharing.
 * @param {object} session
 * @returns {string}
 */
export function exportSessionJson(session) {
  return JSON.stringify({
    version: "1.0",
    type: "MultisigSession",
    data: session
  }, null, 2);
}

/**
 * Import a multisig session from a JSON string.
 * Merges signatures if the session already exists.
 * @param {string} jsonString
 * @returns {Promise<object>} updated or newly imported session
 */
export async function importSessionJson(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (parsed.type !== "MultisigSession" || !parsed.data) {
    throw new Error("Invalid session JSON format.");
  }

  const importedSession = parsed.data;
  const sessions = await loadSessions();
  const existingIdx = sessions.findIndex((s) => s.id === importedSession.id);

  if (existingIdx === -1) {
    sessions.unshift(importedSession);
    await saveSessions(sessions);
    return importedSession;
  }

  const existingSession = sessions[existingIdx];
  let updated = false;

  for (const sig of importedSession.collectedSignatures || []) {
    const alreadySigned = existingSession.collectedSignatures.some(
      (s) => s.signerKey === sig.signerKey
    );
    if (!alreadySigned) {
      existingSession.collectedSignatures.push(sig);
      existingSession.txXdr = sig.xdr; // take the latest XDR
      updated = true;
    }
  }

  if (updated) {
    const { met } = checkThresholdMet(
      existingSession.collectedSignatures.map((s) => s.signerKey),
      existingSession.requiredSigners,
      existingSession.threshold
    );
    existingSession.status = met ? SESSION_STATUS.READY : SESSION_STATUS.COLLECTING;
    existingSession.updatedAt = new Date().toISOString();

    sessions[existingIdx] = existingSession;
    await saveSessions(sessions);
  }

  return existingSession;
}
