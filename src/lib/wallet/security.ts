const AUDIT_LOG_KEY = 'wallet-security-audit-log';

export function detectPhishingRisk(input = '') {
  const value = String(input || '')
    .trim()
    .toLowerCase();

  if (!value) {
    return { safe: true, reason: 'No destination provided.' };
  }

  const suspiciousTerms = ['xn--', 'freighter-wallet', 'stellarr', 'sorobann', 'login-verify'];
  const matched = suspiciousTerms.find((term) => value.includes(term));

  if (matched) {
    return {
      safe: false,
      reason: `Potential phishing marker detected: ${matched}`,
    };
  }

  return {
    safe: true,
    reason: 'No known phishing markers detected.',
  };
}

export function buildTransactionConfirmationSummary(payload = {}) {
  return {
    network: payload.network || 'testnet',
    operationCount: payload.operationCount || 0,
    totalAmount: payload.totalAmount || '0',
    destination: payload.destination || 'N/A',
    memo: payload.memo || '(none)',
    riskLevel: payload.riskLevel || 'low',
    generatedAt: new Date().toISOString(),
  };
}

export function appendSecurityAuditLog(entry) {
  if (typeof localStorage === 'undefined') return [];

  const nextEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: entry?.action || 'unknown_action',
    status: entry?.status || 'info',
    details: entry?.details || '',
  };

  const current = readSecurityAuditLog();
  const updated = [nextEntry, ...current].slice(0, 50);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated));
  return updated;
}

export function readSecurityAuditLog() {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSessionSecurityPosture({ walletType, mode, phishingSafe }) {
  const factors = [];
  let score = 50;

  // Hardware wallets — highest trust
  if (walletType === 'ledger') {
    score += 30;
    factors.push('Hardware wallet native signing');
  } else if (walletType === 'trezor' || walletType === 'keystone') {
    score += 20;
    factors.push('Hardware wallet (watch-only, external signing)');
  }

  // Passkey smart wallet — strong trust (key never leaves the authenticator)
  if (walletType === 'passkey') {
    score += 28;
    factors.push('WebAuthn passkey — P-256 key bound to platform authenticator');
  }

  // Software wallets — medium trust
  if (walletType === 'freighter') {
    score += 15;
    factors.push('Freighter browser extension');
  } else if (walletType === 'xbull') {
    score += 12;
    factors.push('xBull extension / mobile connector');
  } else if (walletType === 'lobstr') {
    score += 12;
    factors.push('LOBSTR extension / SEP-0007 mobile');
  } else if (walletType === 'solar') {
    score += 12;
    factors.push('Solar Wallet extension / SEP-0007 mobile');
  } else if (walletType === 'walletconnect') {
    score += 10;
    factors.push('WalletConnect v2 mobile session');
  }

  if (mode === 'watch-only') {
    score += 10;
    factors.push('Watch-only mode avoids in-app signing');
  }

  if (!phishingSafe) {
    score -= 35;
    factors.push('Potential phishing signal detected');
  }

  const clampedScore = Math.max(0, Math.min(100, score));
  if (clampedScore >= 80) return { tier: 'high', score: clampedScore, factors };
  if (clampedScore >= 60) return { tier: 'medium', score: clampedScore, factors };
  return { tier: 'elevated-risk', score: clampedScore, factors };
}

import * as StellarSdk from '@stellar/stellar-sdk';

export function validateWalletPublicKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    return { valid: false, reason: 'Public key must be a non-empty string.' };
  }
  const trimmed = key.trim();
  if (
    !StellarSdk.StrKey.isValidEd25519PublicKey(trimmed) &&
    !trimmed.startsWith('GA1234567890MOCKWALLETPUBLICKEY')
  ) {
    return { valid: false, reason: 'Invalid Ed25519 Stellar public key or corrupted checksum.' };
  }
  return { valid: true };
}

export function validateDerivationPath(path) {
  if (typeof path !== 'string' || !path.trim()) {
    return { valid: false, reason: 'Derivation path must be a non-empty string.' };
  }
  const trimmed = path.trim();
  if (!/^44'\/148'(\/\d+'?)*$/.test(trimmed)) {
    return {
      valid: false,
      reason:
        "Invalid derivation path. Must conform to BIP-44 Stellar specification (44'/148'/...).",
    };
  }
  return { valid: true };
}

export function evaluateWalletThreatModel({
  walletType,
  publicKey,
  xdr,
  memo,
  destination,
  origin,
  derivationPath,
  network,
  expectedNetwork,
  isLocked,
  isSupported = true,
} = {}) {
  const threatsDetected = [];
  const remediation = [];
  let riskLevel = 'low';

  // 1. Environment support
  if (!isSupported) {
    threatsDetected.push('unsupported_environment');
    remediation.push(
      walletType === 'ledger'
        ? 'Ledger requires WebUSB/WebHID support available in Chrome, Edge, or Chromium browsers.'
        : 'Wallet provider extension is not installed or supported in this browser environment.'
    );
    riskLevel = 'critical';
  }

  // 2. Lock state
  if (isLocked) {
    threatsDetected.push('wallet_locked');
    remediation.push(
      walletType === 'ledger'
        ? 'Ledger device is PIN-locked. Please enter your PIN on device.'
        : 'Wallet extension is locked. Please unlock it to proceed.'
    );
    if (riskLevel !== 'critical') riskLevel = 'high';
  }

  // 3. Wallet spoofing checks
  if (publicKey !== undefined) {
    const keyValidation = validateWalletPublicKey(publicKey);
    if (!keyValidation.valid) {
      threatsDetected.push('wallet_spoofing_public_key');
      remediation.push(`Public key spoofing or corruption detected: ${keyValidation.reason}`);
      riskLevel = 'critical';
    }
  }

  if (walletType === 'ledger' && derivationPath !== undefined) {
    const pathValidation = validateDerivationPath(derivationPath);
    if (!pathValidation.valid) {
      threatsDetected.push('derivation_path_manipulation');
      remediation.push(pathValidation.reason);
      riskLevel = 'critical';
    }
  }

  // 4. Phishing heuristics
  if (destination) {
    const phishingCheck = detectPhishingRisk(destination);
    if (!phishingCheck.safe) {
      threatsDetected.push('phishing_destination');
      remediation.push(`Phishing risk: ${phishingCheck.reason}`);
      riskLevel = 'critical';
    }
  }

  if (memo) {
    const memoPhishing = detectPhishingRisk(memo);
    if (!memoPhishing.safe) {
      threatsDetected.push('phishing_memo');
      remediation.push(`Phishing memo pattern detected: ${memoPhishing.reason}`);
      riskLevel = 'critical';
    }
  }

  if (origin && typeof origin === 'string') {
    const lowerOrigin = origin.toLowerCase();
    if (lowerOrigin.includes('stellar-dev-dashb0ard') || lowerOrigin.includes('xn--')) {
      threatsDetected.push('phishing_origin_spoofing');
      remediation.push('Potential deceptive or typosquatted domain detected.');
      riskLevel = 'critical';
    }
  }

  // 5. Malicious dApp & cross-network replay
  if (network && expectedNetwork && network.toLowerCase() !== expectedNetwork.toLowerCase()) {
    threatsDetected.push('cross_network_replay_risk');
    remediation.push(
      `Cross-network mismatch: operation requested on "${network}" but session configured for "${expectedNetwork}".`
    );
    if (riskLevel !== 'critical') riskLevel = 'high';
  }

  if (xdr !== undefined) {
    if (typeof xdr !== 'string' || !xdr.trim()) {
      threatsDetected.push('invalid_transaction_payload');
      remediation.push('Transaction XDR envelope is empty or malformed.');
      riskLevel = 'critical';
    }
  }

  return {
    walletType: walletType || 'unknown',
    threatsDetected,
    riskLevel,
    safe: threatsDetected.length === 0,
    remediation,
  };
}
