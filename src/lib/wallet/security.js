const AUDIT_LOG_KEY = 'wallet-security-audit-log'

export function detectPhishingRisk(input = '') {
  const value = String(input || '').trim().toLowerCase()

  if (!value) {
    return { safe: true, reason: 'No destination provided.' }
  }

  const suspiciousTerms = ['xn--', 'freighter-wallet', 'stellarr', 'sorobann', 'login-verify']
  const matched = suspiciousTerms.find((term) => value.includes(term))

  if (matched) {
    return {
      safe: false,
      reason: `Potential phishing marker detected: ${matched}`,
    }
  }

  return {
    safe: true,
    reason: 'No known phishing markers detected.',
  }
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
  }
}

export function appendSecurityAuditLog(entry) {
  if (typeof localStorage === 'undefined') return []

  const nextEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    action: entry?.action || 'unknown_action',
    status: entry?.status || 'info',
    details: entry?.details || '',
  }

  const current = readSecurityAuditLog()
  const updated = [nextEntry, ...current].slice(0, 50)
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updated))
  return updated
}

export function readSecurityAuditLog() {
  if (typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getSessionSecurityPosture({ walletType, mode, phishingSafe }) {
  const factors = []
  let score = 50

  // Hardware wallets — highest trust
  if (walletType === 'ledger') {
    score += 30
    factors.push('Hardware wallet native signing')
  } else if (walletType === 'trezor' || walletType === 'keystone') {
    score += 20
    factors.push('Hardware wallet (watch-only, external signing)')
  }

  // Software wallets — medium trust
  if (walletType === 'freighter') {
    score += 15
    factors.push('Freighter browser extension')
  } else if (walletType === 'xbull') {
    score += 12
    factors.push('xBull extension / mobile connector')
  } else if (walletType === 'lobstr') {
    score += 12
    factors.push('LOBSTR extension / SEP-0007 mobile')
  } else if (walletType === 'solar') {
    score += 12
    factors.push('Solar Wallet extension / SEP-0007 mobile')
  } else if (walletType === 'walletconnect') {
    score += 10
    factors.push('WalletConnect v2 mobile session')
  }

  if (mode === 'watch-only') {
    score += 10
    factors.push('Watch-only mode avoids in-app signing')
  }

  if (!phishingSafe) {
    score -= 35
    factors.push('Potential phishing signal detected')
  }

  const clampedScore = Math.max(0, Math.min(100, score))
  if (clampedScore >= 80) return { tier: 'high', score: clampedScore, factors }
  if (clampedScore >= 60) return { tier: 'medium', score: clampedScore, factors }
  return { tier: 'elevated-risk', score: clampedScore, factors }
}
